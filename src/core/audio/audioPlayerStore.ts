import type { LoopRegion } from '../model/item/TrackItem';
import { DesktopBridge } from '../persistence/DesktopBridge';
import { getBlobUrlForFile, getLocalMediaUrl } from '../utils/mediaUtils';
import { getOrExtractWaveformPeaks } from '../utils/WaveformService';

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
}

/**
 * Callback function type for audio player state listeners.
 */
type AudioPlayerListener = () => void;

/**
 * Singleton Audio Player Store managing playback state, audio context node graph,
 * frequency analysis for visualizers, and state change subscriptions.
 */
class AudioPlayerStore {
	private static _instance: AudioPlayerStore;

	private currentTrack: PlayingTrackData | null = null;
	private isPlaying: boolean = false;
	private currentTime: number = 0;
	private duration: number = 0;
	private audioElement: HTMLAudioElement | null = null;
	private listeners: Set<AudioPlayerListener> = new Set();
	private audioPeaksMap: Map<string, number[]> = new Map();

	private audioCtx: AudioContext | null = null;
	private analyserNode: AnalyserNode | null = null;
	private mediaElementSource: MediaElementAudioSourceNode | null = null;

	/**
	 * Private constructor initializing HTMLAudioElement event listeners.
	 */
	private constructor() {
		if (typeof window !== 'undefined') {
			this.audioElement = new Audio();
			this.audioElement.crossOrigin = 'anonymous';

			let lastNotifyTime = 0;
			this.audioElement.addEventListener('timeupdate', () => {
				if (!this.audioElement) return;
				this.currentTime = this.audioElement.currentTime;

				if (this.currentTrack?.playMode === 'loop') {
					const start = this.currentTrack.loopRegion?.start ?? 0;
					const end =
						this.currentTrack.loopRegion?.end &&
						this.currentTrack.loopRegion.end > start
							? this.currentTrack.loopRegion.end
							: this.duration;

					if (end > start && this.currentTime >= end) {
						this.audioElement.currentTime = start;
					}
				}

				const now = Date.now();
				if (now - lastNotifyTime > 250) {
					lastNotifyTime = now;
					this.notify();
				}
			});

			this.audioElement.addEventListener('loadedmetadata', () => {
				if (!this.audioElement) return;
				this.duration = this.audioElement.duration || 0;
				const start = this.currentTrack?.loopRegion?.start ?? 0;
				if (
					this.currentTrack?.playMode === 'loop' &&
					start > 0 &&
					start < this.duration
				) {
					try {
						this.audioElement.currentTime = start;
					} catch (e) {
						console.warn('[AudioPlayer] Seek in loadedmetadata failed:', e);
					}
				}
				this.notify();
			});

			this.audioElement.addEventListener('ended', () => {
				if (this.currentTrack?.playMode === 'loop') {
					if (this.audioElement) {
						const start = this.currentTrack.loopRegion?.start ?? 0;
						this.audioElement.currentTime = start;
						this.audioElement.play().catch(() => {});
					}
				} else {
					this.isPlaying = false;
					this.notify();
				}
			});

			this.audioElement.addEventListener('play', () => {
				this.isPlaying = true;
				this.initAudioContext();
				this.notify();
			});

			this.audioElement.addEventListener('pause', () => {
				this.isPlaying = false;
				this.notify();
			});

			this.audioElement.addEventListener('error', async () => {
				const error = this.audioElement?.error;
				console.error('[AudioPlayer] HTMLAudioElement error event:', error);

				if (
					this.currentTrack?.sourceType === 'local' &&
					this.currentTrack.audioSource
				) {
					const currentSrc = this.audioElement?.src || '';
					if (!currentSrc.startsWith('blob:') && DesktopBridge.isTauri()) {
						console.log(
							'[AudioPlayer] Attempting Blob URL fallback for local audio...',
						);
						const blobUrl = await getBlobUrlForFile(
							this.currentTrack.audioSource,
						);
						if (blobUrl && this.audioElement) {
							this.audioElement.src = blobUrl;
							this.audioElement.load();
							this.audioElement
								.play()
								.then(() => {
									this.isPlaying = true;
									this.notify();
								})
								.catch((fallbackErr) => {
									console.error(
										'[AudioPlayer] Blob fallback play failed:',
										fallbackErr,
									);
									this.isPlaying = false;
									this.notify();
								});
							return;
						}
					}
				}
				this.isPlaying = false;
				this.notify();
			});
		}
	}

	/**
	 * Initializes Web Audio API Context and AnalyserNode graph for real-time frequency analysis.
	 */
	private initAudioContext(): void {
		if (this.audioCtx || !this.audioElement) return;
		try {
			const AudioContextClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			this.audioCtx = new AudioContextClass();
			this.analyserNode = this.audioCtx.createAnalyser();
			this.analyserNode.fftSize = 64;
			this.mediaElementSource = this.audioCtx.createMediaElementSource(
				this.audioElement,
			);
			this.mediaElementSource.connect(this.analyserNode);
			this.analyserNode.connect(this.audioCtx.destination);
		} catch (e) {
			console.warn('[AudioPlayer] Could not init Web Audio Analyser:', e);
		}
	}

	/**
	 * Retrieves real-time byte frequency data from the AnalyserNode.
	 * @returns Uint8Array containing frequency values ranging from 0 to 255.
	 */
	public getRealtimeFrequencyData(): Uint8Array {
		if (!this.analyserNode) return new Uint8Array(0);
		const data = new Uint8Array(this.analyserNode.frequencyBinCount);
		this.analyserNode.getByteFrequencyData(data);
		return data;
	}

	/**
	 * Returns the singleton instance of AudioPlayerStore.
	 * @returns AudioPlayerStore instance.
	 */
	public static instance(): AudioPlayerStore {
		if (!AudioPlayerStore._instance) {
			AudioPlayerStore._instance = new AudioPlayerStore();
		}
		return AudioPlayerStore._instance;
	}

	/**
	 * Subscribes a listener callback to audio player state notifications.
	 * @param listener Function to invoke when state updates.
	 * @returns Unsubscribe cleanup function.
	 */
	public subscribe(listener: AudioPlayerListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Notifies all registered listeners of a state change.
	 */
	private notify(): void {
		this.listeners.forEach((l) => {
			l();
		});
	}

	/**
	 * Gets a snapshot of the current audio player state.
	 * @returns Object containing currentTrack, isPlaying, currentTime, and duration.
	 */
	public getState() {
		return {
			currentTrack: this.currentTrack,
			isPlaying: this.isPlaying,
			currentTime: this.currentTime,
			duration: this.duration,
		};
	}

	/**
	 * Starts playing a track or toggles playback if the track is already active.
	 * Supports both local files and streaming audio sources.
	 * @param track PlayingTrackData object containing track parameters.
	 */
	public async playTrack(track: PlayingTrackData): Promise<void> {
		if (this.currentTrack?.id === track.id) {
			this.togglePlayPause();
			return;
		}

		this.stop();
		this.currentTrack =
			track.sourceType === 'stream' ? { ...track, playMode: 'oneshot' } : track;
		this.currentTime = 0;

		if (this.audioElement && track.audioSource) {
			let src =
				track.sourceType === 'local'
					? getLocalMediaUrl(track.audioSource)
					: track.audioSource;

			if (
				track.sourceType === 'local' &&
				!DesktopBridge.isTauri() &&
				!src.startsWith('http://') &&
				!src.startsWith('https://') &&
				!src.startsWith('blob:') &&
				!src.startsWith('data:')
			) {
				const blobUrl = await getBlobUrlForFile(track.audioSource);
				if (blobUrl) src = blobUrl;
			}

			const isDirectPlayable =
				track.sourceType === 'local' ||
				src.startsWith('http://') ||
				src.startsWith('https://') ||
				src.startsWith('blob:') ||
				src.startsWith('data:');

			if (isDirectPlayable) {
				if (this.audioElement.src !== src) {
					this.audioElement.src = src;
					this.audioElement.load();
				}

				if (this.audioCtx && this.audioCtx.state === 'suspended') {
					this.audioCtx.resume().catch(() => {});
				}

				this.audioElement
					.play()
					.then(() => {
						this.isPlaying = true;
						this.notify();
					})
					.catch(async (err) => {
						console.warn(
							'[AudioPlayer] Direct play attempt failed or iframe embed required:',
							err,
						);
						if (
							track.sourceType === 'local' &&
							DesktopBridge.isTauri() &&
							!src.startsWith('blob:')
						) {
							const blobUrl = await getBlobUrlForFile(track.audioSource);
							if (blobUrl && this.audioElement) {
								this.audioElement.src = blobUrl;
								this.audioElement.load();
								try {
									await this.audioElement.play();
									this.isPlaying = true;
									this.notify();
									return;
								} catch (fallbackErr) {
									console.error(
										'[AudioPlayer] Blob fallback play failed:',
										fallbackErr,
									);
								}
							}
						}
						this.isPlaying = true;
						this.notify();
					});

				if (track.sourceType === 'local') {
					this.extractWaveformPeaks(track.id, track.audioSource, src);
				}
			} else {
				this.isPlaying = true;
				this.notify();
			}
		} else {
			this.isPlaying = true;
			this.notify();
		}
	}

	/**
	 * Toggles playback between play and pause states for the currently active track.
	 */
	public togglePlayPause(): void {
		if (!this.currentTrack) return;
		if (this.audioElement?.src) {
			if (this.audioCtx && this.audioCtx.state === 'suspended') {
				this.audioCtx.resume().catch(() => {});
			}
			if (this.isPlaying) {
				this.audioElement.pause();
			} else {
				this.audioElement.play().catch(() => {});
			}
		} else {
			this.isPlaying = !this.isPlaying;
			this.notify();
		}
	}

	/**
	 * Stops audio playback and resets player state.
	 */
	public stop(): void {
		if (this.audioElement) {
			this.audioElement.pause();
			this.audioElement.currentTime = 0;
		}
		this.currentTrack = null;
		this.isPlaying = false;
		this.currentTime = 0;
		this.duration = 0;
		this.notify();
	}

	/**
	 * Seeks playback position to specified timestamp in seconds.
	 * @param time Target playback time in seconds.
	 */
	public seekTo(time: number): void {
		if (this.audioElement) {
			this.audioElement.currentTime = time;
			this.currentTime = time;
			this.notify();
		}
	}

	/**
	 * Retrieves cached waveform peaks for a track.
	 * @param trackId Unique ID of the track.
	 * @returns Array of peak numerical values or undefined if not cached.
	 */
	public getPeaks(trackId: string): number[] | undefined {
		return this.audioPeaksMap.get(trackId);
	}

	/**
	 * Asynchronously extracts waveform peaks for visual presentation.
	 * @param trackId Unique ID of the track.
	 * @param path File system path of the audio file.
	 * @param src Resolved URL source of the audio.
	 */
	private extractWaveformPeaks(
		trackId: string,
		path: string,
		src: string,
	): void {
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
