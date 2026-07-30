import { DesktopBridge } from '../persistence/DesktopBridge';

const peakCache = new Map<string, number[]>();
const inFlightRequests = new Map<string, Promise<number[]>>();

/**
 * Dynamically extracts or retrieves cached waveform peak values for an audio source.
 * Prevents UI lag by slicing large buffers and running decoding asynchronously.
 * @param key Unique cache key (usually track shape ID).
 * @param src Resolved URL source string of the audio.
 * @param filePath Optional file system path for Tauri desktop binary file reading.
 * @param sampleCount Number of peak samples to generate across the audio duration.
 * @returns Promise resolving to an array of normalized numerical peak values (0 to 1).
 */
export async function getOrExtractWaveformPeaks(
	key: string,
	src: string,
	filePath?: string,
	sampleCount: number = 100,
): Promise<number[]> {
	if (!key) return generateFallbackPeaks(sampleCount);

	const cachedPeaks = peakCache.get(key);
	if (cachedPeaks) {
		return cachedPeaks;
	}

	const inFlight = inFlightRequests.get(key);
	if (inFlight) {
		return inFlight;
	}

	const task = (async () => {
		try {
			let arrayBuffer: ArrayBuffer | null = null;

			try {
				const response = await fetch(src);
				if (response.ok) {
					const blob = await response.blob();
					if (blob.size <= 35_000_000) {
						arrayBuffer = await blob.arrayBuffer();
					} else {
						const slice = blob.slice(0, 15_000_000);
						arrayBuffer = await slice.arrayBuffer();
					}
				}
			} catch {}

			if (!arrayBuffer && filePath && DesktopBridge.isTauri()) {
				try {
					arrayBuffer = await DesktopBridge.readFileBinary(filePath);
					if (arrayBuffer && arrayBuffer.byteLength > 35_000_000) {
						arrayBuffer = arrayBuffer.slice(0, 15_000_000);
					}
				} catch {}
			}

			if (!arrayBuffer || arrayBuffer.byteLength === 0) {
				const fallback = generateFallbackPeaks(sampleCount);
				peakCache.set(key, fallback);
				return fallback;
			}

			const peaks = await decodeAndExtractPeaksNonBlocking(
				arrayBuffer,
				sampleCount,
			);
			peakCache.set(key, peaks);
			return peaks;
		} catch (err) {
			console.warn(
				'[WaveformService] Could not decode peaks, using fallback:',
				err,
			);
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

/**
 * Decodes raw AudioBuffer binary data on a non-blocking timeout frame.
 * @param arrayBuffer Raw ArrayBuffer of audio content.
 * @param sampleCount Number of samples to compute.
 * @returns Promise resolving to an array of normalized peak values.
 */
function decodeAndExtractPeaksNonBlocking(
	arrayBuffer: ArrayBuffer,
	sampleCount: number,
): Promise<number[]> {
	return new Promise((resolve) => {
		setTimeout(async () => {
			try {
				const AudioContextClass =
					window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext })
						.webkitAudioContext;
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

/**
 * Generates synthetic mathematical waveform peak values as a fallback.
 * @param count Number of peak samples to generate.
 * @returns Array of synthetic peak values.
 */
export function generateFallbackPeaks(count: number): number[] {
	return Array.from({ length: count }, (_, i) => Math.sin(i * 0.2) * 0.4 + 0.5);
}
