import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearBlobUrlCache,
	getBlobUrlCacheSize,
	getBlobUrlForFile,
	getLocalMediaUrl,
	getMimeType,
	resolveMediaUrl,
	revokeBlobUrlForFile,
} from './mediaUtils';

vi.mock('@core/persistence/DesktopBridge', () => ({
	DesktopBridge: {
		isTauri: vi.fn(() => false),
		readFileBinary: vi.fn(),
		readFileSize: vi.fn(),
		readFileBinaryChunk: vi.fn(),
		getMediaServerPort: vi.fn(async () => 0),
	},
}));

vi.mock('@services/ProjectService', () => ({
	ProjectService: {
		instance: () => ({
			getActiveProject: () => null,
		}),
	},
}));

vi.mock('@tauri-apps/api/core', () => ({
	convertFileSrc: (path: string) => `asset://localhost${path}`,
}));

describe('mediaUtils', () => {
	beforeEach(() => {
		clearBlobUrlCache();
		vi.clearAllMocks();
	});

	describe('getMimeType', () => {
		it("should return 'audio/mpeg' for .mp3", () => {
			expect(getMimeType('test.mp3')).toBe('audio/mpeg');
		});

		it("should return 'audio/wav' for .wav", () => {
			expect(getMimeType('test.wav')).toBe('audio/wav');
		});

		it("should return 'audio/flac' for .flac", () => {
			expect(getMimeType('test.flac')).toBe('audio/flac');
		});

		it("should return 'audio/ogg' for .ogg", () => {
			expect(getMimeType('test.ogg')).toBe('audio/ogg');
		});

		it("should return 'audio/aac' for .m4a and .aac", () => {
			expect(getMimeType('test.m4a')).toBe('audio/aac');
			expect(getMimeType('test.aac')).toBe('audio/aac');
		});

		it("should return 'image/png' for .png", () => {
			expect(getMimeType('test.png')).toBe('image/png');
		});

		it("should return 'image/jpeg' for .jpg and .jpeg", () => {
			expect(getMimeType('test.jpg')).toBe('image/jpeg');
			expect(getMimeType('test.jpeg')).toBe('image/jpeg');
		});

		it("should return 'image/webp' for .webp", () => {
			expect(getMimeType('test.webp')).toBe('image/webp');
		});

		it("should return 'image/gif' for .gif", () => {
			expect(getMimeType('test.gif')).toBe('image/gif');
		});

		it("should return 'image/svg+xml' for .svg", () => {
			expect(getMimeType('test.svg')).toBe('image/svg+xml');
		});

		it("should return 'application/octet-stream' for unknown extensions", () => {
			expect(getMimeType('test.unknown')).toBe('application/octet-stream');
		});

		it('should handle case insensitive extensions (.MP3)', () => {
			expect(getMimeType('test.MP3')).toBe('audio/mpeg');
		});
	});

	describe('getLocalMediaUrl', () => {
		it('should return empty string for null, undefined, or empty path', () => {
			expect(getLocalMediaUrl(null)).toBe('');
			expect(getLocalMediaUrl(undefined)).toBe('');
			expect(getLocalMediaUrl('')).toBe('');
		});

		it('should pass through http://, https://, blob:, data:, asset:// URLs', () => {
			expect(getLocalMediaUrl('http://example.com')).toBe('http://example.com');
			expect(getLocalMediaUrl('https://example.com')).toBe(
				'https://example.com',
			);
			expect(getLocalMediaUrl('blob:http://example.com/blob')).toBe(
				'blob:http://example.com/blob',
			);
			expect(getLocalMediaUrl('data:text/plain;base64,')).toBe(
				'data:text/plain;base64,',
			);
			expect(getLocalMediaUrl('asset://localhost/test')).toBe(
				'asset://localhost/test',
			);
		});

		it('should clean file:// prefix', () => {
			expect(getLocalMediaUrl('file:///unix/path')).toBe('file:///unix/path');
		});

		it('should format absolute unix path as file:///path', () => {
			expect(getLocalMediaUrl('/unix/path')).toBe('file:///unix/path');
		});

		it('should format Windows path as file:///C:/path', () => {
			expect(getLocalMediaUrl('C:\\Windows\\path')).toBe(
				'file:///C:/Windows/path',
			);
		});
	});

	describe('resolveMediaUrl', () => {
		it('should resolve to string via Promise', async () => {
			const result = await resolveMediaUrl('/test/path');
			expect(typeof result).toBe('string');
		});

		it('should use media server streaming URL when DesktopBridge.getMediaServerPort returns port', async () => {
			vi.mocked(DesktopBridge.isTauri).mockReturnValue(true);
			vi.spyOn(DesktopBridge, 'getMediaServerPort').mockResolvedValue(45678);

			const result = await resolveMediaUrl('/home/user/song with spaces.mp3');
			expect(result).toBe(
				'http://127.0.0.1:45678/stream?path=%2Fhome%2Fuser%2Fsong%20with%20spaces.mp3',
			);
		});
	});

	describe('getBlobUrlForFile & blobUrlCache', () => {
		it('should return null for empty path', async () => {
			expect(await getBlobUrlForFile(null)).toBeNull();
			expect(await getBlobUrlForFile('')).toBeNull();
			expect(await getBlobUrlForFile(undefined)).toBeNull();
		});

		it('should pass through web URLs (http, https, blob, data)', async () => {
			expect(await getBlobUrlForFile('http://example.com')).toBe(
				'http://example.com',
			);
			expect(await getBlobUrlForFile('https://example.com')).toBe(
				'https://example.com',
			);
			expect(await getBlobUrlForFile('blob:foo')).toBe('blob:foo');
			expect(await getBlobUrlForFile('data:foo')).toBe('data:foo');
		});

		it('should return null when DesktopBridge.isTauri() is false for local files', async () => {
			vi.mocked(DesktopBridge.isTauri).mockReturnValue(false);
			expect(await getBlobUrlForFile('/local/file.mp3')).toBeNull();
		});

		it('should cache and revoke blob URLs', async () => {
			vi.mocked(DesktopBridge.isTauri).mockReturnValue(true);
			vi.mocked(DesktopBridge.readFileSize).mockResolvedValue(3);
			vi.mocked(DesktopBridge.readFileBinary).mockResolvedValue(
				new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
			);
			globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
			globalThis.URL.revokeObjectURL = vi.fn();

			const url1 = await getBlobUrlForFile('/cache/file.mp3');
			expect(url1).toBe('blob:mock');
			expect(DesktopBridge.readFileBinary).toHaveBeenCalledTimes(1);

			const url2 = await getBlobUrlForFile('/cache/file.mp3');
			expect(url2).toBe('blob:mock');
			expect(DesktopBridge.readFileBinary).toHaveBeenCalledTimes(1);

			revokeBlobUrlForFile('/cache/file.mp3');
			expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
		});

		it('clearBlobUrlCache should empty cache and return count', async () => {
			vi.mocked(DesktopBridge.isTauri).mockReturnValue(true);
			vi.mocked(DesktopBridge.readFileSize).mockResolvedValue(3);
			vi.mocked(DesktopBridge.readFileBinary).mockResolvedValue(
				new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
			);
			globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
			globalThis.URL.revokeObjectURL = vi.fn();

			expect(getBlobUrlCacheSize()).toBe(0);
			await getBlobUrlForFile('/cache/file2.mp3');
			expect(DesktopBridge.readFileBinary).toHaveBeenCalledTimes(1);
			expect(getBlobUrlCacheSize()).toBe(1);

			const count = clearBlobUrlCache();
			expect(count).toBe(1);
			expect(getBlobUrlCacheSize()).toBe(0);
			expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');

			await getBlobUrlForFile('/cache/file2.mp3');
			expect(DesktopBridge.readFileBinary).toHaveBeenCalledTimes(2);
		});
	});
});
