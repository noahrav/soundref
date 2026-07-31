import {
	faFolderOpen,
	faImage,
	faInfoCircle,
	faMusic,
	faRepeat,
	faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoopRegion } from '../../../core/model/item/TrackItem';
import { DesktopBridge } from '../../../core/persistence/DesktopBridge';
import {
	getBlobUrlForFile,
	getLocalMediaUrl,
} from '../../../core/utils/mediaUtils';
import { getOrExtractWaveformPeaks } from '../../../core/utils/WaveformService';
import {
	extractIframeSrc,
	fetchCoverArt,
	isValidLocalAudioSource,
} from '../utils/embedUtils';
import './TrackFormModal.scss';

/**
 * Form data payload for creating or editing track shapes.
 */
export interface TrackFormData {
	/** Track title */
	title: string;
	/** Cover image URL or file path */
	imageUrl: string;
	/** Audio source file path or streaming web URL */
	audioSource: string;
	/** Audio source classification: local or stream */
	sourceType: 'local' | 'stream';
	/** Playback mode: oneshot or loop */
	playMode: 'oneshot' | 'loop';
	/** Loop region timestamp boundaries in seconds */
	loopRegion: LoopRegion;
}

/**
 * Props for TrackFormModal component.
 */
interface TrackFormModalProps {
	/** Modal visibility flag */
	isOpen: boolean;
	/** Initial track form data when editing */
	initialData?: Partial<TrackFormData>;
	/** Save callback function */
	onSave: (data: TrackFormData) => void;
	/** Close modal callback function */
	onClose: () => void;
}

/**
 * TrackFormModal component for creating and editing audio track properties,
 * cover art, streaming/local sources, and interactive waveform loop region boundaries.
 */
export function TrackFormModal({
	isOpen,
	initialData,
	onSave,
	onClose,
}: TrackFormModalProps) {
	const { t } = useTranslation();
	const [title, setTitle] = useState(initialData?.title || '');
	const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
	const [sourceType, setSourceType] = useState<'local' | 'stream'>(
		initialData?.sourceType || 'local',
	);
	const [localAudioSource, setLocalAudioSource] = useState(() =>
		initialData?.sourceType === 'local' ? initialData?.audioSource || '' : '',
	);
	const [streamAudioSource, setStreamAudioSource] = useState(() =>
		initialData?.sourceType === 'stream' ? initialData?.audioSource || '' : '',
	);
	const [localPathError, setLocalPathError] = useState<string | null>(null);

	const [playMode, setPlayMode] = useState<'oneshot' | 'loop'>(
		initialData?.playMode || 'oneshot',
	);
	const [loopRegion, setLoopRegion] = useState<LoopRegion>(() => {
		if (
			initialData?.loopRegion &&
			initialData.loopRegion.end > initialData.loopRegion.start
		) {
			return initialData.loopRegion;
		}
		return { start: 0, end: 0 };
	});
	const [audioDuration, setAudioDuration] = useState<number>(30);
	const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
	const [activeDragHandle, setActiveDragHandle] = useState<
		'start' | 'end' | null
	>(null);

	const [showLoopTooltip, setShowLoopTooltip] = useState(false);
	const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);
	const audioInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (sourceType === 'stream' && playMode === 'loop') {
			setPlayMode('oneshot');
		}
	}, [sourceType, playMode]);

	useEffect(() => {
		if (isOpen) {
			setTitle(initialData?.title || '');
			setImageUrl(initialData?.imageUrl || '');
			const type = initialData?.sourceType || 'local';
			setSourceType(type);
			if (type === 'local') {
				setLocalAudioSource(initialData?.audioSource || '');
				setStreamAudioSource('');
			} else {
				setStreamAudioSource(initialData?.audioSource || '');
				setLocalAudioSource('');
			}
			setPlayMode(initialData?.playMode || 'oneshot');
			setLocalPathError(null);
			if (
				initialData?.loopRegion &&
				initialData.loopRegion.end > initialData.loopRegion.start
			) {
				setLoopRegion(initialData.loopRegion);
			} else {
				setLoopRegion({ start: 0, end: 0 });
			}
		}
	}, [isOpen, initialData]);

	useEffect(() => {
		if (sourceType === 'stream' && streamAudioSource) {
			fetchCoverArt(streamAudioSource).then((cover) => {
				if (cover) setImageUrl(cover);
			});
		}
	}, [sourceType, streamAudioSource]);

	useEffect(() => {
		if (
			sourceType === 'local' &&
			localAudioSource &&
			isValidLocalAudioSource(localAudioSource)
		) {
			let isMounted = true;

			const loadAudioMetadata = async () => {
				let src = getLocalMediaUrl(localAudioSource);

				if (
					!DesktopBridge.isTauri() &&
					!src.startsWith('http://') &&
					!src.startsWith('https://') &&
					!src.startsWith('blob:') &&
					!src.startsWith('data:')
				) {
					const blobUrl = await getBlobUrlForFile(localAudioSource);
					if (blobUrl) src = blobUrl;
				}

				const audio = new Audio(src);
				audio.crossOrigin = 'anonymous';
				audio.preload = 'metadata';
				audio.addEventListener('loadedmetadata', () => {
					if (!isMounted) return;
					if (audio.duration && !Number.isNaN(audio.duration)) {
						const dur = Math.round(audio.duration * 100) / 100;
						setAudioDuration(dur);
						setLoopRegion((prev) => {
							if (
								prev.end === 0 ||
								prev.end === 10 ||
								prev.end > dur ||
								!initialData?.loopRegion ||
								initialData.loopRegion.end <= initialData.loopRegion.start
							) {
								return { start: prev.start, end: dur };
							}
							return prev;
						});
					}
				});

				audio.addEventListener('error', async () => {
					if (!isMounted) return;
					if (!src.startsWith('blob:') && DesktopBridge.isTauri()) {
						const blobUrl = await getBlobUrlForFile(localAudioSource);
						if (blobUrl) {
							const fallbackAudio = new Audio(blobUrl);
							fallbackAudio.preload = 'metadata';
							fallbackAudio.addEventListener('loadedmetadata', () => {
								if (
									isMounted &&
									fallbackAudio.duration &&
									!Number.isNaN(fallbackAudio.duration)
								) {
									setAudioDuration(fallbackAudio.duration);
								}
							});
						}
					}
				});

				getOrExtractWaveformPeaks(
					localAudioSource,
					src,
					localAudioSource,
					100,
				).then((peaks) => {
					if (isMounted) {
						setWaveformPeaks(peaks);
					}
				});
			};

			loadAudioMetadata();

			return () => {
				isMounted = false;
			};
		} else if (sourceType === 'local') {
			setWaveformPeaks([]);
		}
	}, [sourceType, localAudioSource, initialData]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (
			!canvas ||
			playMode !== 'loop' ||
			sourceType !== 'local' ||
			!isValidLocalAudioSource(localAudioSource)
		) {
			return;
		}
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const width = canvas.width;
		const height = canvas.height;
		ctx.clearRect(0, 0, width, height);

		const peaks =
			waveformPeaks.length > 0
				? waveformPeaks
				: Array.from({ length: 100 }, (_, i) => Math.sin(i * 0.2) * 0.4 + 0.5);

		const maxDur = audioDuration || 30;
		const effectiveEnd =
			loopRegion.end > loopRegion.start ? loopRegion.end : maxDur;
		const startRatio = Math.max(0, loopRegion.start / maxDur);
		const endRatio = Math.min(1, effectiveEnd / maxDur);

		const startX = width * startRatio;
		const endX = width * endRatio;

		const barWidth = width / peaks.length;
		peaks.forEach((peak, i) => {
			const barHeight = peak * (height * 0.7);
			const x = i * barWidth;
			const y = (height - barHeight) / 2;
			ctx.fillStyle = '#666666';
			ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
		});

		ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
		ctx.fillRect(startX, 0, endX - startX, height);

		peaks.forEach((peak, i) => {
			const x = i * barWidth;
			if (x >= startX && x <= endX) {
				const barHeight = peak * (height * 0.7);
				const y = (height - barHeight) / 2;
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
			}
		});

		ctx.fillStyle = '#ffffff';
		ctx.fillRect(startX - 3, 0, 6, height);
		ctx.fillRect(endX - 3, 0, 6, height);

		ctx.fillStyle = '#111111';
		ctx.fillRect(startX - 1, 0, 2, height);
		ctx.fillRect(endX - 1, 0, 2, height);
	}, [
		playMode,
		sourceType,
		localAudioSource,
		loopRegion,
		waveformPeaks,
		audioDuration,
	]);

	/**
	 * Handles pointer down interaction on waveform loop canvas to initiate handle drag.
	 * @param e PointerEvent on canvas.
	 */
	const handleCanvasPointerDown = (
		e: React.PointerEvent<HTMLCanvasElement>,
	) => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const ratio = Math.max(0, Math.min(1, clickX / rect.width));
		const maxDur = audioDuration || 30;
		const targetTime = Math.round(ratio * maxDur * 100) / 100;

		const effectiveEnd =
			loopRegion.end > loopRegion.start ? loopRegion.end : maxDur;
		const startRatio = loopRegion.start / maxDur;
		const endRatio = effectiveEnd / maxDur;

		const distStart = Math.abs(ratio - startRatio);
		const distEnd = Math.abs(ratio - endRatio);

		if (distStart < distEnd) {
			setActiveDragHandle('start');
			setLoopRegion((prev) => ({
				...prev,
				start: Math.min(
					targetTime,
					Math.max(0, (prev.end > prev.start ? prev.end : maxDur) - 0.01),
				),
			}));
		} else {
			setActiveDragHandle('end');
			setLoopRegion((prev) => ({
				...prev,
				end: Math.max(targetTime, prev.start + 0.01),
			}));
		}
	};

	/**
	 * Handles pointer move interaction on waveform loop canvas to adjust handle position.
	 * @param e PointerEvent on canvas.
	 */
	const handleCanvasPointerMove = (
		e: React.PointerEvent<HTMLCanvasElement>,
	) => {
		if (!activeDragHandle) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const ratio = Math.max(0, Math.min(1, clickX / rect.width));
		const maxDur = audioDuration || 30;
		const targetTime = Math.round(ratio * maxDur * 100) / 100;

		if (activeDragHandle === 'start') {
			setLoopRegion((prev) => ({
				...prev,
				start: Math.min(
					targetTime,
					Math.max(0, (prev.end > prev.start ? prev.end : maxDur) - 0.01),
				),
			}));
		} else {
			setLoopRegion((prev) => ({
				...prev,
				end: Math.max(targetTime, prev.start + 0.01),
			}));
		}
	};

	/**
	 * Handles pointer up event releasing drag state.
	 */
	const handleCanvasPointerUp = () => {
		setActiveDragHandle(null);
	};

	if (!isOpen) return null;

	const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const filePath = (file as any).path;
			if (filePath) {
				setImageUrl(filePath);
			} else {
				const reader = new FileReader();
				reader.onload = (evt) => {
					if (evt.target?.result) setImageUrl(evt.target.result as string);
				};
				reader.readAsDataURL(file);
			}
			if (!title) {
				setTitle(file.name.replace(/\.[^/.]+$/, ''));
			}
		}
	};

	const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const filePath = (file as any).path;
			if (filePath) {
				setLocalAudioSource(filePath);
			} else {
				const reader = new FileReader();
				reader.onload = (evt) => {
					if (evt.target?.result)
						setLocalAudioSource(evt.target.result as string);
				};
				reader.readAsDataURL(file);
			}
			setLocalPathError(null);
			if (!title) {
				setTitle(file.name.replace(/\.[^/.]+$/, ''));
			}
		}
	};

	const handlePickAudio = async () => {
		if (DesktopBridge.isTauri()) {
			const picked = await DesktopBridge.pickAudioFile();
			if (picked) {
				setLocalAudioSource(picked);
				setLocalPathError(null);
				if (!title) {
					const fileName = picked
						.split(/[/\\]/)
						.pop()
						?.replace(/\.[^/.]+$/, '');
					if (fileName) setTitle(fileName);
				}
				return;
			}
		}
		audioInputRef.current?.click();
	};

	const handlePickImage = async () => {
		if (DesktopBridge.isTauri()) {
			const picked = await DesktopBridge.pickImageFile();
			if (picked) {
				setImageUrl(picked);
				if (!title) {
					const fileName = picked
						.split(/[/\\]/)
						.pop()
						?.replace(/\.[^/.]+$/, '');
					if (fileName) setTitle(fileName);
				}
				return;
			}
		}
		imageInputRef.current?.click();
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const activeSource =
			sourceType === 'local'
				? localAudioSource.trim()
				: streamAudioSource.trim();

		if (
			sourceType === 'local' &&
			activeSource &&
			!isValidLocalAudioSource(activeSource)
		) {
			setLocalPathError(t('trackForm.invalidLocalAudioPath'));
			return;
		}

		onSave({
			title: title.trim() || t('trackForm.defaultTitle'),
			imageUrl: imageUrl.trim(),
			audioSource: activeSource,
			sourceType,
			playMode: sourceType === 'stream' ? 'oneshot' : playMode,
			loopRegion,
		});
		onClose();
	};

	const isLocalSourceInvalid =
		sourceType === 'local' &&
		localAudioSource.trim() !== '' &&
		!isValidLocalAudioSource(localAudioSource);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop close
		// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop close
		<div className="track-modal-backdrop" onClick={onClose}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation */}
			<div className="track-modal" onClick={(e) => e.stopPropagation()}>
				<div className="track-modal__header">
					<h3>
						{initialData?.title
							? t('trackForm.editTitle')
							: t('trackForm.createTitle')}
					</h3>
					<button
						type="button"
						className="track-modal__close-btn"
						onClick={onClose}
					>
						<FontAwesomeIcon icon={faTimes} />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="track-modal__form">
					<div className="track-modal__field">
						<label htmlFor="track-title">{t('trackForm.titleLabel')}</label>
						<input
							id="track-title"
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={t('trackForm.titlePlaceholder')}
						/>
					</div>

					<div className="track-modal__field">
						<label htmlFor="track-image">{t('trackForm.coverLabel')}</label>
						<div className="track-modal__input-with-btn">
							<input
								id="track-image"
								type="text"
								value={imageUrl}
								onChange={(e) => setImageUrl(e.target.value)}
								placeholder={t('trackForm.coverPlaceholder')}
							/>
							<button
								type="button"
								onClick={handlePickImage}
								className="track-modal__browse-btn"
								title={t('trackForm.browse')}
							>
								<FontAwesomeIcon icon={faImage} />
							</button>
							<input
								ref={imageInputRef}
								type="file"
								accept="image/png, image/jpeg, image/jpg, image/webp, .png, .jpg, .jpeg, .webp, image/*"
								style={{ display: 'none' }}
								onChange={handleImageFileSelect}
							/>
						</div>
					</div>

					<div className="track-modal__field">
						<span className="track-modal__field-label">
							{t('trackForm.sourceTypeLabel')}
						</span>
						<div className="track-modal__toggle-group">
							<button
								type="button"
								className={`track-modal__toggle-btn ${sourceType === 'local' ? 'track-modal__toggle-btn--active' : ''}`}
								onClick={() => setSourceType('local')}
							>
								<FontAwesomeIcon icon={faFolderOpen} />
								<span>{t('trackForm.localFile')}</span>
							</button>
							<button
								type="button"
								className={`track-modal__toggle-btn ${sourceType === 'stream' ? 'track-modal__toggle-btn--active' : ''}`}
								onClick={() => setSourceType('stream')}
							>
								<FontAwesomeIcon icon={faMusic} />
								<span>{t('trackForm.streamLink')}</span>
							</button>
						</div>
					</div>

					<div className="track-modal__field">
						{sourceType === 'local' ? (
							<>
								<label htmlFor="track-audio-local">
									{t('trackForm.audioFileLabel')}
								</label>
								<div className="track-modal__input-with-btn">
									<input
										id="track-audio-local"
										type="text"
										value={localAudioSource}
										onChange={(e) => {
											setLocalAudioSource(e.target.value);
											if (localPathError) setLocalPathError(null);
										}}
										placeholder={t('trackForm.audioFilePlaceholder')}
									/>
									<button
										type="button"
										onClick={handlePickAudio}
										className="track-modal__browse-btn"
										title={t('trackForm.browse')}
									>
										<FontAwesomeIcon icon={faFolderOpen} />
									</button>
									<input
										ref={audioInputRef}
										type="file"
										accept="audio/*, .mp3, .wav, .flac, .ogg, .m4a, .aac, .aiff, .aif"
										style={{ display: 'none' }}
										onChange={handleAudioFileSelect}
									/>
								</div>
								{(localPathError || isLocalSourceInvalid) && (
									<span className="track-modal__error-msg">
										{localPathError || t('trackForm.invalidLocalAudioPath')}
									</span>
								)}
							</>
						) : (
							<>
								<label htmlFor="track-audio-stream">
									{t('trackForm.streamUrlLabel')}
								</label>
								<input
									id="track-audio-stream"
									type="text"
									value={streamAudioSource}
									onChange={(e) =>
										setStreamAudioSource(extractIframeSrc(e.target.value))
									}
									placeholder={t('trackForm.streamUrlPlaceholder')}
								/>
							</>
						)}
					</div>

					<div className="track-modal__field">
						<span className="track-modal__field-label">
							{t('trackForm.playModeLabel')}
						</span>
						<div className="track-modal__toggle-group">
							<button
								type="button"
								className={`track-modal__toggle-btn ${playMode === 'oneshot' ? 'track-modal__toggle-btn--active' : ''}`}
								onClick={() => setPlayMode('oneshot')}
							>
								<span>{t('trackForm.oneshot')}</span>
							</button>
							<button
								type="button"
								className={`track-modal__toggle-btn ${playMode === 'loop' ? 'track-modal__toggle-btn--active' : ''} ${sourceType === 'stream' ? 'track-modal__toggle-btn--disabled' : ''}`}
								onClick={() => {
									if (sourceType === 'stream') {
										setShowLoopTooltip(true);
										if (tooltipTimeoutRef.current) {
											clearTimeout(tooltipTimeoutRef.current);
										}
										tooltipTimeoutRef.current = setTimeout(() => {
											setShowLoopTooltip(false);
										}, 4000);
									} else {
										setPlayMode('loop');
									}
								}}
								title={
									sourceType === 'stream'
										? t('trackForm.loopDisabledTooltip')
										: ''
								}
							>
								<FontAwesomeIcon icon={faRepeat} />
								<span>{t('trackForm.loop')}</span>
							</button>
						</div>
						{showLoopTooltip && (
							<div className="track-modal__tooltip-banner">
								<FontAwesomeIcon icon={faInfoCircle} />
								<span>{t('trackForm.loopDisabledTooltip')}</span>
							</div>
						)}
					</div>

					{playMode === 'loop' && sourceType === 'local' && (
						<div className="track-modal__loop-widget">
							<div className="track-modal__loop-header">
								<span className="track-modal__field-label">
									{t('trackForm.loopRegionLabel')}
								</span>
								<div className="track-modal__loop-actions">
									<button
										type="button"
										className="track-modal__quick-btn"
										onClick={() =>
											setLoopRegion((prev) => ({ ...prev, start: 0 }))
										}
										title={t('trackForm.setToStart')}
									>
										{t('trackForm.setToStartShort')}
									</button>
									<button
										type="button"
										className="track-modal__quick-btn"
										onClick={() =>
											setLoopRegion((prev) => ({
												...prev,
												end: Math.round((audioDuration || 30) * 100) / 100,
											}))
										}
										title={t('trackForm.setToEnd')}
									>
										{t('trackForm.setToEndShort')}
									</button>
									<button
										type="button"
										className="track-modal__quick-btn"
										onClick={() =>
											setLoopRegion({
												start: 0,
												end: Math.round((audioDuration || 30) * 100) / 100,
											})
										}
										title={t('trackForm.setFullTrack')}
									>
										{t('trackForm.setFullTrack')}
									</button>
								</div>
							</div>

							<div className="track-modal__canvas-wrapper">
								<canvas
									ref={canvasRef}
									width={400}
									height={60}
									className="track-modal__waveform-canvas"
									onPointerDown={handleCanvasPointerDown}
									onPointerMove={handleCanvasPointerMove}
									onPointerUp={handleCanvasPointerUp}
									style={{ cursor: 'ew-resize', touchAction: 'none' }}
								/>
							</div>

							<div className="track-modal__range-inputs">
								<div className="track-modal__range-field">
									<span>{t('trackForm.startSec')}</span>
									<div className="track-modal__input-with-action">
										<input
											type="number"
											min={0}
											max={Math.max(
												0,
												(loopRegion.end || audioDuration || 30) - 0.01,
											)}
											step="any"
											value={loopRegion.start}
											onChange={(e) =>
												setLoopRegion((prev) => ({
													...prev,
													start: Math.max(0, parseFloat(e.target.value) || 0),
												}))
											}
										/>
										<button
											type="button"
											className="track-modal__snap-btn"
											onClick={() =>
												setLoopRegion((prev) => ({ ...prev, start: 0 }))
											}
											title={t('trackForm.setToStart')}
										>
											0s
										</button>
									</div>
								</div>

								<div className="track-modal__range-field">
									<span>{t('trackForm.endSec')}</span>
									<div className="track-modal__input-with-action">
										<input
											type="number"
											min={loopRegion.start + 0.01}
											max={audioDuration || 300}
											step="any"
											value={
												loopRegion.end ||
												Math.round((audioDuration || 30) * 100) / 100
											}
											onChange={(e) =>
												setLoopRegion((prev) => ({
													...prev,
													end: Math.max(
														prev.start + 0.01,
														parseFloat(e.target.value) || prev.start + 0.1,
													),
												}))
											}
										/>
										<button
											type="button"
											className="track-modal__snap-btn"
											onClick={() =>
												setLoopRegion((prev) => ({
													...prev,
													end: Math.round((audioDuration || 30) * 100) / 100,
												}))
											}
											title={t('trackForm.setToEnd')}
										>
											Max
										</button>
									</div>
								</div>
							</div>
						</div>
					)}

					<div className="track-modal__footer">
						<button
							type="button"
							className="track-modal__btn track-modal__btn--cancel"
							onClick={onClose}
						>
							{t('projectSelector.cancel')}
						</button>
						<button
							type="submit"
							className="track-modal__btn track-modal__btn--submit"
						>
							{t('projectSelector.create')}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
