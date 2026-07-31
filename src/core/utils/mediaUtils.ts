import { convertFileSrc } from '@tauri-apps/api/core';
import { DesktopBridge } from '../persistence/DesktopBridge';

/**
 * Returns the MIME type string corresponding to a file extension.
 * @param path File path string.
 * @returns MIME type string.
 */
export function getMimeType(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase() || '';
	switch (ext) {
		case 'mp3':
			return 'audio/mpeg';
		case 'wav':
			return 'audio/wav';
		case 'flac':
			return 'audio/flac';
		case 'ogg':
			return 'audio/ogg';
		case 'm4a':
		case 'aac':
			return 'audio/aac';
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'webp':
			return 'image/webp';
		case 'gif':
			return 'image/gif';
		case 'svg':
			return 'image/svg+xml';
		default:
			return 'application/octet-stream';
	}
}

/**
 * Resolves a file system path or web URL into a browser loadable asset URL.
 * Automatically converts local Tauri desktop file paths using convertFileSrc.
 * @param path Raw file system path or URL string.
 * @returns Resolved media URL string.
 */
export function getLocalMediaUrl(path: string | undefined | null): string {
	if (!path) return '';

	if (
		path.startsWith('http://') ||
		path.startsWith('https://') ||
		path.startsWith('blob:') ||
		path.startsWith('data:') ||
		path.startsWith('asset://')
	) {
		return path;
	}

	let cleanPath = path.trim();
	if (cleanPath.startsWith('file://')) {
		cleanPath = cleanPath.replace(/^file:\/\//, '');
	}

	if (DesktopBridge.isTauri()) {
		try {
			return convertFileSrc(cleanPath);
		} catch (err) {
			console.error('[getLocalMediaUrl] convertFileSrc error:', err);
		}
	}

	if (cleanPath.startsWith('/')) return `file://${cleanPath}`;
	if (cleanPath.match(/^[a-zA-Z]:[/\\]/)) {
		return `file:///${cleanPath.replace(/\\/g, '/')}`;
	}

	return cleanPath;
}

/**
 * Asynchronously resolves a media path to a usable URL string.
 * @param path Raw media path or URL.
 * @returns Promise resolving to the usable URL string.
 */
export function resolveMediaUrl(
	path: string | undefined | null,
): Promise<string> {
	return Promise.resolve(getLocalMediaUrl(path));
}

/**
 * React hook returning resolved loadable media URL for a given input path.
 * @param url Raw media path or URL.
 * @returns Loadable media URL string.
 */
export function useMediaUrl(url: string | undefined | null): string {
	return getLocalMediaUrl(url);
}

const blobUrlCache = new Map<string, string>();

/**
 * Reads binary data for local desktop files and creates an in-memory Blob URL.
 * Useful for bypassing CORS or Tauri protocol restrictions for audio elements.
 * @param path File system path string.
 * @returns Promise resolving to created Blob URL or null.
 */
export async function getBlobUrlForFile(
	path: string | undefined | null,
): Promise<string | null> {
	if (!path) return null;

	if (
		path.startsWith('http://') ||
		path.startsWith('https://') ||
		path.startsWith('blob:') ||
		path.startsWith('data:')
	) {
		return path;
	}

	let cleanPath = path.trim();
	if (cleanPath.startsWith('file://')) {
		cleanPath = cleanPath.replace(/^file:\/\//, '');
	}

	const cached = blobUrlCache.get(cleanPath);
	if (cached) {
		return cached;
	}

	if (DesktopBridge.isTauri()) {
		try {
			const buffer = await DesktopBridge.readFileBinary(cleanPath);
			if (buffer && buffer.byteLength > 0) {
				const mime = getMimeType(cleanPath);
				const blob = new Blob([buffer], { type: mime });
				const blobUrl = URL.createObjectURL(blob);
				blobUrlCache.set(cleanPath, blobUrl);
				return blobUrl;
			}
		} catch (err) {
			console.warn('[getBlobUrlForFile] Failed to create blob URL:', err);
		}
	}

	return null;
}

/**
 * Revokes a single cached Blob URL for a given file path and deletes it from cache.
 * @param path File system path string.
 */
export function revokeBlobUrlForFile(path: string | undefined | null): void {
	if (!path) return;
	let cleanPath = path.trim();
	if (cleanPath.startsWith('file://')) {
		cleanPath = cleanPath.replace(/^file:\/\//, '');
	}

	const cached = blobUrlCache.get(cleanPath);
	if (cached) {
		if (cached.startsWith('blob:')) {
			URL.revokeObjectURL(cached);
		}
		blobUrlCache.delete(cleanPath);
	}
}

/**
 * Revokes all cached Blob URLs and clears the blobUrlCache Map.
 * Prevents memory leaks when switching projects or unmounting boards.
 */
export function clearBlobUrlCache(): void {
	blobUrlCache.forEach((url) => {
		if (url.startsWith('blob:')) {
			URL.revokeObjectURL(url);
		}
	});
	blobUrlCache.clear();
}
