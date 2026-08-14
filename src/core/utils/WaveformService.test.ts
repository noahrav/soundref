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
});
