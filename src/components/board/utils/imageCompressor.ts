export function compressImageToDataUrl(
	fileOrUrl: File | string,
	maxWidth = 300,
	maxHeight = 300,
	quality = 0.8,
): Promise<string> {
	return new Promise((resolve) => {
		if (typeof fileOrUrl === 'string' && fileOrUrl.startsWith('file://')) {
			// Local disk path, leave as is
			resolve(fileOrUrl);
			return;
		}

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			let { width, height } = img;
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
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				try {
					const dataUrl = canvas.toDataURL('image/jpeg', quality);
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
