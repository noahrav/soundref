import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { ProjectService } from '@services/ProjectService';

const peakCache = new Map<string, number[]>();
const inFlightRequests = new Map<string, Promise<number[]>>();

/**
 * Resolves a potentially relative or file:// path to a clean absolute path.
 */
function resolveAbsolutePath(path: string | undefined | null): string {
	if (!path) return '';
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
	return cleanPath;
}

/**
 * Fast-extracts normalized waveform peaks directly from uncompressed WAV PCM data.
 * Works in sub-millisecond time even on huge multi-hundred-megabyte WAV files.
 */
function extractWavPeaks(
	dataView: DataView,
	sampleCount: number,
): number[] | null {
	if (dataView.byteLength < 44) return null;
	const isRiff =
		dataView.getUint8(0) === 0x52 && // 'R'
		dataView.getUint8(1) === 0x49 && // 'I'
		dataView.getUint8(2) === 0x46 && // 'F'
		dataView.getUint8(3) === 0x46; // 'F'
	const isWave =
		dataView.getUint8(8) === 0x57 && // 'W'
		dataView.getUint8(9) === 0x41 && // 'A'
		dataView.getUint8(10) === 0x56 && // 'V'
		dataView.getUint8(11) === 0x45; // 'E'
	if (!isRiff || !isWave) return null;

	const numChannels = dataView.getUint16(22, true) || 1;
	const bitsPerSample = dataView.getUint16(34, true) || 16;
	let dataOffset = 44;
	let dataLength = dataView.byteLength - 44;

	for (let i = 12; i < dataView.byteLength - 8; i += 2) {
		if (
			dataView.getUint8(i) === 0x64 && // 'd'
			dataView.getUint8(i + 1) === 0x61 && // 'a'
			dataView.getUint8(i + 2) === 0x74 && // 't'
			dataView.getUint8(i + 3) === 0x61 // 'a'
		) {
			dataOffset = i + 8;
			dataLength = Math.min(
				dataView.getUint32(i + 4, true),
				dataView.byteLength - dataOffset,
			);
			break;
		}
	}

	const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
	const blockAlign = numChannels * bytesPerSample;
	const totalSamples = Math.floor(dataLength / blockAlign);
	if (totalSamples <= 0) return null;

	const samplesPerPeak = Math.max(1, Math.floor(totalSamples / sampleCount));
	const peaks: number[] = [];

	for (let i = 0; i < sampleCount; i++) {
		const startSample = i * samplesPerPeak;
		const endSample = Math.min(totalSamples, startSample + samplesPerPeak);
		const step = Math.max(1, Math.floor((endSample - startSample) / 32));
		let sum = 0;
		let count = 0;

		for (let s = startSample; s < endSample; s += step) {
			const byteIndex = dataOffset + s * blockAlign;
			if (byteIndex + bytesPerSample <= dataView.byteLength) {
				let sampleVal = 0;
				if (bitsPerSample === 16) {
					sampleVal = dataView.getInt16(byteIndex, true) / 32768;
				} else if (bitsPerSample === 24) {
					const b0 = dataView.getUint8(byteIndex);
					const b1 = dataView.getUint8(byteIndex + 1);
					const b2 = dataView.getInt8(byteIndex + 2);
					sampleVal = (b0 | (b1 << 8) | (b2 << 16)) / 8388608;
				} else if (bitsPerSample === 32) {
					sampleVal = dataView.getFloat32(byteIndex, true);
				} else if (bitsPerSample === 8) {
					sampleVal = (dataView.getUint8(byteIndex) - 128) / 128;
				}
				sum += Math.abs(sampleVal);
				count++;
			}
		}
		peaks.push(count > 0 ? sum / count : 0);
	}

	const max = Math.max(...peaks) || 1;
	return peaks.map((p) => Math.min(1, Math.max(0.08, p / max)));
}

/**
 * Dynamically extracts or retrieves cached waveform peak values for an audio source.
 * Supports instant direct PCM parsing for WAV files and non-blocking OfflineAudioContext for compressed audio.
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
			const absPath = resolveAbsolutePath(filePath || src);
			let arrayBuffer: ArrayBuffer | null = null;

			// 1. Try reading binary via DesktopBridge in Tauri
			if (absPath && DesktopBridge.isTauri()) {
				try {
					const fileSize = await DesktopBridge.readFileSize(absPath);
					if (fileSize != null) {
						// For WAV files, fast-parse header & PCM samples directly
						if (absPath.toLowerCase().endsWith('.wav')) {
							const readLimit = Math.min(fileSize, 25_000_000);
							const wavBytes = await DesktopBridge.readFileBinaryChunk(
								absPath,
								0,
								readLimit,
							);
							if (wavBytes && wavBytes.byteLength > 44) {
								const peaks = extractWavPeaks(
									new DataView(wavBytes),
									sampleCount,
								);
								if (peaks && peaks.length === sampleCount) {
									peakCache.set(key, peaks);
									return peaks;
								}
							}
						}

						// For standard files, read full buffer (up to 30MB)
						if (fileSize <= 30_000_000) {
							arrayBuffer = await DesktopBridge.readFileBinary(absPath);
						}
					}
				} catch (err) {
					console.warn('[WaveformService] DesktopBridge read error:', err);
				}
			}

			// 2. Fallback: try fetch if not already loaded
			if (!arrayBuffer && src) {
				try {
					const response = await fetch(src);
					if (response.ok) {
						arrayBuffer = await response.arrayBuffer();
						// Check if response is WAV
						if (arrayBuffer && arrayBuffer.byteLength > 44) {
							const peaks = extractWavPeaks(
								new DataView(arrayBuffer),
								sampleCount,
							);
							if (peaks && peaks.length === sampleCount) {
								peakCache.set(key, peaks);
								return peaks;
							}
						}
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
 * Decodes raw AudioBuffer binary data using OfflineAudioContext.
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
				const OfflineAudioCtxClass =
					window.OfflineAudioContext ||
					(
						window as unknown as {
							webkitOfflineAudioContext: typeof OfflineAudioContext;
						}
					).webkitOfflineAudioContext;

				let audioBuffer: AudioBuffer;
				if (OfflineAudioCtxClass) {
					const offlineCtx = new OfflineAudioCtxClass(1, 1, 44100);
					audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
				} else {
					const AudioCtxClass =
						window.AudioContext ||
						(
							window as unknown as {
								webkitAudioContext: typeof AudioContext;
							}
						).webkitAudioContext;
					const audioCtx = new AudioCtxClass();
					audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
					audioCtx.close().catch(() => {});
				}

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
				const normalized = peaks.map((p) =>
					Math.min(1, Math.max(0.08, p / max)),
				);
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
	return Array.from(
		{ length: count },
		(_, i) => Math.sin(i * 0.2) * 0.35 + 0.5,
	);
}

/**
 * Returns the current number of cached waveform peak arrays.
 * @returns Number of items currently in peakCache.
 */
export function getWaveformCacheSize(): number {
	return peakCache.size;
}

/**
 * Clears the waveform peaks cache and any in-flight requests.
 * @returns Number of cleared waveform peak entries.
 */
export function clearWaveformCache(): number {
	const count = peakCache.size;
	peakCache.clear();
	inFlightRequests.clear();
	return count;
}
