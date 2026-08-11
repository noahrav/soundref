/**
 * Represents the state of a mixer channel.
 */
export interface ChannelState {
	/** Channel identifier: 'master' for master bus, 'ch-{n}' for user channels */
	id: string;
	/** Display name of the channel */
	name: string;
	/** Volume level: 0.0 (silence) to 1.5 (+3.5dB headroom). 1.0 = unity gain (0dB) */
	volume: number;
	/** Stereo pan position: -1.0 (full left) to 1.0 (full right). 0.0 = center */
	pan: number;
	/** Whether the channel output is muted */
	isMuted: boolean;
	/** Whether the channel is soloed */
	isSolo: boolean;
}

/**
 * Complete mixer state persisted in project data.
 */
export interface MixerState {
	/** Master bus channel state */
	master: ChannelState;
	/** User-created mixer channels */
	channels: ChannelState[];
}

/**
 * Creates a default master channel state.
 */
export function createDefaultMasterState(): ChannelState {
	return {
		id: 'master',
		name: 'Master',
		volume: 1.0,
		pan: 0.0,
		isMuted: false,
		isSolo: false,
	};
}

/**
 * Creates a new channel state.
 */
export function createChannelState(id: string, name: string): ChannelState {
	return {
		id,
		name,
		volume: 1.0,
		pan: 0.0,
		isMuted: false,
		isSolo: false,
	};
}

/**
 * Creates a default mixer state with only a master channel.
 */
export function createDefaultMixerState(): MixerState {
	return {
		master: createDefaultMasterState(),
		channels: [],
	};
}

/**
 * Converts a linear volume value (0.0-1.5) to decibels.
 * @param value Linear volume value.
 * @returns Volume in dB. Returns -Infinity for 0.
 */
export function volumeToDb(value: number): number {
	if (value <= 0) return -Infinity;
	return 20 * Math.log10(value);
}

/**
 * Converts decibels to a linear volume value.
 * @param db Volume in decibels.
 * @returns Linear volume value.
 */
export function dbToVolume(db: number): number {
	if (db === -Infinity) return 0;
	return Math.pow(10, db / 20);
}
