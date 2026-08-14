import { vi } from 'vitest';

class LocalStorageMock implements Storage {
	private store = new Map<string, string>();

	get length(): number {
		return this.store.size;
	}

	clear(): void {
		this.store.clear();
	}

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null;
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	setItem(key: string, value: string): void {
		this.store.set(key, String(value));
	}
}

if (typeof globalThis.localStorage === 'undefined') {
	globalThis.localStorage = new LocalStorageMock();
}

if (typeof globalThis.window === 'undefined') {
	(globalThis as unknown as { window: unknown }).window = globalThis;
}

if (typeof globalThis.window.dispatchEvent === 'undefined') {
	globalThis.window.dispatchEvent = vi.fn();
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
	globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
		return setTimeout(() => cb(performance.now()), 0) as unknown as number;
	};
}

if (typeof globalThis.cancelAnimationFrame === 'undefined') {
	globalThis.cancelAnimationFrame = (id: number): void => {
		clearTimeout(id);
	};
}

if (typeof globalThis.CustomEvent === 'undefined') {
	(globalThis as unknown as { CustomEvent: unknown }).CustomEvent =
		class CustomEvent {
			constructor(
				public type: string,
				public params?: unknown,
			) {}
		};
}

type EventListenerCallback = (...args: unknown[]) => void;

class MockAudio {
	public src = '';
	public currentTime = 0;
	public duration = 100;
	public crossOrigin = '';
	private listeners: Record<string, EventListenerCallback[]> = {};

	public addEventListener(
		event: string,
		callback: EventListenerCallback,
	): void {
		if (!this.listeners[event]) this.listeners[event] = [];
		this.listeners[event].push(callback);
	}

	public removeEventListener(
		event: string,
		callback: EventListenerCallback,
	): void {
		if (this.listeners[event]) {
			this.listeners[event] = this.listeners[event].filter(
				(l) => l !== callback,
			);
		}
	}

	public dispatchEvent(event: string | { type: string }): boolean {
		const type = typeof event === 'string' ? event : event.type;
		this.listeners[type]?.forEach((cb) => {
			cb(event);
		});
		return true;
	}

	public load(): void {}

	public async play(): Promise<void> {
		this.dispatchEvent('play');
		return Promise.resolve();
	}

	public pause(): void {
		this.dispatchEvent('pause');
	}
}

if (typeof globalThis.Audio === 'undefined') {
	(globalThis as unknown as { Audio: unknown }).Audio = MockAudio;
}

class MockAudioContext {
	public state = 'suspended';
	public destination = {};
	public currentTime = 0;

	public createGain(): unknown {
		return {
			gain: {
				value: 1.0,
				setValueAtTime: vi.fn(),
				linearRampToValueAtTime: vi.fn(),
				cancelScheduledValues: vi.fn(),
			},
			connect: vi.fn(),
			disconnect: vi.fn(),
		};
	}

	public createStereoPanner(): unknown {
		return {
			pan: {
				value: 0,
				setValueAtTime: vi.fn(),
				linearRampToValueAtTime: vi.fn(),
				cancelScheduledValues: vi.fn(),
			},
			connect: vi.fn(),
			disconnect: vi.fn(),
		};
	}

	public createChannelSplitter(): unknown {
		return {
			connect: vi.fn(),
			disconnect: vi.fn(),
		};
	}

	public createAnalyser(): unknown {
		return {
			fftSize: 64,
			smoothingTimeConstant: 0.8,
			frequencyBinCount: 32,
			connect: vi.fn(),
			disconnect: vi.fn(),
			getByteFrequencyData: vi.fn(),
		};
	}

	public createMediaElementSource(): unknown {
		return {
			connect: vi.fn(),
			disconnect: vi.fn(),
		};
	}

	public async resume(): Promise<void> {
		this.state = 'running';
	}
}

if (typeof globalThis.AudioContext === 'undefined') {
	(globalThis as unknown as { AudioContext: unknown }).AudioContext =
		MockAudioContext;
}
