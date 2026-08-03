/**
 * Resizes and compresses an image File or image URL string into a lightweight JPEG Data URL.
 * Prevents canvas memory bloat and keeps persistent project storage files lightweight.
 * @param fileOrUrl Raw File object or image URL string.
 * @param maxWidth Maximum allowed width in pixels.
 * @param maxHeight Maximum allowed height in pixels.
 * @param quality JPEG compression quality factor (0 to 1).
 * @returns Promise resolving to compressed JPEG Data URL string or original string.
 */
export function compressImageToDataUrl(
	fileOrUrl: File | string,
	maxWidth = 1920,
	maxHeight = 1920,
	quality = 0.85,
): Promise<string> {
	return new Promise((resolve) => {
		if (
			typeof fileOrUrl === 'string' &&
			(fileOrUrl.startsWith('file://') ||
				fileOrUrl.startsWith('http://') ||
				fileOrUrl.startsWith('https://') ||
				fileOrUrl.includes('image/svg+xml'))
		) {
			resolve(fileOrUrl);
			return;
		}

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			let { width, height } = img;
			if (width <= maxWidth && height <= maxHeight && typeof fileOrUrl === 'string' && fileOrUrl.length < 500000) {
				resolve(fileOrUrl);
				return;
			}
			if (width > maxWidth || height > maxHeight) {
				const ratio = Math.min(maxWidth / width, maxHeight / height);
				width = Math.round(width * ratio);
				height = Math.round(height * ratio);
			}
			const canvas = document.createElement('canvas');
			canvas.width = Math.max(1, width);
			canvas.height = Math.max(1, height);
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				try {
					const dataUrl = canvas.toDataURL('image/jpeg', quality);
					// Clear canvas memory
					canvas.width = 1;
					canvas.height = 1;
					resolve(dataUrl);
				} catch {
					resolve(typeof fileOrUrl === 'string' ? fileOrUrl : '');
				}
			} else {
				resolve(typeof fileOrUrl === 'string' ? fileOrUrl : '');
			}
		};
		img.onerror = () => {
			resolve(typeof fileOrUrl === 'string' ? fileOrUrl : '');
		};

		if (typeof fileOrUrl === 'string') {
			img.src = fileOrUrl;
		} else {
			const reader = new FileReader();
			reader.onload = (e) => {
				if (e.target?.result) {
					img.src = e.target.result as string;
				} else {
					resolve('');
				}
			};
			reader.readAsDataURL(fileOrUrl);
		}
	});
}
