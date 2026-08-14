import { mixerEngine } from '@core/audio/MixerEngine';
import { mixerStore } from '@core/audio/MixerStore';
import type { LoopRegion } from '@core/model/item/TrackItem';
import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { getBlobUrlForFile, resolveMediaUrl } from '@core/utils/mediaUtils';
import { notify } from '@services/NotificationService';

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

	private constructor() {
		mixerStore.subscribe(() => {
			this.updateChannelVolumes();
		});
	}

	public static instance(): AudioPlayerStore {
		if (!AudioPlayerStore._instance) {
			AudioPlayerStore._instance = new AudioPlayerStore();
		}
		return AudioPlayerStore._instance;
	}

	public updateChannelVolumes(): void {
		const mixerState = mixerStore.getState();
		const masterVol = mixerState.master.isMuted ? 0 : mixerState.master.volume;

		let anySolo = false;
		for (const c of mixerState.channels) {
			if (c.isSolo) {
				anySolo = true;
				break;
			}
		}

		for (const [chId, channel] of this.channels.entries()) {
			if (!channel.audioElement) continue;

			let channelVol = 1.0;
			let channelMuted = false;
			let channelSolo = false;

			if (chId === 'master') {
				channelVol = 1.0;
				channelMuted = false;
				channelSolo = false;
			} else {
				const chState = mixerState.channels.find((c) => c.id === chId);
				if (chState) {
					channelVol = chState.volume;
					channelMuted = chState.isMuted;
					channelSolo = chState.isSolo;
				}
			}

			let finalGain = masterVol * channelVol;
			if (channelMuted) {
				finalGain = 0;
			} else if (anySolo && !channelSolo) {
				finalGain = 0;
			}

			const targetVol = Math.max(0, Math.min(1, finalGain));
			if (channel.mediaSource) {
				channel.audioElement.volume = 1.0;
			} else {
				channel.audioElement.volume = targetVol;
			}
		}
	}

	public subscribe(listener: AudioPlayerListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify(): void {
		this.listeners.forEach((l) => {
			l();
		});
	}

	private getOrCreateChannel(channelId: string): ChannelPlayback {
		const existing = this.channels.get(channelId);
		if (existing) {
			return existing;
		}

		const audioElement = new Audio();
		audioElement.preload = 'auto';
		audioElement.crossOrigin = 'anonymous';

		const channel: ChannelPlayback = {
			audioElement,
			mediaSource: null,
			currentTrack: null,
			isPlaying: false,
			currentTime: 0,
			duration: 0,
		};

		this.channels.set(channelId, channel);
		this.updateChannelVolumes();

		const updateDuration = () => {
			if (
				audioElement.duration &&
				!Number.isNaN(audioElement.duration) &&
				audioElement.duration > 0
			) {
				channel.duration = audioElement.duration;
				this.notify();
			}
		};

		audioElement.addEventListener('durationchange', updateDuration);
		audioElement.addEventListener('loadedmetadata', updateDuration);
		audioElement.addEventListener('canplay', updateDuration);

		let lastNotifyTime = 0;
		audioElement.addEventListener('timeupdate', () => {
			channel.currentTime = audioElement.currentTime;
			if (
				audioElement.duration &&
				!Number.isNaN(audioElement.duration) &&
				audioElement.duration > 0 &&
				channel.duration !== audioElement.duration
			) {
				channel.duration = audioElement.duration;
			}

			if (channel.currentTrack?.playMode === 'loop' && channel.duration > 0) {
				const start = channel.currentTrack.loopRegion?.start ?? 0;
				const end =
					channel.currentTrack.loopRegion?.end &&
					channel.currentTrack.loopRegion.end > start
						? channel.currentTrack.loopRegion.end
						: channel.duration;

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

		audioElement.addEventListener('ended', () => {
			if (channel.currentTrack?.playMode === 'loop') {
				const start = channel.currentTrack.loopRegion?.start ?? 0;
				audioElement.currentTime = start;
				audioElement.play().catch(() => {});
			} else {
				channel.isPlaying = false;
				mixerEngine.setChannelPlaying(channelId, false);
				this.notify();
			}
		});

		audioElement.addEventListener('play', () => {
			channel.isPlaying = true;
			mixerEngine.setChannelPlaying(channelId, true);
			this.updateChannelVolumes();
			this.notify();
		});

		audioElement.addEventListener('pause', () => {
			channel.isPlaying = false;
			mixerEngine.setChannelPlaying(channelId, false);
			this.notify();
		});

		audioElement.addEventListener('error', async (e) => {
			console.warn(
				`[AudioPlayer] Audio playback error on src: "${audioElement.src}" for track "${channel.currentTrack?.title}"`,
				e,
			);
			if (
				channel.currentTrack?.sourceType === 'local' &&
				channel.currentTrack.audioSource
			) {
				const currentSrc = audioElement.src || '';
				if (!currentSrc.startsWith('blob:') && DesktopBridge.isTauri()) {
					console.log(
						`[AudioPlayer] Falling back to in-memory Blob URL for "${channel.currentTrack.title}"`,
					);
					const blobUrl = await getBlobUrlForFile(
						channel.currentTrack.audioSource,
					);
					if (blobUrl && audioElement.src !== blobUrl) {
						audioElement.src = blobUrl;
						audioElement.load();
						audioElement
							.play()
							.then(() => {
								channel.isPlaying = true;
								mixerEngine.setChannelPlaying(channelId, true);
								this.notify();
							})
							.catch((err) => {
								console.error('[AudioPlayer] Fallback Blob play failed:', err);
								channel.isPlaying = false;
								mixerEngine.setChannelPlaying(channelId, false);
								this.notify();
							});
						return;
					}
				}
			}
			if (channel.currentTrack?.title) {
				notify.error(
					`Could not play audio track "${channel.currentTrack.title}"`,
				);
			}
			channel.isPlaying = false;
			mixerEngine.setChannelPlaying(channelId, false);
			this.notify();
		});

		return channel;
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
			duration,
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
				if (channel.isPlaying) {
					channel.audioElement.pause();
					channel.isPlaying = false;
					mixerEngine.setChannelPlaying(channelId, false);
				} else {
					channel.audioElement
						.play()
						.then(() => {
							channel.isPlaying = true;
							mixerEngine.setChannelPlaying(channelId, true);
							this.notify();
						})
						.catch(() => {});
				}
			} else {
				channel.isPlaying = !channel.isPlaying;
				mixerEngine.setChannelPlaying(channelId, channel.isPlaying);
				this.notify();
			}
			this.lastActiveTrack = track;
			return;
		}

		if (channel.audioElement) {
			channel.audioElement.pause();
			channel.audioElement.currentTime = 0;
		}

		const normalizedTrack =
			track.sourceType === 'stream'
				? { ...track, playMode: 'oneshot' as const }
				: track;
		channel.currentTrack = normalizedTrack;
		channel.currentTime = 0;
		this.lastActiveTrack = normalizedTrack;

		if (channel.audioElement && track.audioSource) {
			let src: string;

			if (track.sourceType === 'local') {
				src = await resolveMediaUrl(track.audioSource);
				if (!src) {
					const blobUrl = await getBlobUrlForFile(track.audioSource);
					if (blobUrl) src = blobUrl;
				}
			} else {
				src = track.audioSource;
			}

			channel.audioElement.crossOrigin = 'anonymous';

			const isDirectPlayable =
				track.sourceType === 'local' ||
				src.startsWith('http://') ||
				src.startsWith('https://') ||
				src.startsWith('blob:') ||
				src.startsWith('data:');

			console.log(
				`[AudioPlayer] playTrack "${track.title}" (channel: ${channelId}) src:`,
				src,
			);

			if (isDirectPlayable) {
				if (channel.audioElement.src !== src) {
					channel.audioElement.src = src;
					channel.audioElement.load();
				}

				if (!channel.mediaSource) {
					channel.mediaSource = mixerEngine.connectMediaElement(
						channelId,
						channel.audioElement,
					);
				}

				mixerEngine.resumeContext().catch(() => {});
				this.updateChannelVolumes();

				channel.audioElement
					.play()
					.then(() => {
						channel.isPlaying = true;
						mixerEngine.setChannelPlaying(channelId, true);
						this.notify();
					})
					.catch(async () => {
						if (
							track.sourceType === 'local' &&
							DesktopBridge.isTauri() &&
							!src.startsWith('blob:')
						) {
							const blobUrl = await getBlobUrlForFile(track.audioSource);
							if (blobUrl && channel.audioElement.src !== blobUrl) {
								channel.audioElement.src = blobUrl;
								channel.audioElement.load();
								try {
									await channel.audioElement.play();
									channel.isPlaying = true;
									mixerEngine.setChannelPlaying(channelId, true);
									this.notify();
									return;
								} catch (_fallbackErr) {}
							}
						}
						channel.isPlaying = true;
						this.notify();
					});
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
		for (const [chId, ch] of this.channels.entries()) {
			if (ch.audioElement) {
				ch.audioElement.pause();
				ch.audioElement.currentTime = 0;
			}
			ch.currentTrack = null;
			ch.isPlaying = false;
			ch.currentTime = 0;
			ch.duration = 0;
			mixerEngine.setChannelPlaying(chId, false);
		}
		this.lastActiveTrack = null;
		this.notify();
	}

	public togglePlayPause(): void {
		// Toggle the last active track's channel
		if (!this.lastActiveTrack) return;
		const channelId = this.lastActiveTrack.channelId || 'master';
		const channel = this.channels.get(channelId);
		if (channel?.audioElement?.src) {
			if (channel.isPlaying) {
				channel.audioElement.pause();
				channel.isPlaying = false;
				mixerEngine.setChannelPlaying(channelId, false);
			} else {
				channel.audioElement
					.play()
					.then(() => {
						channel.isPlaying = true;
						mixerEngine.setChannelPlaying(channelId, true);
						this.notify();
					})
					.catch(() => {});
			}
			this.notify();
		}
	}

	public seekTo(time: number): void {
		if (!this.lastActiveTrack) return;
		const channelId = this.lastActiveTrack.channelId || 'master';
		const channel = this.channels.get(channelId);
		if (channel?.audioElement) {
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
}

/**
 * Global instance export of AudioPlayerStore singleton.
 */
export const audioPlayer = AudioPlayerStore.instance();
