import { convertFileSrc } from '@tauri-apps/api/core';
import { DesktopBridge } from '../persistence/DesktopBridge';

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

export function resolveMediaUrl(
	path: string | undefined | null,
): Promise<string> {
	return Promise.resolve(getLocalMediaUrl(path));
}

export function useMediaUrl(url: string | undefined | null): string {
	return getLocalMediaUrl(url);
}

const blobUrlCache = new Map<string, string>();

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
