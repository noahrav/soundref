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
			this.audioCtx = new AudioContextClass();
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
		const ctx = this.audioCtx!;

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
		this.ensureContext();
		return this.masterInputNode!;
	}

	/**
	 * Sets the master volume with immediate response for real-time slider dragging.
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
				this.isMasterMuted ? 0 : clampedValue,
				now,
			);
		}
	}

	/**
	 * Sets the master pan position with immediate response for real-time slider dragging.
	 * Stores state so it works even if audio context/nodes aren't created yet.
	 * @param value Pan value from -1.0 (left) to 1.0 (right).
	 */
	public setMasterPan(value: number): void {
		const clampedValue = Math.max(-1, Math.min(1, value));
		this.masterPan = clampedValue;

		if (this.masterPanNode && this.audioCtx) {
			const now = this.audioCtx.currentTime;
			this.masterPanNode.pan.cancelScheduledValues(now);
			this.masterPanNode.pan.setValueAtTime(clampedValue, now);
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
				this.masterGainNode.gain.linearRampToValueAtTime(0, now + 0.01);
			} else {
				this.masterGainNode.gain.setValueAtTime(0, now);
				this.masterGainNode.gain.linearRampToValueAtTime(
					this.savedMasterGain || this.masterVolume,
					now + 0.01,
				);
			}
		}
	}

	/**
	 * Retrieves real-time stereo VU meter levels from the master bus.
	 * Uses RMS calculation on byte frequency data for accurate metering.
	 * @returns Object with left and right levels normalized to 0.0-1.0 range.
	 */
	public getMasterLevels(): { left: number; right: number } {
		if (!this.masterAnalyserLeft || !this.masterAnalyserRight) {
			return { left: 0, right: 0 };
		}

		const leftData = new Uint8Array(
			this.masterAnalyserLeft.frequencyBinCount,
		);
		const rightData = new Uint8Array(
			this.masterAnalyserRight.frequencyBinCount,
		);

		this.masterAnalyserLeft.getByteFrequencyData(leftData);
		this.masterAnalyserRight.getByteFrequencyData(rightData);

		const computeRms = (data: Uint8Array): number => {
			if (data.length === 0) return 0;
			let sum = 0;
			for (let i = 0; i < data.length; i++) {
				const normalized = data[i] / 255;
				sum += normalized * normalized;
			}
			return Math.sqrt(sum / data.length);
		};

		return {
			left: computeRms(leftData),
			right: computeRms(rightData),
		};
	}

	/**
	 * Retrieves real-time byte frequency data from the master analyser.
	 * Used for spectral visualization.
	 */
	public getMasterFrequencyData(): Uint8Array {
		if (!this.masterAnalyserNode) return new Uint8Array(0);
		const data = new Uint8Array(
			this.masterAnalyserNode.frequencyBinCount,
		);
		this.masterAnalyserNode.getByteFrequencyData(data);
		return data;
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
