import { mixerEngine } from '@core/audio/MixerEngine';
import { beforeEach, describe, expect, it } from 'vitest';

describe('MixerEngine', () => {
	beforeEach(() => {
		mixerEngine.removeChannel('ch-test-1');
		mixerEngine.removeChannel('ch-test-2');
		mixerEngine.setMasterVolume(1.0);
		mixerEngine.setMasterPan(0.0);
		mixerEngine.setMasterMute(false);
	});

	it('should return master input node', () => {
		const node = mixerEngine.getMasterInput();
		expect(node).toBeDefined();
	});

	it('should update master volume, pan, and mute states', () => {
		mixerEngine.setMasterVolume(0.8);
		mixerEngine.setMasterPan(-0.5);
		mixerEngine.setMasterMute(true);

		const levels = mixerEngine.getMasterLevels();
		expect(levels).toEqual({ left: 0, right: 0 });

		mixerEngine.setMasterMute(false);
	});

	it('should dynamically create and remove user channels', () => {
		mixerEngine.createChannel('ch-test-1', 'Channel 1');
		const inputNode = mixerEngine.getChannelInput('ch-test-1');
		expect(inputNode).toBeDefined();
		expect(inputNode).not.toBe(mixerEngine.getMasterInput());

		const levels = mixerEngine.getChannelLevels('ch-test-1');
		expect(levels).toEqual({ left: 0, right: 0 });

		mixerEngine.removeChannel('ch-test-1');
		expect(mixerEngine.getChannelInput('ch-test-1')).toBe(
			mixerEngine.getMasterInput(),
		);
	});

	it('should update channel volume, pan, mute, and solo', () => {
		mixerEngine.createChannel('ch-test-1', 'Channel 1');
		mixerEngine.createChannel('ch-test-2', 'Channel 2');

		mixerEngine.setChannelVolume('ch-test-1', 1.2);
		mixerEngine.setChannelPan('ch-test-1', 0.5);
		mixerEngine.setChannelMute('ch-test-1', true);
		mixerEngine.setChannelSolo('ch-test-2', true);

		const freqData = mixerEngine.getChannelFrequencyData('ch-test-1');
		expect(freqData).toBeDefined();

		mixerEngine.removeChannel('ch-test-1');
		mixerEngine.removeChannel('ch-test-2');
	});
});
