import {
	extractIframeSrc,
	isValidLocalAudioSource,
	parseStreamUrl,
} from '@components/board/utils/embedUtils';
import { describe, expect, it } from 'vitest';

describe('embedUtils', () => {
	describe('extractIframeSrc', () => {
		it('should return empty string for empty input', () => {
			expect(extractIframeSrc('')).toBe('');
		});

		it('should return URL as-is for simple URL', () => {
			expect(extractIframeSrc('https://example.com')).toBe(
				'https://example.com',
			);
		});

		it('should extract src from iframe with double quotes', () => {
			const iframe =
				'<iframe src="https://example.com/embed" width="100%" height="300"></iframe>';
			expect(extractIframeSrc(iframe)).toBe('https://example.com/embed');
		});

		it('should extract src from iframe with single quotes', () => {
			const iframe =
				"<iframe src='https://example.com/embed' width='100%'></iframe>";
			expect(extractIframeSrc(iframe)).toBe('https://example.com/embed');
		});

		it('should return trimmed HTML for iframe without src', () => {
			const iframe = ' <iframe width="100%"></iframe> ';
			expect(extractIframeSrc(iframe)).toBe('<iframe width="100%"></iframe>');
		});

		it('should trim whitespace from input', () => {
			expect(extractIframeSrc('  https://example.com  ')).toBe(
				'https://example.com',
			);
		});
	});

	describe('isValidLocalAudioSource', () => {
		it('should return true for .mp3 file', () => {
			expect(isValidLocalAudioSource('song.mp3')).toBe(true);
		});

		it('should return true for .wav file', () => {
			expect(isValidLocalAudioSource('song.wav')).toBe(true);
		});

		it('should return true for .flac file', () => {
			expect(isValidLocalAudioSource('song.flac')).toBe(true);
		});

		it('should return true for .ogg file', () => {
			expect(isValidLocalAudioSource('song.ogg')).toBe(true);
		});

		it('should return true for .m4a file', () => {
			expect(isValidLocalAudioSource('song.m4a')).toBe(true);
		});

		it('should return true for .aac file', () => {
			expect(isValidLocalAudioSource('song.aac')).toBe(true);
		});

		it('should return true for .opus file', () => {
			expect(isValidLocalAudioSource('song.opus')).toBe(true);
		});

		it('should return true for .aiff file', () => {
			expect(isValidLocalAudioSource('song.aiff')).toBe(true);
		});

		it('should return true for .wma file', () => {
			expect(isValidLocalAudioSource('song.wma')).toBe(true);
		});

		it('should return false for SoundCloud URL', () => {
			expect(
				isValidLocalAudioSource('https://soundcloud.com/artist/track'),
			).toBe(false);
		});

		it('should return false for YouTube URL', () => {
			expect(isValidLocalAudioSource('https://youtube.com/watch?v=123')).toBe(
				false,
			);
		});

		it('should return false for Spotify URL', () => {
			expect(
				isValidLocalAudioSource('https://open.spotify.com/track/123'),
			).toBe(false);
		});

		it('should return false for Deezer URL', () => {
			expect(isValidLocalAudioSource('https://deezer.com/track/123')).toBe(
				false,
			);
		});

		it('should return false for Apple Music URL', () => {
			expect(
				isValidLocalAudioSource('https://music.apple.com/us/album/123'),
			).toBe(false);
		});

		it('should return false for Bandcamp URL', () => {
			expect(
				isValidLocalAudioSource('https://artist.bandcamp.com/track/123'),
			).toBe(false);
		});

		it('should return false for iframe HTML', () => {
			expect(
				isValidLocalAudioSource('<iframe src="https://example.com"></iframe>'),
			).toBe(false);
		});

		it('should return false for empty string', () => {
			expect(isValidLocalAudioSource('')).toBe(false);
		});

		it('should return false for null or undefined', () => {
			// @ts-expect-error test invalide intentionnel
			expect(isValidLocalAudioSource(null)).toBe(false);
			// @ts-expect-error test invalide intentionnel
			expect(isValidLocalAudioSource(undefined)).toBe(false);
		});

		it('should return true for blob: URL', () => {
			expect(isValidLocalAudioSource('blob:http://localhost:3000/123')).toBe(
				true,
			);
		});

		it('should return true for data:audio URL', () => {
			expect(isValidLocalAudioSource('data:audio/mp3;base64,123')).toBe(true);
		});

		it('should return true for asset: URL', () => {
			expect(isValidLocalAudioSource('asset://local/audio.mp3')).toBe(true);
		});

		it('should return false for .txt file', () => {
			expect(isValidLocalAudioSource('document.txt')).toBe(false);
		});

		it('should return true for .mp3 with query string', () => {
			expect(isValidLocalAudioSource('song.mp3?v=123')).toBe(true);
		});

		it('should return true for uppercase .MP3 extension', () => {
			expect(isValidLocalAudioSource('song.MP3')).toBe(true);
		});
	});

	describe('parseStreamUrl', () => {
		it('should return { isStream: false } for empty input', () => {
			expect(parseStreamUrl('')).toEqual({ isStream: false });
		});

		it('should detect SoundCloud URL with embed URL and height 120', () => {
			const result = parseStreamUrl('https://soundcloud.com/artist/track');
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('soundcloud');
			expect(result.embedUrl).toContain('w.soundcloud.com');
			expect(result.height).toBe('120');
		});

		it('should pass through SoundCloud widget URL', () => {
			const url =
				'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/123';
			const result = parseStreamUrl(url);
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('soundcloud');
			expect(result.embedUrl).toBe(url);
		});

		it('should detect YouTube URL with embed URL and height 120', () => {
			const result = parseStreamUrl(
				'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			);
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('youtube');
			expect(result.embedUrl).toContain('/embed/');
			expect(result.height).toBe('120');
		});

		it('should detect short YouTube URL (youtu.be)', () => {
			const result = parseStreamUrl('https://youtu.be/dQw4w9WgXcQ');
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('youtube');
		});

		it('should pass through YouTube embed URL', () => {
			const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
			const result = parseStreamUrl(url);
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('youtube');
			expect(result.embedUrl).toBe(url);
		});

		it('should detect Spotify track with embed URL and height 80', () => {
			const result = parseStreamUrl('https://open.spotify.com/track/123');
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('spotify');
			expect(result.embedUrl).toContain('/embed/');
			expect(result.height).toBe('80');
		});

		it('should pass through Spotify embed URL', () => {
			const url = 'https://open.spotify.com/embed/track/123';
			const result = parseStreamUrl(url);
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('spotify');
			expect(result.embedUrl).toBe(url);
		});

		it('should detect Deezer track with widget URL and height 120', () => {
			const result = parseStreamUrl('https://www.deezer.com/track/123');
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('deezer');
			expect(result.embedUrl).toContain('widget.deezer.com');
			expect(result.height).toBe('120');
		});

		it('should pass through Deezer widget URL', () => {
			const url = 'https://widget.deezer.com/widget/dark/track/123';
			const result = parseStreamUrl(url);
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('deezer');
			expect(result.embedUrl).toBe(url);
		});

		it('should detect Apple Music URL with embed URL and height 120', () => {
			const result = parseStreamUrl(
				'https://music.apple.com/us/album/123?i=456',
			);
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('applemusic');
			expect(result.embedUrl).toContain('embed.music.apple.com');
			expect(result.height).toBe('120');
		});

		it('should pass through Apple Music embed URL', () => {
			const url = 'https://embed.music.apple.com/us/album/123?i=456';
			const result = parseStreamUrl(url);
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('applemusic');
			expect(result.embedUrl).toBe(url);
		});

		it('should detect Bandcamp URL with height 42', () => {
			const result = parseStreamUrl('https://artist.bandcamp.com/track/song');
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('bandcamp');
			expect(result.height).toBe('42');
		});

		it('should detect generic HTTP URL with height 120', () => {
			const result = parseStreamUrl('https://example.com/audio-player');
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('generic');
			expect(result.height).toBe('120');
		});

		it('should return { isStream: false } for direct .mp3 HTTP URL', () => {
			expect(parseStreamUrl('https://example.com/audio.mp3')).toEqual({
				isStream: false,
			});
		});

		it('should return { isStream: false } for direct .wav HTTP URL', () => {
			expect(parseStreamUrl('https://example.com/audio.wav')).toEqual({
				isStream: false,
			});
		});

		it('should return { isStream: false } for local path', () => {
			expect(parseStreamUrl('/local/path/to/file.mp3')).toEqual({
				isStream: false,
			});
		});

		it('should extract custom height from iframe HTML', () => {
			const iframe =
				'<iframe src="https://example.com/embed" height="250px"></iframe>';
			const result = parseStreamUrl(iframe);
			expect(result.height).toBe('250');
		});

		it('should extract SoundCloud service from iframe with src', () => {
			const iframe =
				'<iframe src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/123" height="150"></iframe>';
			const result = parseStreamUrl(iframe);
			expect(result.isStream).toBe(true);
			expect(result.service).toBe('soundcloud');
			expect(result.embedUrl).toContain('w.soundcloud.com');
			expect(result.height).toBe('150');
		});
	});
});
