import type { LoopRegion } from '@core/model/item/TrackItem';
import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { getBlobUrlForFile, getLocalMediaUrl } from '@core/utils/mediaUtils';
import { getOrExtractWaveformPeaks } from '@core/utils/WaveformService';
import { notify } from '@services/NotificationService';
import { mixerEngine } from '@core/audio/MixerEngine';

/**
 * Interface representing the data structure for a track currently playing or loaded in the audio player.
 */
export interface PlayingTrackData {
	/** Unique identifier of the track */
	id: string;
	/** Optional shape ID associated with the track on the tldraw canvas */
	shapeId?: string;
	/** Optional page ID where the track shape resides */
	pageId?: string;
	/** Display title of the track */
	title: string;
	/** Image cover URL for the track */
	imageUrl: string;
	/** Audio source path or streaming web URL */
	audioSource: string;
	/** Type of audio source: local file or streaming service */
	sourceType: 'local' | 'stream';
	/** Playback mode: oneshot or loop */
	playMode: 'oneshot' | 'loop';
	/** Optional loop region start and end boundaries in seconds */
	loopRegion?: LoopRegion;
	/** Optional channel ID for multi-channel routing */
	channelId?: string;
}

/**
 * Callback function type for audio player state listeners.
 */
type AudioPlayerListener = () => void;

/**
 * Singleton Audio Player Store managing playback state, audio context node graph,
 * frequency analysis for visualizers, and state change subscriptions.
 */
interface ChannelPlayback {
	audioElement: HTMLAudioElement;
	mediaSource: MediaElementAudioSourceNode | null;
	currentTrack: PlayingTrackData | null;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
}

class AudioPlayerStore {
	private static _instance: AudioPlayerStore;

	private channels: Map<string, ChannelPlayback> = new Map();
	private lastActiveTrack: PlayingTrackData | null = null;
	
	private listeners: Set<AudioPlayerListener> = new Set();
	private audioPeaksMap: Map<string, number[]> = new Map();

	private constructor() {}

	public static instance(): AudioPlayerStore {
		if (!AudioPlayerStore._instance) {
			AudioPlayerStore._instance = new AudioPlayerStore();
		}
		return AudioPlayerStore._instance;
	}

	public subscribe(listener: AudioPlayerListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify(): void {
		this.listeners.forEach((l) => l());
	}
	
	private getOrCreateChannel(channelId: string): ChannelPlayback {
		if (this.channels.has(channelId)) {
			return this.channels.get(channelId)!;
		}
		
		const audioElement = new Audio();
		audioElement.crossOrigin = 'anonymous';
		
		const channel: ChannelPlayback = {
			audioElement,
			mediaSource: null,
			currentTrack: null,
			isPlaying: false,
			currentTime: 0,
			duration: 0
		};
		
		this.channels.set(channelId, channel);
		
		let lastNotifyTime = 0;
		audioElement.addEventListener('timeupdate', () => {
			channel.currentTime = audioElement.currentTime;
			
			if (channel.currentTrack?.playMode === 'loop') {
				const start = channel.currentTrack.loopRegion?.start ?? 0;
				const end = channel.currentTrack.loopRegion?.end && channel.currentTrack.loopRegion.end > start
					? channel.currentTrack.loopRegion.end : channel.duration;
					
				if (end > start && channel.currentTime >= end) {
					audioElement.currentTime = start;
				}
			}
			
			const now = Date.now();
			if (now - lastNotifyTime > 250) {
				lastNotifyTime = now;
				this.notify();
			}
		});
		
		audioElement.addEventListener('loadedmetadata', () => {
			channel.duration = audioElement.duration || 0;
			const start = channel.currentTrack?.loopRegion?.start ?? 0;
			if (channel.currentTrack?.playMode === 'loop' && start > 0 && start < channel.duration) {
				try {
					audioElement.currentTime = start;
				} catch(e) {}
			}
			this.notify();
		});
		
		audioElement.addEventListener('ended', () => {
			if (channel.currentTrack?.playMode === 'loop') {
				const start = channel.currentTrack.loopRegion?.start ?? 0;
				audioElement.currentTime = start;
				audioElement.play().catch(() => {});
			} else {
				channel.isPlaying = false;
				this.notify();
			}
		});
		
		audioElement.addEventListener('play', () => {
			channel.isPlaying = true;
			this.initAudioContext(channelId, channel);
			this.notify();
		});
		
		audioElement.addEventListener('pause', () => {
			channel.isPlaying = false;
			this.notify();
		});
		
		audioElement.addEventListener('error', async () => {
			if (channel.currentTrack?.sourceType === 'local' && channel.currentTrack.audioSource) {
				const currentSrc = audioElement.src || '';
				if (!currentSrc.startsWith('blob:') && DesktopBridge.isTauri()) {
					const blobUrl = await getBlobUrlForFile(channel.currentTrack.audioSource);
					if (blobUrl) {
						audioElement.src = blobUrl;
						audioElement.load();
						audioElement.play().then(() => {
							channel.isPlaying = true;
							this.notify();
						}).catch(() => {
							channel.isPlaying = false;
							this.notify();
						});
						return;
					}
				}
			}
			if (channel.currentTrack?.title) {
				notify.error(`Could not play audio track "${channel.currentTrack.title}"`);
			}
			channel.isPlaying = false;
			this.notify();
		});
		
		return channel;
	}

	private initAudioContext(channelId: string, channel: ChannelPlayback): void {
		try {
			const ctx = mixerEngine.ensureContext();
			if (!channel.mediaSource) {
				channel.mediaSource = ctx.createMediaElementSource(channel.audioElement);
			}
			try {
				channel.mediaSource.disconnect();
			} catch (e) {}

			const targetInput = mixerEngine.getChannelInput(channelId);
			channel.mediaSource.connect(targetInput);
		} catch (e) {
			console.warn('[AudioPlayer] Could not init Web Audio Analyser:', e);
		}
	}

	public getState() {
		const playingTracks: PlayingTrackData[] = [];
		for (const ch of this.channels.values()) {
			if (ch.currentTrack) {
				playingTracks.push(ch.currentTrack);
			}
		}
		
		let isPlaying = false;
		let currentTime = 0;
		let duration = 0;

		if (this.lastActiveTrack) {
			const channelId = this.lastActiveTrack.channelId || 'master';
			const channel = this.channels.get(channelId);
			if (channel) {
				isPlaying = channel.isPlaying;
				currentTime = channel.currentTime;
				duration = channel.duration;
			}
		}
		
		return {
			currentTrack: this.lastActiveTrack,
			playingTracks,
			isPlaying,
			currentTime,
			duration
		};
	}

	public async playTrack(track: PlayingTrackData): Promise<void> {
		const channelId = track.channelId || 'master';

		// Stop this track if it was currently active/playing on a DIFFERENT channel
		for (const [chId, ch] of this.channels.entries()) {
			if (chId !== channelId && ch.currentTrack?.id === track.id) {
				ch.audioElement.pause();
				ch.audioElement.currentTime = 0;
				ch.isPlaying = false;
				ch.currentTrack = null;
			}
		}

		const channel = this.getOrCreateChannel(channelId);
		
		if (channel.currentTrack?.id === track.id) {
			if (channel.audioElement.src) {
				const ctx = mixerEngine.getAudioContext();
				if (ctx && ctx.state === 'suspended') {
					mixerEngine.resumeContext().catch(() => {});
				}
				if (channel.isPlaying) {
					channel.audioElement.pause();
				} else {
					channel.audioElement.play().catch(() => {});
				}
			} else {
				channel.isPlaying = !channel.isPlaying;
				this.notify();
			}
			this.lastActiveTrack = track;
			return;
		}

		if (channel.audioElement) {
			channel.audioElement.pause();
			channel.audioElement.currentTime = 0;
		}
		
		channel.currentTrack = track.sourceType === 'stream' ? { ...track, playMode: 'oneshot' } : track;
		channel.currentTime = 0;
		this.lastActiveTrack = track;

		if (channel.audioElement && track.audioSource) {
			let src = track.sourceType === 'local' ? getLocalMediaUrl(track.audioSource) : track.audioSource;

			if (track.sourceType === 'local' && !DesktopBridge.isTauri() && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('blob:') && !src.startsWith('data:')) {
				const blobUrl = await getBlobUrlForFile(track.audioSource);
				if (blobUrl) src = blobUrl;
			}

			const isDirectPlayable = track.sourceType === 'local' || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:') || src.startsWith('data:');

			if (isDirectPlayable) {
				if (channel.audioElement.src !== src) {
					channel.audioElement.src = src;
					channel.audioElement.load();
				}

				const ctx = mixerEngine.getAudioContext();
				if (ctx && ctx.state === 'suspended') {
					mixerEngine.resumeContext().catch(() => {});
				}

				channel.audioElement.play().then(() => {
					channel.isPlaying = true;
					this.notify();
				}).catch(async () => {
					if (track.sourceType === 'local' && DesktopBridge.isTauri() && !src.startsWith('blob:')) {
						const blobUrl = await getBlobUrlForFile(track.audioSource);
						if (blobUrl) {
							channel.audioElement.src = blobUrl;
							channel.audioElement.load();
							try {
								await channel.audioElement.play();
								channel.isPlaying = true;
								this.notify();
								return;
							} catch (fallbackErr) {}
						}
					}
					channel.isPlaying = true;
					this.notify();
				});

				if (track.sourceType === 'local') {
					this.extractWaveformPeaks(track.id, track.audioSource, src);
				}
			} else {
				channel.isPlaying = true;
				this.notify();
			}
		} else {
			channel.isPlaying = true;
			this.notify();
		}
	}
	
	public stop(): void {
		for (const ch of this.channels.values()) {
			if (ch.audioElement) {
				ch.audioElement.pause();
				ch.audioElement.currentTime = 0;
			}
			ch.currentTrack = null;
			ch.isPlaying = false;
			ch.currentTime = 0;
			ch.duration = 0;
		}
		this.lastActiveTrack = null;
		this.notify();
	}

	public togglePlayPause(): void {
		// Toggle the last active track's channel
		if (!this.lastActiveTrack) return;
		const channelId = this.lastActiveTrack.channelId || 'master';
		const channel = this.channels.get(channelId);
		if (channel && channel.audioElement?.src) {
			const ctx = mixerEngine.getAudioContext();
			if (ctx && ctx.state === 'suspended') {
				mixerEngine.resumeContext().catch(() => {});
			}
			if (channel.isPlaying) {
				channel.audioElement.pause();
			} else {
				channel.audioElement.play().catch(() => {});
			}
		}
	}

	public seekTo(time: number): void {
		if (!this.lastActiveTrack) return;
		const channelId = this.lastActiveTrack.channelId || 'master';
		const channel = this.channels.get(channelId);
		if (channel && channel.audioElement) {
			channel.audioElement.currentTime = time;
			channel.currentTime = time;
			this.notify();
		}
	}

	public isTrackPlaying(shapeId: string): boolean {
		for (const ch of this.channels.values()) {
			if (ch.currentTrack?.shapeId === shapeId && ch.isPlaying) {
				return true;
			}
		}
		return false;
	}

	public isTrackActive(shapeId: string): boolean {
		for (const ch of this.channels.values()) {
			if (ch.currentTrack?.shapeId === shapeId) {
				return true;
			}
		}
		return false;
	}

	public getRealtimeFrequencyData(channelId?: string): Uint8Array {
		return mixerEngine.getChannelFrequencyData(channelId || 'master');
	}
	
	public getPeaks(trackId: string): number[] | undefined {
		return this.audioPeaksMap.get(trackId);
	}
	
	private extractWaveformPeaks(trackId: string, path: string, src: string): void {
		if (this.audioPeaksMap.has(trackId)) return;
		getOrExtractWaveformPeaks(trackId, src, path, 100).then((peaks) => {
			this.audioPeaksMap.set(trackId, peaks);
			this.notify();
		});
	}
}

/**
 * Global instance export of AudioPlayerStore singleton.
 */
export const audioPlayer = AudioPlayerStore.instance();
