import type { MixerState } from '@core/model/MixerState';
import { createDefaultMixerState, createChannelState } from '@core/model/MixerState';
import { mixerEngine } from '@core/audio/MixerEngine';

/**
 * Callback function type for mixer state listeners.
 */
type MixerListener = () => void;

/**
 * Singleton reactive store managing mixer state and synchronizing
 * with the MixerEngine audio graph using immutable state updates for React compatibility.
 */
class MixerStore {
	private static _instance: MixerStore;

	private state: MixerState;
	private listeners: Set<MixerListener> = new Set();
	private _isOpen: boolean = false;
	private rafId: number | null = null;

	private constructor() {
		this.state = createDefaultMixerState();
	}

	/**
	 * Returns the singleton instance of MixerStore.
	 */
	public static instance(): MixerStore {
		if (!MixerStore._instance) {
			MixerStore._instance = new MixerStore();
		}
		return MixerStore._instance;
	}

	/**
	 * Subscribes a listener callback to mixer state changes.
	 * @param listener Function to invoke on state update.
	 * @returns Unsubscribe cleanup function.
	 */
	public subscribe(listener: MixerListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Notifies all listeners. If immediate is true (for discrete button clicks), notifies synchronously.
	 * Otherwise aligns with VSYNC (requestAnimationFrame) to batch continuous drag events.
	 */
	private notify(immediate = false): void {
		if (immediate) {
			if (this.rafId !== null) {
				cancelAnimationFrame(this.rafId);
				this.rafId = null;
			}
			this.listeners.forEach((l) => l());
			return;
		}

		if (this.rafId !== null) return;
		this.rafId = requestAnimationFrame(() => {
			this.rafId = null;
			this.listeners.forEach((l) => l());
		});
	}

	/**
	 * Returns the current mixer state snapshot.
	 */
	public getState(): MixerState {
		return this.state;
	}

	/**
	 * Returns whether the mixer panel is open.
	 */
	public get isOpen(): boolean {
		return this._isOpen;
	}

	/**
	 * Toggles the mixer panel open/closed state.
	 */
	public toggleOpen(): void {
		this._isOpen = !this._isOpen;
		this.notify(true);
	}

	/**
	 * Sets the mixer panel open/closed state.
	 */
	public setOpen(open: boolean): void {
		this._isOpen = open;
		this.notify(true);
	}

	/**
	 * Loads mixer state from persisted project data.
	 * Applies the loaded state to the MixerEngine.
	 * @param mixerData Partial mixer state from project JSON.
	 */
	public loadState(mixerData?: Partial<MixerState>): void {
		if (mixerData) {
			this.state = {
				master: {
					...createDefaultMixerState().master,
					...(mixerData.master || {}),
					id: 'master',
				},
				channels: (mixerData.channels || []).map((ch) => ({ ...ch })),
			};
		} else {
			this.state = createDefaultMixerState();
		}

		mixerEngine.setMasterVolume(this.state.master.volume);
		mixerEngine.setMasterPan(this.state.master.pan);
		mixerEngine.setMasterMute(this.state.master.isMuted);

		this.state.channels.forEach(ch => {
			mixerEngine.createChannel(ch.id, ch.name);
			mixerEngine.setChannelVolume(ch.id, ch.volume);
			mixerEngine.setChannelPan(ch.id, ch.pan);
			mixerEngine.setChannelMute(ch.id, ch.isMuted);
			mixerEngine.setChannelSolo(ch.id, ch.isSolo);
		});

		this.notify(true);
	}

	/**
	 * Sets the master volume and syncs with the audio engine.
	 * Uses immutable state update so React detects state object reference change.
	 * @param volume Linear volume (0.0 to 1.5).
	 */
	public setMasterVolume(volume: number): void {
		const clamped = Math.max(0, Math.min(1.5, volume));
		this.state = {
			...this.state,
			master: {
				...this.state.master,
				volume: clamped,
			},
		};
		mixerEngine.setMasterVolume(clamped);
		this.notify(false);
	}

	/**
	 * Sets the master pan and syncs with the audio engine.
	 * Uses immutable state update so React detects state object reference change.
	 * @param pan Pan value (-1.0 to 1.0).
	 */
	public setMasterPan(pan: number): void {
		const clamped = Math.max(-1, Math.min(1, pan));
		this.state = {
			...this.state,
			master: {
				...this.state.master,
				pan: clamped,
			},
		};
		mixerEngine.setMasterPan(clamped);
		this.notify(false);
	}

	/**
	 * Toggles the master mute state.
	 * Uses immutable state update for instant React UI re-render.
	 */
	public toggleMasterMute(): void {
		this.state = {
			...this.state,
			master: {
				...this.state.master,
				isMuted: !this.state.master.isMuted,
			},
		};
		mixerEngine.setMasterMute(this.state.master.isMuted);
		this.notify(true);
	}

	/**
	 * Toggles the master solo state.
	 * Uses immutable state update for instant React UI re-render.
	 */
	public toggleMasterSolo(): void {
		this.state = {
			...this.state,
			master: {
				...this.state.master,
				isSolo: !this.state.master.isSolo,
			},
		};
		this.notify(true);
	}

	public addChannel(name?: string): string {
		const count = this.state.channels.length + 1;
		const id = `ch-${Date.now()}-${count}`;
		const channelName = name || `Channel ${count}`;
		
		const newChannel = createChannelState(id, channelName);
		
		this.state = {
			...this.state,
			channels: [...this.state.channels, newChannel]
		};
		
		mixerEngine.createChannel(id, channelName);
		this.notify(true);
		
		return id;
	}

	public removeChannel(id: string): void {
		this.state = {
			...this.state,
			channels: this.state.channels.filter(ch => ch.id !== id)
		};
		mixerEngine.removeChannel(id);
		this.notify(true);
	}

	public setChannelVolume(id: string, volume: number): void {
		const clamped = Math.max(0, Math.min(1.5, volume));
		this.state = {
			...this.state,
			channels: this.state.channels.map(ch => 
				ch.id === id ? { ...ch, volume: clamped } : ch
			)
		};
		mixerEngine.setChannelVolume(id, clamped);
		this.notify(false);
	}

	public setChannelPan(id: string, pan: number): void {
		const clamped = Math.max(-1, Math.min(1, pan));
		this.state = {
			...this.state,
			channels: this.state.channels.map(ch => 
				ch.id === id ? { ...ch, pan: clamped } : ch
			)
		};
		mixerEngine.setChannelPan(id, clamped);
		this.notify(false);
	}

	public toggleChannelMute(id: string): void {
		const channel = this.state.channels.find(ch => ch.id === id);
		if (!channel) return;
		const newMuted = !channel.isMuted;
		
		this.state = {
			...this.state,
			channels: this.state.channels.map(ch => 
				ch.id === id ? { ...ch, isMuted: newMuted } : ch
			)
		};
		mixerEngine.setChannelMute(id, newMuted);
		this.notify(true);
	}

	public toggleChannelSolo(id: string): void {
		const channel = this.state.channels.find(ch => ch.id === id);
		if (!channel) return;
		const newSolo = !channel.isSolo;
		
		this.state = {
			...this.state,
			channels: this.state.channels.map(ch => 
				ch.id === id ? { ...ch, isSolo: newSolo } : ch
			)
		};
		mixerEngine.setChannelSolo(id, newSolo);
		this.notify(true);
	}
}

/** Global singleton instance of MixerStore. */
export const mixerStore = MixerStore.instance();
