import { mixerStore } from '@core/audio/MixerStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('MixerStore', () => {
	beforeEach(() => {
		const state = mixerStore.getState();
		state.channels.forEach((ch) => {
			mixerStore.removeChannel(ch.id);
		});
		mixerStore.setMasterVolume(1.0);
		mixerStore.setMasterPan(0.0);
		if (state.master.isMuted) mixerStore.toggleMasterMute();
		if (state.master.isSolo) mixerStore.toggleMasterSolo();
	});

	it('should return initial master mixer state', () => {
		const state = mixerStore.getState();
		expect(state.master).toBeDefined();
		expect(state.master.id).toBe('master');
		expect(state.master.volume).toBe(1.0);
		expect(state.master.pan).toBe(0.0);
		expect(state.master.isMuted).toBe(false);
	});

	it('should update master volume, pan, and mute toggles', () => {
		mixerStore.setMasterVolume(0.8);
		expect(mixerStore.getState().master.volume).toBe(0.8);

		mixerStore.setMasterPan(0.5);
		expect(mixerStore.getState().master.pan).toBe(0.5);

		mixerStore.toggleMasterMute();
		expect(mixerStore.getState().master.isMuted).toBe(true);

		mixerStore.toggleMasterMute();
		expect(mixerStore.getState().master.isMuted).toBe(false);
	});

	it('should manage dynamic user channels', () => {
		const chId = mixerStore.addChannel('Drums');
		expect(chId).toBeDefined();

		let state = mixerStore.getState();
		expect(state.channels.length).toBe(1);
		expect(state.channels[0].name).toBe('Drums');

		mixerStore.setChannelVolume(chId, 1.2);
		mixerStore.setChannelPan(chId, -0.3);
		mixerStore.toggleChannelMute(chId);
		mixerStore.toggleChannelSolo(chId);

		state = mixerStore.getState();
		expect(state.channels[0].volume).toBe(1.2);
		expect(state.channels[0].pan).toBe(-0.3);
		expect(state.channels[0].isMuted).toBe(true);
		expect(state.channels[0].isSolo).toBe(true);

		mixerStore.removeChannel(chId);
		expect(mixerStore.getState().channels.length).toBe(0);
	});

	it('should notify subscribers on state change', () => {
		const listener = vi.fn();
		const unsubscribe = mixerStore.subscribe(listener);

		mixerStore.toggleMasterMute();
		expect(listener).toHaveBeenCalled();

		unsubscribe();
	});

	it('should load and restore mixer state snapshot', () => {
		mixerStore.loadState({
			master: {
				id: 'master',
				name: 'Master',
				volume: 0.9,
				pan: 0.1,
				isMuted: false,
				isSolo: false,
			},
			channels: [
				{
					id: 'ch-custom-1',
					name: 'Bass',
					volume: 1.1,
					pan: -0.2,
					isMuted: false,
					isSolo: true,
				},
			],
		});

		const state = mixerStore.getState();
		expect(state.master.volume).toBe(0.9);
		expect(state.channels.length).toBe(1);
		expect(state.channels[0].name).toBe('Bass');
		expect(state.channels[0].isSolo).toBe(true);
	});
});
