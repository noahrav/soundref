/**
 * Metadata structure describing streaming service embed details.
 */
export interface EmbedInfo {
	/** Indicates whether the URL is a recognized streaming URL or service */
	isStream: boolean;
	/** Recognized music streaming service platform */
	service?:
		| 'soundcloud'
		| 'spotify'
		| 'youtube'
		| 'deezer'
		| 'applemusic'
		| 'bandcamp'
		| 'generic';
	/** Formatted iframe embed URL for playback */
	embedUrl?: string;
	/** Extracted or default iframe height in pixels */
	height?: string;
}

/**
 * Extracts iframe src URL attribute if input is an HTML iframe tag snippet.
 * @param input Raw input string (URL or iframe HTML snippet).
 * @returns Extracted src URL string or original cleaned input.
 */
export function extractIframeSrc(input: string): string {
	if (!input) return '';
	const clean = input.trim();
	if (clean.includes('<iframe')) {
		const match = clean.match(/src=["']([^"']+)["']/i);
		if (match?.[1]) {
			return match[1];
		}
	}
	return clean;
}

/**
 * Verifies whether a string represents a valid local audio file path or URL.
 * Rejects iframe HTML tags, embed codes, and streaming platform domains.
 * @param source Path or URL string to evaluate.
 * @returns Boolean indicating if the path is a valid local audio source.
 */
export function isValidLocalAudioSource(source: string): boolean {
	if (!source?.trim()) return false;
	const clean = source.trim();

	if (
		clean.includes('<iframe') ||
		clean.includes('bandcamp.com') ||
		clean.includes('soundcloud.com') ||
		clean.includes('youtube.com') ||
		clean.includes('youtu.be') ||
		clean.includes('spotify.com') ||
		clean.includes('deezer.com') ||
		clean.includes('music.apple.com') ||
		clean.includes('w.soundcloud.com')
	) {
		return false;
	}

	if (
		clean.startsWith('blob:') ||
		clean.startsWith('data:audio') ||
		clean.startsWith('asset:')
	) {
		return true;
	}

	const audioExtRegex =
		/\.(mp3|wav|flac|ogg|m4a|aac|opus|weba|wma|aiff|aif)(\?.*)?$/i;
	return audioExtRegex.test(clean);
}

/**
 * Parses a web URL or HTML iframe snippet and returns streaming service details.
 * Supports YouTube, SoundCloud, Spotify, Deezer, Apple Music, Bandcamp, and direct HTTP streams.
 * @param url Raw web URL string or iframe HTML snippet.
 * @returns EmbedInfo object with service type, formatted embed URL, and frame height.
 */
export function parseStreamUrl(url: string): EmbedInfo {
	if (!url) return { isStream: false };
	const raw = url.trim();
	const cleanUrl = extractIframeSrc(raw);

	let customHeight: string | undefined;
	if (raw.includes('<iframe')) {
		const hMatch =
			raw.match(/height=["'](\d+)(?:px)?["']/i) ||
			raw.match(/height:\s*(\d+)(?:px)?/i);
		if (hMatch?.[1]) {
			customHeight = hMatch[1];
		}
	}

	if (cleanUrl.includes('bandcamp.com')) {
		return {
			isStream: true,
			service: 'bandcamp',
			embedUrl: cleanUrl,
			height: customHeight || '42',
		};
	}

	if (cleanUrl.includes('soundcloud.com')) {
		return {
			isStream: true,
			service: 'soundcloud',
			embedUrl: cleanUrl.includes('w.soundcloud.com')
				? cleanUrl
				: `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
			height: customHeight || '120',
		};
	}

	const ytMatch = cleanUrl.match(
		/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i,
	);
	if (ytMatch?.[1]) {
		return {
			isStream: true,
			service: 'youtube',
			embedUrl: cleanUrl.includes('youtube.com/embed')
				? cleanUrl
				: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`,
			height: customHeight || '120',
		};
	}

	if (cleanUrl.includes('spotify.com')) {
		const spotifyPath = cleanUrl.replace('https://open.spotify.com/', '');
		return {
			isStream: true,
			service: 'spotify',
			embedUrl: cleanUrl.includes('spotify.com/embed/')
				? cleanUrl
				: `https://open.spotify.com/embed/${spotifyPath}`,
			height: customHeight || '80',
		};
	}

	if (cleanUrl.includes('deezer.com')) {
		const trackMatch = cleanUrl.match(/track\/(\d+)/i);
		return {
			isStream: true,
			service: 'deezer',
			embedUrl:
				trackMatch?.[1] && !cleanUrl.includes('widget.deezer.com')
					? `https://widget.deezer.com/widget/auto/track/${trackMatch[1]}`
					: cleanUrl,
			height: customHeight || '120',
		};
	}

	if (cleanUrl.includes('music.apple.com')) {
		return {
			isStream: true,
			service: 'applemusic',
			embedUrl: cleanUrl.includes('embed.music.apple.com')
				? cleanUrl
				: cleanUrl.replace('music.apple.com', 'embed.music.apple.com'),
			height: customHeight || '120',
		};
	}

	if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
		if (cleanUrl.match(/\.(mp3|wav|ogg|flac|m4a|aac)(\?.*)?$/i)) {
			return { isStream: false };
		}
		return {
			isStream: true,
			service: 'generic',
			embedUrl: cleanUrl,
			height: customHeight || '120',
		};
	}

	return { isStream: false };
}

/**
 * Asynchronously resolves streaming embed metadata.
 * @param url Stream URL or iframe HTML snippet.
 * @returns Promise resolving to EmbedInfo object.
 */
export async function resolveStreamEmbed(url: string): Promise<EmbedInfo> {
	return parseStreamUrl(url);
}

/**
 * Fetches cover artwork URL for supported streaming URLs via oEmbed or Open Graph meta tags.
 * @param url Stream or web page URL string.
 * @returns Promise resolving to the image artwork URL, or empty string if unretrievable.
 */
export async function fetchCoverArt(url: string): Promise<string> {
	if (!url) return '';
	const cleanUrl = extractIframeSrc(url);

	const ytMatch = cleanUrl.match(
		/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i,
	);
	if (ytMatch?.[1]) {
		return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
	}

	if (cleanUrl.includes('soundcloud.com')) {
		try {
			const res = await fetch(
				`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(cleanUrl)}`,
			);
			if (res.ok) {
				const json = await res.json();
				if (json.thumbnail_url) return json.thumbnail_url;
			}
		} catch {}
	}

	if (cleanUrl.includes('spotify.com')) {
		try {
			const res = await fetch(
				`https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`,
			);
			if (res.ok) {
				const json = await res.json();
				if (json.thumbnail_url) return json.thumbnail_url;
			}
		} catch {}
	}

	if (cleanUrl.includes('deezer.com')) {
		try {
			const res = await fetch(
				`https://api.deezer.com/oembed?url=${encodeURIComponent(cleanUrl)}`,
			);
			if (res.ok) {
				const json = await res.json();
				if (json.thumbnail_url) return json.thumbnail_url;
			}
		} catch {}
	}

	if (cleanUrl.includes('bandcamp.com')) {
		try {
			const res = await fetch(
				`https://bandcamp.com/oembed?url=${encodeURIComponent(cleanUrl)}`,
			);
			if (res.ok) {
				const json = await res.json();
				if (json.artwork_url || json.thumbnail_url) {
					return json.artwork_url || json.thumbnail_url;
				}
			}
		} catch {}
	}

	if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
		try {
			const res = await fetch(cleanUrl);
			if (res.ok) {
				const html = await res.text();
				const ogMatch =
					html.match(
						/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
					) ||
					html.match(
						/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
					);
				if (ogMatch?.[1]) {
					return ogMatch[1];
				}
			}
		} catch {}
	}

	return '';
}
