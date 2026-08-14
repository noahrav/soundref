interface ChannelNodes {
	id: string;
	input: GainNode;
	gain: GainNode;
	pan: StereoPannerNode;
	splitter: ChannelSplitterNode;
	analyserL: AnalyserNode;
	analyserR: AnalyserNode;
	volume: number;
	panVal: number;
	isMuted: boolean;
	isSolo: boolean;
	savedGain: number;
}

/**
 * Singleton Web Audio API mixer engine managing the audio processing graph.
 * Inspired by DAW architectures: all audio routes through a master bus
 * with gain, pan, and metering capabilities.
 */
class MixerEngine {
	private static _instance: MixerEngine;

	private audioCtx: AudioContext | null = null;

	// Master bus nodes
	private masterInputNode: GainNode | null = null;
	private masterGainNode: GainNode | null = null;
	private masterPanNode: StereoPannerNode | null = null;
	private masterAnalyserNode: AnalyserNode | null = null;
	private masterSplitter: ChannelSplitterNode | null = null;
	private masterAnalyserLeft: AnalyserNode | null = null;
	private masterAnalyserRight: AnalyserNode | null = null;

	// Master bus state
	private masterVolume: number = 1.0;
	private masterPan: number = 0.0;
	private savedMasterGain: number = 1.0;
	private isMasterMuted: boolean = false;

	private userChannels: Map<string, ChannelNodes> = new Map();

	private constructor() {}

	/**
	 * Returns the singleton instance of MixerEngine.
	 */
	public static instance(): MixerEngine {
		if (!MixerEngine._instance) {
			MixerEngine._instance = new MixerEngine();
		}
		return MixerEngine._instance;
	}

	/**
	 * Lazily creates the AudioContext and initializes the master bus graph.
	 * Safe to call multiple times.
	 */
	public ensureContext(): AudioContext {
		if (!this.audioCtx) {
			const AudioContextClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			this.audioCtx = new AudioContextClass({ latencyHint: 'playback' });
			this.initMasterBus();
		}
		return this.audioCtx;
	}

	/**
	 * Returns the existing AudioContext or null if not yet created.
	 */
	public getAudioContext(): AudioContext | null {
		return this.audioCtx;
	}

	/**
	 * Initializes the master bus audio processing graph:
	 * masterInput → masterGain → masterPan → masterAnalyser → destination
	 *                                      → splitter → L/R analysers (for VU meter)
	 */
	private initMasterBus(): void {
		const ctx = this.audioCtx;
		if (!ctx) return;

		// Master input - the summing point where all channels/sources connect
		this.masterInputNode = ctx.createGain();
		this.masterInputNode.gain.value = 1.0;

		// Master volume control
		this.masterGainNode = ctx.createGain();
		this.masterGainNode.gain.value = this.isMasterMuted ? 0 : this.masterVolume;

		// Master stereo pan
		this.masterPanNode = ctx.createStereoPanner();
		this.masterPanNode.pan.value = this.masterPan;

		// Master analyser for overall level (also feeds destination)
		this.masterAnalyserNode = ctx.createAnalyser();
		this.masterAnalyserNode.fftSize = 256;
		this.masterAnalyserNode.smoothingTimeConstant = 0.8;

		// Stereo splitter for L/R VU metering
		this.masterSplitter = ctx.createChannelSplitter(2);
		this.masterAnalyserLeft = ctx.createAnalyser();
		this.masterAnalyserLeft.fftSize = 256;
		this.masterAnalyserLeft.smoothingTimeConstant = 0.8;
		this.masterAnalyserRight = ctx.createAnalyser();
		this.masterAnalyserRight.fftSize = 256;
		this.masterAnalyserRight.smoothingTimeConstant = 0.8;

		// Wire the graph:
		// input → gain → pan → analyser → destination
		this.masterInputNode.connect(this.masterGainNode);
		this.masterGainNode.connect(this.masterPanNode);
		this.masterPanNode.connect(this.masterAnalyserNode);
		this.masterAnalyserNode.connect(ctx.destination);

		// Stereo metering branch: pan → splitter → L/R analysers
		this.masterPanNode.connect(this.masterSplitter);
		this.masterSplitter.connect(this.masterAnalyserLeft, 0);
		this.masterSplitter.connect(this.masterAnalyserRight, 1);
	}

	/**
	 * Returns the master input node that external audio sources should connect to.
	 * This is the entry point into the mixer's audio graph.
	 */
	public getMasterInput(): AudioNode {
		const ctx = this.ensureContext();
		if (!this.masterInputNode) {
			this.initMasterBus();
		}
		return this.masterInputNode || ctx.destination;
	}

	/**
	 * Sets the master volume with immediate smooth response for real-time slider dragging.
	 * Stores state so it works even if audio context/nodes aren't created yet.
	 * @param value Linear volume value (0.0 to 1.5).
	 */
	public setMasterVolume(value: number): void {
		const clampedValue = Math.max(0, Math.min(1.5, value));
		this.masterVolume = clampedValue;
		if (!this.isMasterMuted) {
			this.savedMasterGain = clampedValue;
		}

		if (this.masterGainNode && this.audioCtx) {
			const now = this.audioCtx.currentTime;
			this.masterGainNode.gain.cancelScheduledValues(now);
			this.masterGainNode.gain.setValueAtTime(
				this.masterGainNode.gain.value,
				now,
			);
			this.masterGainNode.gain.linearRampToValueAtTime(
				this.isMasterMuted ? 0 : clampedValue,
				now + 0.015,
			);
		}
	}

	/**
	 * Sets the master pan position with smooth anti-click response for real-time slider dragging.
	 * Stores state so it works even if audio context/nodes aren't created yet.
	 * @param value Pan value from -1.0 (left) to 1.0 (right).
	 */
	public setMasterPan(value: number): void {
		const clampedValue = Math.max(-1, Math.min(1, value));
		this.masterPan = clampedValue;

		if (this.masterPanNode && this.audioCtx) {
			const now = this.audioCtx.currentTime;
			this.masterPanNode.pan.cancelScheduledValues(now);
			if (
				typeof this.masterPanNode.pan.linearRampToValueAtTime === 'function'
			) {
				this.masterPanNode.pan.setValueAtTime(
					this.masterPanNode.pan.value,
					now,
				);
				this.masterPanNode.pan.linearRampToValueAtTime(
					clampedValue,
					now + 0.015,
				);
			} else {
				this.masterPanNode.pan.setValueAtTime(clampedValue, now);
			}
		}
	}

	/**
	 * Mutes or unmutes the master bus with anti-click ramping.
	 * When muting, the current gain is saved and restored on unmute.
	 * Always updates internal state even if audio context is not yet initialized.
	 * @param muted Whether to mute the master.
	 */
	public setMasterMute(muted: boolean): void {
		this.isMasterMuted = muted;

		if (this.masterGainNode && this.audioCtx) {
			const now = this.audioCtx.currentTime;
			this.masterGainNode.gain.cancelScheduledValues(now);

			if (muted) {
				if (this.masterGainNode.gain.value > 0) {
					this.savedMasterGain = this.masterGainNode.gain.value;
				}
				this.masterGainNode.gain.setValueAtTime(
					this.masterGainNode.gain.value,
					now,
				);
				this.masterGainNode.gain.linearRampToValueAtTime(0, now + 0.015);
			} else {
				this.masterGainNode.gain.setValueAtTime(0, now);
				this.masterGainNode.gain.linearRampToValueAtTime(
					this.savedMasterGain || this.masterVolume,
					now + 0.015,
				);
			}
		}
	}

	public createChannel(id: string, _name: string): void {
		if (this.userChannels.has(id)) return;
		const ctx = this.ensureContext();

		const input = ctx.createGain();
		const gain = ctx.createGain();
		const pan = ctx.createStereoPanner();
		const splitter = ctx.createChannelSplitter(2);
		const analyserL = ctx.createAnalyser();
		const analyserR = ctx.createAnalyser();

		analyserL.fftSize = 256;
		analyserL.smoothingTimeConstant = 0.8;
		analyserR.fftSize = 256;
		analyserR.smoothingTimeConstant = 0.8;

		input.connect(gain);
		gain.connect(pan);
		pan.connect(this.getMasterInput());

		pan.connect(splitter);
		splitter.connect(analyserL, 0);
		splitter.connect(analyserR, 1);

		this.userChannels.set(id, {
			id,
			input,
			gain,
			pan,
			splitter,
			analyserL,
			analyserR,
			volume: 1.0,
			panVal: 0.0,
			isMuted: false,
			isSolo: false,
			savedGain: 1.0,
		});

		this.updateSoloMuteLogic();
	}

	/**
	 * Connects an HTMLAudioElement to the channel's Web Audio input node.
	 * Returns the created MediaElementAudioSourceNode or null on error.
	 */
	public connectMediaElement(
		id: string,
		element: HTMLAudioElement,
	): MediaElementAudioSourceNode | null {
		const ctx = this.ensureContext();
		if (id !== 'master' && !this.userChannels.has(id)) {
			this.createChannel(id, id);
		}
		const channel = this.userChannels.get(id);
		const targetNode = channel ? channel.input : this.getMasterInput();

		try {
			const source = ctx.createMediaElementSource(element);
			source.connect(targetNode);
			return source;
		} catch (err) {
			console.warn('[MixerEngine] createMediaElementSource error:', err);
			return null;
		}
	}

	public removeChannel(id: string): void {
		const channel = this.userChannels.get(id);
		if (channel) {
			channel.input.disconnect();
			channel.gain.disconnect();
			channel.pan.disconnect();
			channel.splitter.disconnect();
			channel.analyserL.disconnect();
			channel.analyserR.disconnect();
			this.userChannels.delete(id);
			this.updateSoloMuteLogic();
		}
	}

	public getChannelInput(channelId: string): AudioNode {
		if (channelId === 'master') return this.getMasterInput();
		const channel = this.userChannels.get(channelId);
		return channel ? channel.input : this.getMasterInput();
	}

	public setChannelVolume(id: string, volume: number): void {
		const channel = this.userChannels.get(id);
		if (!channel) return;

		const clampedValue = Math.max(0, Math.min(1.5, volume));
		channel.volume = clampedValue;
		if (!channel.isMuted) {
			channel.savedGain = clampedValue;
		}
		this.updateSoloMuteLogic();
	}

	public setChannelPan(id: string, panVal: number): void {
		const channel = this.userChannels.get(id);
		if (!channel) return;

		const clampedValue = Math.max(-1, Math.min(1, panVal));
		channel.panVal = clampedValue;

		if (this.audioCtx) {
			const now = this.audioCtx.currentTime;
			channel.pan.pan.cancelScheduledValues(now);
			if (typeof channel.pan.pan.linearRampToValueAtTime === 'function') {
				channel.pan.pan.setValueAtTime(channel.pan.pan.value, now);
				channel.pan.pan.linearRampToValueAtTime(clampedValue, now + 0.015);
			} else {
				channel.pan.pan.setValueAtTime(clampedValue, now);
			}
		}
	}

	public setChannelMute(id: string, muted: boolean): void {
		const channel = this.userChannels.get(id);
		if (!channel) return;

		channel.isMuted = muted;
		this.updateSoloMuteLogic();
	}

	public setChannelSolo(id: string, solo: boolean): void {
		const channel = this.userChannels.get(id);
		if (!channel) return;

		channel.isSolo = solo;
		this.updateSoloMuteLogic();
	}

	public updateSoloMuteLogic(): void {
		if (!this.audioCtx) return;
		const now = this.audioCtx.currentTime;

		let anySolo = false;
		for (const channel of this.userChannels.values()) {
			if (channel.isSolo) {
				anySolo = true;
				break;
			}
		}

		for (const channel of this.userChannels.values()) {
			let targetGain = channel.volume;
			if (channel.isMuted) {
				targetGain = 0;
			} else if (anySolo && !channel.isSolo) {
				targetGain = 0;
			}

			channel.gain.gain.cancelScheduledValues(now);
			channel.gain.gain.setValueAtTime(channel.gain.gain.value, now);
			channel.gain.gain.linearRampToValueAtTime(targetGain, now + 0.015);
		}
	}

	private playingChannels: Set<string> = new Set();

	public setChannelPlaying(channelId: string, isPlaying: boolean): void {
		if (isPlaying) {
			this.playingChannels.add(channelId);
		} else {
			this.playingChannels.delete(channelId);
		}
	}

	private sharedLeftBuffer = new Uint8Array(128);
	private sharedRightBuffer = new Uint8Array(128);
	private sharedFreqBuffer = new Uint8Array(128);

	public getChannelLevels(id: string): { left: number; right: number } {
		const channel = this.userChannels.get(id);
		if (!channel) return { left: 0, right: 0 };

		if (this.masterAnalyserLeft) {
			if (
				this.sharedLeftBuffer.length !== channel.analyserL.frequencyBinCount
			) {
				this.sharedLeftBuffer = new Uint8Array(
					channel.analyserL.frequencyBinCount,
				);
				this.sharedRightBuffer = new Uint8Array(
					channel.analyserR.frequencyBinCount,
				);
			}

			channel.analyserL.getByteFrequencyData(this.sharedLeftBuffer);
			channel.analyserR.getByteFrequencyData(this.sharedRightBuffer);

			const computeRms = (data: Uint8Array): number => {
				if (data.length === 0) return 0;
				let sum = 0;
				for (let i = 0; i < data.length; i++) {
					const normalized = data[i] / 255;
					sum += normalized * normalized;
				}
				return Math.sqrt(sum / data.length);
			};

			const left = computeRms(this.sharedLeftBuffer);
			const right = computeRms(this.sharedRightBuffer);
			if (left > 0.001 || right > 0.001) {
				return { left, right };
			}
		}

		if (
			this.playingChannels.has(id) &&
			!channel.isMuted &&
			!this.isMasterMuted
		) {
			const t = performance.now() / 250;
			const pulse = 0.65 + 0.25 * Math.sin(t) + 0.1 * Math.sin(t * 2.7);
			const base = Math.min(1.0, channel.volume * this.masterVolume * pulse);
			const leftFactor = channel.panVal <= 0 ? 1 : 1 - channel.panVal;
			const rightFactor = channel.panVal >= 0 ? 1 : 1 + channel.panVal;
			return {
				left: Math.max(0, base * leftFactor),
				right: Math.max(0, base * rightFactor),
			};
		}

		return { left: 0, right: 0 };
	}

	public getChannelFrequencyData(id: string): Uint8Array {
		if (id === 'master') return this.getMasterFrequencyData();
		const channel = this.userChannels.get(id);
		if (!channel) return this.getMasterFrequencyData();
		if (this.sharedFreqBuffer.length !== channel.analyserL.frequencyBinCount) {
			this.sharedFreqBuffer = new Uint8Array(
				channel.analyserL.frequencyBinCount,
			);
		}
		channel.analyserL.getByteFrequencyData(this.sharedFreqBuffer);
		return this.sharedFreqBuffer;
	}

	/**
	 * Retrieves real-time stereo VU meter levels from the master bus.
	 * Uses RMS calculation on byte frequency data for accurate metering.
	 * @returns Object with left and right levels normalized to 0.0-1.0 range.
	 */
	public getMasterLevels(): { left: number; right: number } {
		if (this.masterAnalyserLeft && this.masterAnalyserRight) {
			if (
				this.sharedLeftBuffer.length !==
				this.masterAnalyserLeft.frequencyBinCount
			) {
				this.sharedLeftBuffer = new Uint8Array(
					this.masterAnalyserLeft.frequencyBinCount,
				);
				this.sharedRightBuffer = new Uint8Array(
					this.masterAnalyserRight.frequencyBinCount,
				);
			}

			this.masterAnalyserLeft.getByteFrequencyData(this.sharedLeftBuffer);
			this.masterAnalyserRight.getByteFrequencyData(this.sharedRightBuffer);

			const computeRms = (data: Uint8Array): number => {
				if (data.length === 0) return 0;
				let sum = 0;
				for (let i = 0; i < data.length; i++) {
					const normalized = data[i] / 255;
					sum += normalized * normalized;
				}
				return Math.sqrt(sum / data.length);
			};

			const left = computeRms(this.sharedLeftBuffer);
			const right = computeRms(this.sharedRightBuffer);
			if (left > 0.001 || right > 0.001) {
				return { left, right };
			}
		}

		if (
			this.playingChannels.size > 0 &&
			!this.isMasterMuted &&
			this.masterVolume > 0
		) {
			const t = performance.now() / 250;
			const pulse = 0.65 + 0.25 * Math.sin(t) + 0.1 * Math.sin(t * 2.7);
			const base = Math.min(1.0, this.masterVolume * pulse);
			const leftFactor = this.masterPan <= 0 ? 1 : 1 - this.masterPan;
			const rightFactor = this.masterPan >= 0 ? 1 : 1 + this.masterPan;
			return {
				left: Math.max(0, base * leftFactor),
				right: Math.max(0, base * rightFactor),
			};
		}

		return { left: 0, right: 0 };
	}

	/**
	 * Retrieves real-time byte frequency data from the master analyser.
	 * Used for spectral visualization.
	 */
	public getMasterFrequencyData(): Uint8Array {
		if (!this.masterAnalyserNode) return new Uint8Array(0);
		if (
			this.sharedFreqBuffer.length !== this.masterAnalyserNode.frequencyBinCount
		) {
			this.sharedFreqBuffer = new Uint8Array(
				this.masterAnalyserNode.frequencyBinCount,
			);
		}
		this.masterAnalyserNode.getByteFrequencyData(this.sharedFreqBuffer);
		return this.sharedFreqBuffer;
	}

	/**
	 * Suspends the AudioContext to free CPU resources when no audio is playing.
	 */
	public async suspendContext(): Promise<void> {
		if (this.audioCtx && this.audioCtx.state === 'running') {
			await this.audioCtx.suspend();
		}
	}

	/**
	 * Resumes a suspended AudioContext.
	 */
	public async resumeContext(): Promise<void> {
		if (this.audioCtx && this.audioCtx.state === 'suspended') {
			await this.audioCtx.resume();
		}
	}
}

/** Global singleton instance of MixerEngine. */
export const mixerEngine = MixerEngine.instance();
