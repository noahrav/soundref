import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearWaveformCache,
	generateFallbackPeaks,
	getOrExtractWaveformPeaks,
	getWaveformCacheSize,
} from './WaveformService';

describe('WaveformService', () => {
	beforeEach(() => {
		clearWaveformCache();
	});

	it('should return fallback peaks for empty key', async () => {
		const peaks = await getOrExtractWaveformPeaks(
			'',
			'http://example.com/audio.mp3',
			undefined,
			50,
		);
		expect(peaks).toHaveLength(50);
		expect(getWaveformCacheSize()).toBe(0);
	});

	it('should generate fallback peaks with generateFallbackPeaks', () => {
		const peaks = generateFallbackPeaks(100);
		expect(peaks).toHaveLength(100);
		expect(peaks.every((p) => p >= 0 && p <= 1)).toBe(true);
	});

	it('should cache peaks and track cache size, then clear cache', async () => {
		// Mock fetch failure to trigger fallback peak generation and caching
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

		expect(getWaveformCacheSize()).toBe(0);

		const peaks1 = await getOrExtractWaveformPeaks(
			'track-1',
			'http://example.com/song1.mp3',
			undefined,
			100,
		);
		expect(peaks1).toHaveLength(100);
		expect(getWaveformCacheSize()).toBe(1);

		const peaks2 = await getOrExtractWaveformPeaks(
			'track-2',
			'http://example.com/song2.mp3',
			undefined,
			100,
		);
		expect(peaks2).toHaveLength(100);
		expect(getWaveformCacheSize()).toBe(2);

		// Second call with same key should return cached instance
		const cachedPeaks1 = await getOrExtractWaveformPeaks(
			'track-1',
			'http://example.com/song1.mp3',
		);
		expect(cachedPeaks1).toBe(peaks1);
		expect(getWaveformCacheSize()).toBe(2);

		const clearedCount = clearWaveformCache();
		expect(clearedCount).toBe(2);
		expect(getWaveformCacheSize()).toBe(0);
	});

	it('should fast-extract peaks from WAV PCM data via DesktopBridge in Tauri', async () => {
		const { DesktopBridge } = await import('@core/persistence/DesktopBridge');
		const { ProjectService } = await import('@services/ProjectService');

		vi.spyOn(DesktopBridge, 'isTauri').mockReturnValue(true);
		vi.spyOn(ProjectService, 'instance').mockReturnValue({
			getActiveProject: () => ({ path: '/home/user/project' }),
		} as any);

		const wavBuffer = createMockWavBuffer(500);
		vi.spyOn(DesktopBridge, 'readFileSize').mockResolvedValue(
			wavBuffer.byteLength,
		);
		vi.spyOn(DesktopBridge, 'readFileBinaryChunk').mockResolvedValue(wavBuffer);

		const peaks = await getOrExtractWaveformPeaks(
			'wav-track-1',
			'assets/song.wav',
			'assets/song.wav',
			50,
		);

		expect(peaks).toHaveLength(50);
		expect(peaks.every((p) => p >= 0.05 && p <= 1)).toBe(true);
		expect(getWaveformCacheSize()).toBe(1);
	});
});

function createMockWavBuffer(sampleCount: number = 1000): ArrayBuffer {
	const buffer = new ArrayBuffer(44 + sampleCount * 2);
	const view = new DataView(buffer);
	// RIFF
	view.setUint8(0, 0x52);
	view.setUint8(1, 0x49);
	view.setUint8(2, 0x46);
	view.setUint8(3, 0x46);
	view.setUint32(4, 36 + sampleCount * 2, true);
	// WAVE
	view.setUint8(8, 0x57);
	view.setUint8(9, 0x41);
	view.setUint8(10, 0x56);
	view.setUint8(11, 0x45);
	// fmt
	view.setUint8(12, 0x66);
	view.setUint8(13, 0x6d);
	view.setUint8(14, 0x74);
	view.setUint8(15, 0x20);
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // 1 channel
	view.setUint32(24, 44100, true);
	view.setUint32(28, 44100 * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true); // 16-bit
	// data
	view.setUint8(36, 0x64);
	view.setUint8(37, 0x61);
	view.setUint8(38, 0x74);
	view.setUint8(39, 0x61);
	view.setUint32(40, sampleCount * 2, true);
	for (let i = 0; i < sampleCount; i++) {
		view.setInt16(44 + i * 2, Math.sin(i * 0.1) * 20000, true);
	}
	return buffer;
}
