export interface EmbedInfo {
	isStream: boolean;
	service?:
		| 'soundcloud'
		| 'spotify'
		| 'youtube'
		| 'deezer'
		| 'applemusic'
		| 'bandcamp'
		| 'generic';
	embedUrl?: string;
}

export function parseStreamUrl(url: string): EmbedInfo {
	if (!url) return { isStream: false };
	const cleanUrl = url.trim();

	// YouTube
	const ytMatch = cleanUrl.match(
		/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i,
	);
	if (ytMatch && ytMatch[1]) {
		return {
			isStream: true,
			service: 'youtube',
			embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`,
		};
	}

	// SoundCloud
	if (cleanUrl.includes('soundcloud.com')) {
		return {
			isStream: true,
			service: 'soundcloud',
			embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
		};
	}

	// Spotify
	if (cleanUrl.includes('spotify.com')) {
		const spotifyPath = cleanUrl.replace('https://open.spotify.com/', '');
		return {
			isStream: true,
			service: 'spotify',
			embedUrl: `https://open.spotify.com/embed/${spotifyPath}`,
		};
	}

	// Deezer
	if (cleanUrl.includes('deezer.com')) {
		const trackMatch = cleanUrl.match(/track\/(\d+)/i);
		if (trackMatch && trackMatch[1]) {
			return {
				isStream: true,
				service: 'deezer',
				embedUrl: `https://widget.deezer.com/widget/auto/track/${trackMatch[1]}`,
			};
		}
		return {
			isStream: true,
			service: 'deezer',
			embedUrl: cleanUrl,
		};
	}

	// Apple Music
	if (cleanUrl.includes('music.apple.com')) {
		const embedUrl = cleanUrl.replace(
			'music.apple.com',
			'embed.music.apple.com',
		);
		return {
			isStream: true,
			service: 'applemusic',
			embedUrl,
		};
	}

	// Bandcamp
	if (cleanUrl.includes('bandcamp.com')) {
		return {
			isStream: true,
			service: 'bandcamp',
			embedUrl: cleanUrl,
		};
	}

	// Generic http stream or audio link
	if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
		if (cleanUrl.match(/\.(mp3|wav|ogg|flac|m4a|aac)(\?.*)?$/i)) {
			return { isStream: false };
		}
		return {
			isStream: true,
			service: 'generic',
			embedUrl: cleanUrl,
		};
	}

	return { isStream: false };
}

export async function fetchCoverArt(url: string): Promise<string> {
	if (!url) return '';
	const cleanUrl = url.trim();

	// YouTube
	const ytMatch = cleanUrl.match(
		/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i,
	);
	if (ytMatch && ytMatch[1]) {
		return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
	}

	// SoundCloud
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

	// Spotify
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

	// Deezer
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

	// Bandcamp
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

	// Generic Open Graph scrape attempt
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
				if (ogMatch && ogMatch[1]) {
					return ogMatch[1];
				}
			}
		} catch {}
	}

	return '';
}
