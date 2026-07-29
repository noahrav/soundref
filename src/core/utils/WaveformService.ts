import { DesktopBridge } from '../persistence/DesktopBridge';

const peakCache = new Map<string, number[]>();
const inFlightRequests = new Map<string, Promise<number[]>>();

/**
 * Dynamically extract waveform peaks for audio files without blocking the main thread.
 * Heavy audio files are processed asynchronously and results are cached.
 */
export async function getOrExtractWaveformPeaks(
	key: string,
	src: string,
	filePath?: string,
	sampleCount: number = 100,
): Promise<number[]> {
	if (!key) return generateFallbackPeaks(sampleCount);

	if (peakCache.has(key)) {
		return peakCache.get(key)!;
	}

	if (inFlightRequests.has(key)) {
		return inFlightRequests.get(key)!;
	}

	const task = (async () => {
		try {
			let arrayBuffer: ArrayBuffer | null = null;

			// 1. Try to fetch a partial or full arrayBuffer without blocking
			try {
				const response = await fetch(src);
				if (response.ok) {
					// Cap buffer processing to 30MB to prevent browser UI freezing on massive FLAC/WAV files
					const blob = await response.blob();
					if (blob.size <= 35_000_000) {
						arrayBuffer = await blob.arrayBuffer();
					} else {
						// For very heavy files (>35MB), slice the first 15MB for fast non-blocking peak estimation
						const slice = blob.slice(0, 15_000_000);
						arrayBuffer = await slice.arrayBuffer();
					}
				}
			} catch {
				// Fetch failed
			}

			// 2. Fallback to desktop bridge reading if fetch failed
			if (!arrayBuffer && filePath && DesktopBridge.isTauri()) {
				try {
					arrayBuffer = await DesktopBridge.readFileBinary(filePath);
					if (arrayBuffer && arrayBuffer.byteLength > 35_000_000) {
						arrayBuffer = arrayBuffer.slice(0, 15_000_000);
					}
				} catch {
					// Read failed
				}
			}

			if (!arrayBuffer || arrayBuffer.byteLength === 0) {
				const fallback = generateFallbackPeaks(sampleCount);
				peakCache.set(key, fallback);
				return fallback;
			}

			// 3. Decode audio data in background idle frame to avoid UI lag
			const peaks = await decodeAndExtractPeaksNonBlocking(
				arrayBuffer,
				sampleCount,
			);
			peakCache.set(key, peaks);
			return peaks;
		} catch (err) {
			console.warn('[WaveformService] Could not decode peaks, using fallback:', err);
			const fallback = generateFallbackPeaks(sampleCount);
			peakCache.set(key, fallback);
			return fallback;
		} finally {
			inFlightRequests.delete(key);
		}
	})();

	inFlightRequests.set(key, task);
	return task;
}

function decodeAndExtractPeaksNonBlocking(
	arrayBuffer: ArrayBuffer,
	sampleCount: number,
): Promise<number[]> {
	return new Promise((resolve) => {
		// Yield to main thread first so UI updates immediately
		setTimeout(async () => {
			try {
				const AudioContextClass =
					window.AudioContext || (window as any).webkitAudioContext;
				const audioCtx = new AudioContextClass();

				const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
				const rawData = audioBuffer.getChannelData(0);
				const blockSize = Math.floor(rawData.length / sampleCount);
				const step = Math.max(1, Math.floor(blockSize / 40));
				const peaks: number[] = [];

				for (let i = 0; i < sampleCount; i++) {
					let sum = 0;
					let count = 0;
					const blockStart = i * blockSize;
					for (let j = 0; j < blockSize; j += step) {
						sum += Math.abs(rawData[blockStart + j]);
						count++;
					}
					peaks.push(count > 0 ? sum / count : 0);
				}

				const max = Math.max(...peaks) || 1;
				const normalized = peaks.map((p) => p / max);
				audioCtx.close();
				resolve(normalized);
			} catch (e) {
				console.warn('[WaveformService] Decoding error:', e);
				resolve(generateFallbackPeaks(sampleCount));
			}
		}, 10);
	});
}

export function generateFallbackPeaks(count: number): number[] {
	return Array.from({ length: count }, (_, i) => Math.sin(i * 0.2) * 0.4 + 0.5);
}
