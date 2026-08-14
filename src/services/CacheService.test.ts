import { clearBlobUrlCache, getBlobUrlCacheSize } from '@core/utils/mediaUtils';
import {
	clearWaveformCache,
	getWaveformCacheSize,
} from '@core/utils/WaveformService';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from './CacheService';

vi.mock('@core/utils/mediaUtils', () => ({
	getBlobUrlCacheSize: vi.fn(),
	clearBlobUrlCache: vi.fn(),
}));

vi.mock('@core/utils/WaveformService', () => ({
	getWaveformCacheSize: vi.fn(),
	clearWaveformCache: vi.fn(),
}));

describe('CacheService', () => {
	let service: CacheService;

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		delete (window as unknown as { caches?: unknown }).caches;
		service = CacheService.instance();
	});

	it('should return the singleton instance', () => {
		expect(service).toBe(CacheService.instance());
	});

	describe('getCacheStats', () => {
		it('should return breakdown of blob urls, waveform peaks and local backups', () => {
			vi.mocked(getBlobUrlCacheSize).mockReturnValue(5);
			vi.mocked(getWaveformCacheSize).mockReturnValue(3);
			localStorage.setItem('soundref_project_p1_bak', '{"id":"p1"}');
			localStorage.setItem('soundref_project_p2_bak', '{"id":"p2"}');
			localStorage.setItem('soundref_app_settings', '{}');

			const stats = service.getCacheStats();
			expect(stats.blobUrls).toBe(5);
			expect(stats.waveformPeaks).toBe(3);
			expect(stats.localStorageBackups).toBe(2);
			expect(stats.total).toBe(10);
		});

		it('should return 0 when caches are empty', () => {
			vi.mocked(getBlobUrlCacheSize).mockReturnValue(0);
			vi.mocked(getWaveformCacheSize).mockReturnValue(0);

			const stats = service.getCacheStats();
			expect(stats.blobUrls).toBe(0);
			expect(stats.waveformPeaks).toBe(0);
			expect(stats.localStorageBackups).toBe(0);
			expect(stats.total).toBe(0);
		});
	});

	describe('clearBlobUrls', () => {
		it('should delegate to clearBlobUrlCache and return cleared count', () => {
			vi.mocked(clearBlobUrlCache).mockReturnValue(4);
			const count = service.clearBlobUrls();
			expect(clearBlobUrlCache).toHaveBeenCalled();
			expect(count).toBe(4);
		});
	});

	describe('clearWaveforms', () => {
		it('should delegate to clearWaveformCache and return cleared count', () => {
			vi.mocked(clearWaveformCache).mockReturnValue(7);
			const count = service.clearWaveforms();
			expect(clearWaveformCache).toHaveBeenCalled();
			expect(count).toBe(7);
		});
	});

	describe('clearLocalStorageBackups', () => {
		it('should remove all soundref_project_*_bak keys and leave other keys intact', () => {
			localStorage.setItem('soundref_project_1_bak', 'data1');
			localStorage.setItem('soundref_project_2_bak', 'data2');
			localStorage.setItem('soundref_app_settings', 'settings');
			localStorage.setItem('other_key', 'value');

			const removedCount = service.clearLocalStorageBackups();
			expect(removedCount).toBe(2);
			expect(localStorage.getItem('soundref_project_1_bak')).toBeNull();
			expect(localStorage.getItem('soundref_project_2_bak')).toBeNull();
			expect(localStorage.getItem('soundref_app_settings')).toBe('settings');
			expect(localStorage.getItem('other_key')).toBe('value');
		});
	});

	describe('clearWebCaches', () => {
		it('should delete caches when window.caches is available', async () => {
			const mockDelete = vi.fn().mockResolvedValue(true);
			const mockKeys = vi.fn().mockResolvedValue(['cache-v1', 'cache-v2']);
			(
				window as unknown as {
					caches: { keys: typeof mockKeys; delete: typeof mockDelete };
				}
			).caches = {
				keys: mockKeys,
				delete: mockDelete,
			};

			const deleted = await service.clearWebCaches();
			expect(mockKeys).toHaveBeenCalled();
			expect(mockDelete).toHaveBeenCalledTimes(2);
			expect(deleted).toBe(2);
		});
	});

	describe('clearAll', () => {
		it('should clear all caches and return consolidated summary', async () => {
			vi.mocked(clearBlobUrlCache).mockReturnValue(3);
			vi.mocked(clearWaveformCache).mockReturnValue(2);
			localStorage.setItem('soundref_project_test_bak', 'backup');

			const result = await service.clearAll();
			expect(result.blobUrlsCleared).toBe(3);
			expect(result.waveformPeaksCleared).toBe(2);
			expect(result.localStorageBackupsCleared).toBe(1);
			expect(result.totalCleared).toBe(6);
		});
	});
});
