import { clearBlobUrlCache, getBlobUrlCacheSize } from '@core/utils/mediaUtils';
import {
	clearWaveformCache,
	getWaveformCacheSize,
} from '@core/utils/WaveformService';

/**
 * Cache statistics breakdown interface.
 */
export interface CacheStats {
	/** Number of in-memory audio/image Blob URLs */
	blobUrls: number;
	/** Number of cached waveform peak arrays */
	waveformPeaks: number;
	/** Number of temporary project backup snapshots in localStorage */
	localStorageBackups: number;
	/** Total number of cached items */
	total: number;
}

/**
 * Result returned after clearing caches.
 */
export interface ClearCacheResult {
	blobUrlsCleared: number;
	waveformPeaksCleared: number;
	localStorageBackupsCleared: number;
	webCachesCleared: number;
	totalCleared: number;
}

/**
 * Service managing in-memory and temporary storage caches across the application.
 */
export class CacheService {
	private static _instance: CacheService;

	private constructor() {}

	/**
	 * Returns the singleton instance of CacheService.
	 */
	public static instance(): CacheService {
		if (!CacheService._instance) {
			CacheService._instance = new CacheService();
		}
		return CacheService._instance;
	}

	/**
	 * Collects current statistics on all cached resources across the app.
	 * @returns CacheStats object containing item counts.
	 */
	public getCacheStats(): CacheStats {
		const blobUrls = getBlobUrlCacheSize();
		const waveformPeaks = getWaveformCacheSize();
		let localStorageBackups = 0;

		try {
			if (typeof localStorage !== 'undefined') {
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key?.startsWith('soundref_project_') && key.endsWith('_bak')) {
						localStorageBackups++;
					}
				}
			}
		} catch {
			// localStorage might be unavailable or throw in restricted contexts
		}

		return {
			blobUrls,
			waveformPeaks,
			localStorageBackups,
			total: blobUrls + waveformPeaks + localStorageBackups,
		};
	}

	/**
	 * Clears in-memory Blob URLs for audio and image files.
	 * @returns Number of revoked and deleted Blob URLs.
	 */
	public clearBlobUrls(): number {
		return clearBlobUrlCache();
	}

	/**
	 * Clears cached waveform peak calculations.
	 * @returns Number of cleared waveform entries.
	 */
	public clearWaveforms(): number {
		return clearWaveformCache();
	}

	/**
	 * Removes temporary backup snapshots from localStorage.
	 * @returns Number of removed backup entries.
	 */
	public clearLocalStorageBackups(): number {
		let count = 0;
		try {
			if (typeof localStorage !== 'undefined') {
				const keysToRemove: string[] = [];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key?.startsWith('soundref_project_') && key.endsWith('_bak')) {
						keysToRemove.push(key);
					}
				}
				for (const key of keysToRemove) {
					localStorage.removeItem(key);
					count++;
				}
			}
		} catch (e) {
			console.warn('[CacheService] Error clearing localStorage backups:', e);
		}
		return count;
	}

	/**
	 * Clears browser CacheStorage entries (window.caches) if available.
	 * @returns Promise resolving to number of cache keys deleted.
	 */
	public async clearWebCaches(): Promise<number> {
		let count = 0;
		try {
			if (
				typeof window !== 'undefined' &&
				'caches' in window &&
				window.caches
			) {
				const keys = await window.caches.keys();
				for (const key of keys) {
					const deleted = await window.caches.delete(key);
					if (deleted) count++;
				}
			}
		} catch (e) {
			console.warn('[CacheService] Error clearing Web CacheStorage:', e);
		}
		return count;
	}

	/**
	 * Completely clears all application caches:
	 * - Revokes in-memory Blob URLs
	 * - Purges computed waveform peaks
	 * - Cleans temporary localStorage backup snapshots
	 * - Flushes browser CacheStorage
	 * @returns Promise resolving to detailed ClearCacheResult.
	 */
	public async clearAll(): Promise<ClearCacheResult> {
		const blobUrlsCleared = this.clearBlobUrls();
		const waveformPeaksCleared = this.clearWaveforms();
		const localStorageBackupsCleared = this.clearLocalStorageBackups();
		const webCachesCleared = await this.clearWebCaches();

		const totalCleared =
			blobUrlsCleared +
			waveformPeaksCleared +
			localStorageBackupsCleared +
			webCachesCleared;

		return {
			blobUrlsCleared,
			waveformPeaksCleared,
			localStorageBackupsCleared,
			webCachesCleared,
			totalCleared,
		};
	}
}
