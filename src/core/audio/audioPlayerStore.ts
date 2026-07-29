import type { LoopRegion } from '../model/item/TrackItem';
import { DesktopBridge } from '../persistence/DesktopBridge';
import { getBlobUrlForFile, getLocalMediaUrl } from '../utils/mediaUtils';

export interface PlayingTrackData {
	id: string;
	shapeId?: string;
	pageId?: string;
	title: string;
	imageUrl: string;
	audioSource: string;
	sourceType: 'local' | 'stream';
	playMode: 'oneshot' | 'loop';
	loopRegion?: LoopRegion;
}

type AudioPlayerListener = () => void;

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

	private constructor() {
		if (typeof window !== 'undefined') {
			this.audioElement = new Audio();
			this.audioElement.crossOrigin = 'anonymous';

			let lastNotifyTime = 0;
			this.audioElement.addEventListener('timeupdate', () => {
				if (!this.audioElement) return;
				this.currentTime = this.audioElement.currentTime;

				// Handle loop region if configured
				if (
					this.currentTrack?.playMode === 'loop' &&
					this.currentTrack.loopRegion &&
					this.currentTrack.loopRegion.end > this.currentTrack.loopRegion.start
				) {
					const { start, end } = this.currentTrack.loopRegion;
					if (this.currentTime >= end) {
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
				if (
					this.currentTrack?.playMode === 'loop' &&
					this.currentTrack.loopRegion &&
					this.currentTrack.loopRegion.start > 0 &&
					this.currentTrack.loopRegion.start < this.duration
				) {
					try {
						this.audioElement.currentTime = this.currentTrack.loopRegion.start;
					} catch (e) {
						console.warn('[AudioPlayer] Seek in loadedmetadata failed:', e);
					}
				}
				this.notify();
			});

			this.audioElement.addEventListener('ended', () => {
				if (this.currentTrack?.playMode === 'loop') {
					if (this.audioElement) {
						const start = this.currentTrack.loopRegion?.start || 0;
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

	private initAudioContext(): void {
		if (this.audioCtx || !this.audioElement) return;
		try {
			const AudioContextClass =
				window.AudioContext || (window as any).webkitAudioContext;
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

	public getRealtimeFrequencyData(): Uint8Array {
		if (!this.analyserNode) return new Uint8Array(0);
		const data = new Uint8Array(this.analyserNode.frequencyBinCount);
		this.analyserNode.getByteFrequencyData(data);
		return data;
	}

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

	public getState() {
		return {
			currentTrack: this.currentTrack,
			isPlaying: this.isPlaying,
			currentTime: this.currentTime,
			duration: this.duration,
		};
	}

	public async playTrack(track: PlayingTrackData): Promise<void> {
		if (this.currentTrack?.id === track.id) {
			this.togglePlayPause();
			return;
		}

		this.stop();
		this.currentTrack = track;
		this.currentTime = 0;

		if (
			track.sourceType === 'local' &&
			track.audioSource &&
			this.audioElement
		) {
			let src = getLocalMediaUrl(track.audioSource);

			if (
				!DesktopBridge.isTauri() &&
				!src.startsWith('http://') &&
				!src.startsWith('https://') &&
				!src.startsWith('blob:') &&
				!src.startsWith('data:')
			) {
				const blobUrl = await getBlobUrlForFile(track.audioSource);
				if (blobUrl) src = blobUrl;
			}

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
						'[AudioPlayer] Could not play local audio with primary src:',
						err,
					);
					if (DesktopBridge.isTauri() && !src.startsWith('blob:')) {
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
					this.isPlaying = false;
					this.notify();
				});

			this.extractWaveformPeaks(track.id, track.audioSource, src);
		} else {
			// Streaming iframe / link
			this.isPlaying = true;
			this.notify();
		}
	}

	public togglePlayPause(): void {
		if (!this.currentTrack) return;
		if (this.currentTrack.sourceType === 'local' && this.audioElement) {
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

	public seekTo(time: number): void {
		if (this.audioElement && this.currentTrack?.sourceType === 'local') {
			this.audioElement.currentTime = time;
			this.currentTime = time;
			this.notify();
		}
	}

	public getPeaks(trackId: string): number[] | undefined {
		return this.audioPeaksMap.get(trackId);
	}

	private extractWaveformPeaks(
		trackId: string,
		path: string,
		src: string,
	): void {
		if (this.audioPeaksMap.has(trackId)) return;

		setTimeout(async () => {
			try {
				let arrayBuffer: ArrayBuffer | null = null;
				try {
					const response = await fetch(src);
					if (response.ok) {
						arrayBuffer = await response.arrayBuffer();
					}
				} catch {
					// Fetch failed
				}

				if (!arrayBuffer && DesktopBridge.isTauri()) {
					arrayBuffer = await DesktopBridge.readFileBinary(path);
				}

				if (!arrayBuffer) return;
				if (arrayBuffer.byteLength > 150_000_000) return;

				const AudioContextClass =
					window.AudioContext || (window as any).webkitAudioContext;
				const audioCtx = new AudioContextClass();
				const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
				const rawData = audioBuffer.getChannelData(0);
				const samples = 100;
				const blockSize = Math.floor(rawData.length / samples);
				const step = Math.max(1, Math.floor(blockSize / 50));
				const peaks: number[] = [];
				for (let i = 0; i < samples; i++) {
					let sum = 0;
					let count = 0;
					const blockStart = i * blockSize;
					for (let j = 0; j < blockSize; j += step) {
						sum += Math.abs(rawData[blockStart + j]);
						count++;
					}
					peaks.push(count > 0 ? sum / count : 0);
				}
				const max = Math.max(...peaks) || 1;
				const normalized = peaks.map((p) => p / max);
				this.audioPeaksMap.set(trackId, normalized);
				this.notify();
				audioCtx.close();
			} catch (err) {
				console.warn('[AudioPlayer] Could not extract waveform peaks:', err);
			}
		}, 500);
	}
}

export const audioPlayer = AudioPlayerStore.instance();
