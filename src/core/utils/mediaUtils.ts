import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { ProjectService } from '@services/ProjectService';
import { convertFileSrc } from '@tauri-apps/api/core';

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

let cachedMediaServerPort: number | null = null;

if (typeof window !== 'undefined' && DesktopBridge.isTauri()) {
	DesktopBridge.getMediaServerPort()
		.then((port) => {
			if (port > 0) {
				cachedMediaServerPort = port;
			}
		})
		.catch(() => {});
}

/**
 * Resolves a file system path or web URL into a browser loadable asset URL.
 * Automatically uses the embedded high-performance localhost streaming server in Tauri.
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

	if (!cleanPath.startsWith('/') && !cleanPath.match(/^[a-zA-Z]:[/\\]/)) {
		const activeProject = ProjectService.instance().getActiveProject();
		if (activeProject?.path) {
			const projectDir = activeProject.path.replace(/[/\\]+$/, '');
			cleanPath = `${projectDir}/${cleanPath}`;
		}
	}

	if (DesktopBridge.isTauri()) {
		if (cachedMediaServerPort && cachedMediaServerPort > 0) {
			return `http://127.0.0.1:${cachedMediaServerPort}/stream?path=${encodeURIComponent(cleanPath)}`;
		}
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
export async function resolveMediaUrl(
	path: string | undefined | null,
): Promise<string> {
	if (!path) return '';
	if (DesktopBridge.isTauri() && cachedMediaServerPort === null) {
		try {
			const port = await DesktopBridge.getMediaServerPort();
			if (port > 0) cachedMediaServerPort = port;
		} catch {}
	}
	return getLocalMediaUrl(path);
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
 * Size threshold (in bytes) above which files are read in chunks
 * to avoid Tauri IPC payload truncation. 20 MB.
 */
const CHUNKED_READ_THRESHOLD = 20 * 1024 * 1024;

/**
 * Size of each chunk when reading large files. 8 MB.
 */
const CHUNK_SIZE = 8 * 1024 * 1024;

/**
 * Reads a large file from disk in chunks via Tauri IPC, returning array of ArrayBuffers.
 * Passing chunks directly to Blob avoids allocating large contiguous memory.
 * @param cleanPath Absolute file system path.
 * @param fileSize Total file size in bytes.
 * @returns Promise resolving to ArrayBuffer chunks array or null on failure.
 */
async function readFileInChunks(
	cleanPath: string,
	fileSize: number,
): Promise<ArrayBuffer[] | null> {
	const chunks: ArrayBuffer[] = [];
	let offset = 0;

	while (offset < fileSize) {
		const length = Math.min(CHUNK_SIZE, fileSize - offset);
		const chunk = await DesktopBridge.readFileBinaryChunk(
			cleanPath,
			offset,
			length,
		);
		if (!chunk || chunk.byteLength === 0) {
			console.warn(
				`[readFileInChunks] Failed to read chunk at offset=${offset} for ${cleanPath}`,
			);
			return null;
		}
		chunks.push(chunk);
		offset += chunk.byteLength;
	}

	return chunks;
}

/**
 * Reads binary data for local desktop files and creates an in-memory Blob URL.
 * Useful for bypassing CORS or Tauri protocol restrictions for audio elements.
 * For large files (>20 MB), reads in chunks to avoid IPC payload truncation.
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

	if (!cleanPath.startsWith('/') && !cleanPath.match(/^[a-zA-Z]:[/\\]/)) {
		const activeProject = ProjectService.instance().getActiveProject();
		if (activeProject?.path) {
			const projectDir = activeProject.path.replace(/[/\\]+$/, '');
			cleanPath = `${projectDir}/${cleanPath}`;
		}
	}

	const cached = blobUrlCache.get(cleanPath);
	if (cached) {
		return cached;
	}

	if (DesktopBridge.isTauri()) {
		try {
			// Check file size to decide reading strategy
			const fileSize = await DesktopBridge.readFileSize(cleanPath);
			if (fileSize != null && fileSize > CHUNKED_READ_THRESHOLD) {
				// Large file: read in chunks and construct Blob directly
				const chunks = await readFileInChunks(cleanPath, fileSize);
				if (chunks && chunks.length > 0) {
					const mime = getMimeType(cleanPath);
					const blob = new Blob(chunks, { type: mime });
					const blobUrl = URL.createObjectURL(blob);
					blobUrlCache.set(cleanPath, blobUrl);
					return blobUrl;
				}
			} else {
				// Small file: single read is fine
				const buffer = await DesktopBridge.readFileBinary(cleanPath);
				if (buffer && buffer.byteLength > 0) {
					const mime = getMimeType(cleanPath);
					const blob = new Blob([buffer], { type: mime });
					const blobUrl = URL.createObjectURL(blob);
					blobUrlCache.set(cleanPath, blobUrl);
					return blobUrl;
				}
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
 * Returns the current number of cached Blob URLs.
 * @returns Number of items currently in blobUrlCache.
 */
export function getBlobUrlCacheSize(): number {
	return blobUrlCache.size;
}

/**
 * Revokes all cached Blob URLs and clears the blobUrlCache Map.
 * Prevents memory leaks when switching projects or unmounting boards.
 * @returns Number of revoked Blob URLs.
 */
export function clearBlobUrlCache(): number {
	const count = blobUrlCache.size;
	blobUrlCache.forEach((url) => {
		if (url.startsWith('blob:')) {
			URL.revokeObjectURL(url);
		}
	});
	blobUrlCache.clear();
	return count;
}

/**
 * Loads an image URL asynchronously to measure its natural dimensions.
 * @param url Media path or URL.
 * @returns Promise resolving to { w, h } aspect-ratio matched dimensions.
 */
export function getImageDimensions(
	url: string | undefined | null,
): Promise<{ w: number; h: number }> {
	return new Promise((resolve) => {
		const loadableUrl = getLocalMediaUrl(url);
		if (!loadableUrl) {
			resolve({ w: 300, h: 300 });
			return;
		}
		const img = new Image();
		img.onload = () => {
			if (img.naturalWidth && img.naturalHeight) {
				const aspect = img.naturalWidth / img.naturalHeight;
				const defaultW = 400;
				const defaultH = Math.round(defaultW / aspect);
				resolve({ w: defaultW, h: defaultH });
			} else {
				resolve({ w: 300, h: 300 });
			}
		};
		img.onerror = () => resolve({ w: 300, h: 300 });
		img.src = loadableUrl;
	});
}
