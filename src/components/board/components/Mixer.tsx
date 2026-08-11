import { audioPlayer } from '@core/audio/audioPlayerStore';
import { mixerEngine } from '@core/audio/MixerEngine';
import { mixerStore } from '@core/audio/MixerStore';
import type { ChannelState } from '@core/model/MixerState';
import { volumeToDb } from '@core/model/MixerState';
import { useMediaUrl } from '@core/utils/mediaUtils';
import {
	faCrosshairs,
	faPause,
	faPlay,
	faSliders,
	faStop,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor } from 'tldraw';
import './Mixer.scss';

// Time formatter
const formatTime = (timeInSeconds: number) => {
	if (!Number.isFinite(timeInSeconds)) return '0:00';
	const m = Math.floor(timeInSeconds / 60);
	const s = Math.floor(timeInSeconds % 60);
	return `${m}:${s < 10 ? '0' : ''}${s}`;
};

/**
 * Custom Pointer-Captured Vertical Fader Component.
 * Provides 100% fluid 144Hz vertical drag UX via direct DOM manipulation.
 * Double-click resets volume to 0 dB (1.0).
 */
interface VerticalFaderProps {
	value: number;
	min?: number;
	max?: number;
	defaultValue?: number;
	onChange: (val: number) => void;
}

const VerticalFader = ({
	value,
	min = 0,
	max = 1.5,
	defaultValue = 1.0,
	onChange,
}: VerticalFaderProps) => {
	const trackRef = useRef<HTMLDivElement>(null);
	const fillRef = useRef<HTMLDivElement>(null);
	const thumbRef = useRef<HTMLDivElement>(null);
	const isDraggingRef = useRef(false);

	useEffect(() => {
		if (isDraggingRef.current) return;
		const percent = Math.max(
			0,
			Math.min(100, ((value - min) / (max - min)) * 100),
		);
		if (fillRef.current) fillRef.current.style.height = `${percent}%`;
		if (thumbRef.current)
			thumbRef.current.style.bottom = `calc(${percent}% - 8px)`;
	}, [value, min, max]);

	const updateFromPointer = useCallback(
		(e: React.PointerEvent | PointerEvent) => {
			if (!trackRef.current) return;
			const rect = trackRef.current.getBoundingClientRect();
			const offsetY = rect.bottom - e.clientY;
			const norm = Math.max(0, Math.min(1, offsetY / rect.height));
			const val = min + norm * (max - min);

			const percent = norm * 100;
			if (fillRef.current) fillRef.current.style.height = `${percent}%`;
			if (thumbRef.current)
				thumbRef.current.style.bottom = `calc(${percent}% - 8px)`;

			onChange(val);
		},
		[min, max, onChange],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			isDraggingRef.current = true;
			e.currentTarget.setPointerCapture(e.pointerId);
			updateFromPointer(e);
		},
		[updateFromPointer],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			if (isDraggingRef.current) {
				updateFromPointer(e);
			}
		},
		[updateFromPointer],
	);

	const handlePointerUp = useCallback((e: React.PointerEvent) => {
		e.stopPropagation();
		isDraggingRef.current = false;
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {}
	}, []);

	const handleDoubleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			const percent = Math.max(
				0,
				Math.min(100, ((defaultValue - min) / (max - min)) * 100),
			);
			if (fillRef.current) fillRef.current.style.height = `${percent}%`;
			if (thumbRef.current)
				thumbRef.current.style.bottom = `calc(${percent}% - 8px)`;
			onChange(defaultValue);
		},
		[defaultValue, min, max, onChange],
	);

	return (
		<div
			className="vertical-fader"
			role="slider"
			tabIndex={0}
			aria-valuenow={value}
			ref={trackRef}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onDoubleClick={handleDoubleClick}
			title="Double-click to reset to 0 dB"
		>
			<div className="vertical-fader__track">
				<div className="vertical-fader__fill" ref={fillRef} />
			</div>
			<div className="vertical-fader__thumb" ref={thumbRef} />
		</div>
	);
};

/**
 * Custom Pointer-Captured Pan Slider Component.
 * Supports fluid dragging, direct DOM visual updates, and double-click reset to Center (0.0).
 */
interface PanSliderProps {
	value: number;
	onChange: (val: number) => void;
}

const PanSlider = ({ value, onChange }: PanSliderProps) => {
	const trackRef = useRef<HTMLDivElement>(null);
	const thumbRef = useRef<HTMLDivElement>(null);
	const isDraggingRef = useRef(false);

	useEffect(() => {
		if (isDraggingRef.current) return;
		const percent = Math.max(0, Math.min(100, ((value + 1) / 2) * 100));
		if (thumbRef.current)
			thumbRef.current.style.left = `calc(${percent}% - 5px)`;
	}, [value]);

	const updateFromPointer = useCallback(
		(e: React.PointerEvent | PointerEvent) => {
			if (!trackRef.current) return;
			const rect = trackRef.current.getBoundingClientRect();
			const offsetX = e.clientX - rect.left;
			const norm = Math.max(0, Math.min(1, offsetX / rect.width));
			const val = -1.0 + norm * 2.0;
			const snappedVal = Math.abs(val) < 0.08 ? 0 : val;

			const percent = ((snappedVal + 1) / 2) * 100;
			if (thumbRef.current)
				thumbRef.current.style.left = `calc(${percent}% - 5px)`;

			onChange(snappedVal);
		},
		[onChange],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			isDraggingRef.current = true;
			e.currentTarget.setPointerCapture(e.pointerId);
			updateFromPointer(e);
		},
		[updateFromPointer],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			if (isDraggingRef.current) {
				updateFromPointer(e);
			}
		},
		[updateFromPointer],
	);

	const handlePointerUp = useCallback((e: React.PointerEvent) => {
		e.stopPropagation();
		isDraggingRef.current = false;
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {}
	}, []);

	const handleDoubleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (thumbRef.current) thumbRef.current.style.left = 'calc(50% - 5px)';
			onChange(0);
		},
		[onChange],
	);

	return (
		<div
			className="pan-slider"
			role="slider"
			tabIndex={0}
			aria-valuenow={value}
			ref={trackRef}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onDoubleClick={handleDoubleClick}
			title="Double-click to reset to Center"
		>
			<div className="pan-slider__track" />
			<div className="pan-slider__center-mark" />
			<div className="pan-slider__thumb" ref={thumbRef} />
		</div>
	);
};

/**
 * Custom Pointer-Captured Seek Bar Component for Transport.
 */
interface SeekSliderProps {
	currentTime: number;
	duration: number;
	onSeek: (time: number) => void;
}

const SeekSlider = ({ currentTime, duration, onSeek }: SeekSliderProps) => {
	const trackRef = useRef<HTMLDivElement>(null);
	const fillRef = useRef<HTMLDivElement>(null);
	const thumbRef = useRef<HTMLDivElement>(null);
	const isDraggingRef = useRef(false);

	useEffect(() => {
		if (isDraggingRef.current || !duration) return;
		const percent = Math.max(0, Math.min(100, (currentTime / duration) * 100));
		if (fillRef.current) fillRef.current.style.width = `${percent}%`;
		if (thumbRef.current)
			thumbRef.current.style.left = `calc(${percent}% - 6px)`;
	}, [currentTime, duration]);

	const updateFromPointer = useCallback(
		(e: React.PointerEvent | PointerEvent) => {
			if (!trackRef.current || !duration) return;
			const rect = trackRef.current.getBoundingClientRect();
			const offsetX = e.clientX - rect.left;
			const norm = Math.max(0, Math.min(1, offsetX / rect.width));
			const targetTime = norm * duration;

			const percent = norm * 100;
			if (fillRef.current) fillRef.current.style.width = `${percent}%`;
			if (thumbRef.current)
				thumbRef.current.style.left = `calc(${percent}% - 6px)`;

			onSeek(targetTime);
		},
		[duration, onSeek],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			isDraggingRef.current = true;
			e.currentTarget.setPointerCapture(e.pointerId);
			updateFromPointer(e);
		},
		[updateFromPointer],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			if (isDraggingRef.current) {
				updateFromPointer(e);
			}
		},
		[updateFromPointer],
	);

	const handlePointerUp = useCallback((e: React.PointerEvent) => {
		e.stopPropagation();
		isDraggingRef.current = false;
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {}
	}, []);

	return (
		<div
			className="seek-slider"
			ref={trackRef}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
		>
			<div className="seek-slider__track" />
			<div className="seek-slider__fill" ref={fillRef} />
			<div className="seek-slider__thumb" ref={thumbRef} />
		</div>
	);
};

/**
 * Modular ChannelStrip Component for Master and User Channels.
 * Reusable for Step 2 multi-channel expansion.
 */
interface ChannelStripProps {
	channelState: ChannelState;
	isMaster?: boolean;
	onVolumeChange: (val: number) => void;
	onPanChange: (val: number) => void;
	onMuteToggle: () => void;
	onSoloToggle: () => void;
	onDelete?: () => void;
	vuLeftRef?: (el: HTMLDivElement | null) => void;
	vuRightRef?: (el: HTMLDivElement | null) => void;
}

export const ChannelStrip = ({
	channelState,
	isMaster = false,
	onVolumeChange,
	onPanChange,
	onMuteToggle,
	onSoloToggle,
	onDelete,
	vuLeftRef,
	vuRightRef,
}: ChannelStripProps) => {
	const { t } = useTranslation();
	const dbFooterRef = useRef<HTMLDivElement>(null);
	const panValueRef = useRef<HTMLSpanElement>(null);

	const formatPan = (pan: number) => {
		if (Math.abs(pan) < 0.05) return t('mixer.panCenter');
		if (pan < 0) return `${t('mixer.panLeft')}${Math.round(-pan * 100)}`;
		return `${t('mixer.panRight')}${Math.round(pan * 100)}`;
	};

	const channelDb = volumeToDb(channelState.volume);
	const dbDisplay =
		channelState.volume === 0 ? t('mixer.infDb') : `${channelDb.toFixed(1)} dB`;

	return (
		<div
			className={`mixer__channel-strip ${isMaster ? 'mixer__channel-strip--master' : ''}`}
		>
			<div className="mixer__channel-header">
				<span>{isMaster ? t('mixer.master') : channelState.name}</span>
				{!isMaster && onDelete && (
					<button
						type="button"
						className="mixer__btn-delete-channel"
						onClick={onDelete}
					>
						&times;
					</button>
				)}
			</div>

			<div className="mixer__channel-pan">
				<PanSlider
					value={channelState.pan}
					onChange={(val) => {
						onPanChange(val);
						if (panValueRef.current) {
							panValueRef.current.textContent = formatPan(val);
						}
					}}
				/>
				<span className="mixer__pan-value" ref={panValueRef}>
					{formatPan(channelState.pan)}
				</span>
			</div>

			<div className="mixer__channel-controls">
				<button
					type="button"
					className={`mixer__btn-mute ${channelState.isMuted ? 'active' : ''}`}
					onClick={(e) => {
						e.stopPropagation();
						onMuteToggle();
					}}
				>
					M
				</button>
				<button
					type="button"
					className={`mixer__btn-solo ${channelState.isSolo ? 'active' : ''}`}
					onClick={(e) => {
						e.stopPropagation();
						onSoloToggle();
					}}
				>
					S
				</button>
			</div>

			<div className="mixer__channel-body">
				<VerticalFader
					value={channelState.volume}
					defaultValue={1.0}
					onChange={(val) => {
						onVolumeChange(val);
						if (dbFooterRef.current) {
							const db = volumeToDb(val);
							dbFooterRef.current.textContent =
								val === 0 ? t('mixer.infDb') : `${db.toFixed(1)} dB`;
						}
					}}
				/>
				<div className="mixer__vu-meter">
					<div className="mixer__vu-bar">
						<div className="mixer__vu-level" ref={vuLeftRef} />
					</div>
					<div className="mixer__vu-bar">
						<div className="mixer__vu-level" ref={vuRightRef} />
					</div>
				</div>
			</div>

			<div className="mixer__channel-footer" ref={dbFooterRef}>
				{dbDisplay}
			</div>
		</div>
	);
};

export const Mixer = () => {
	const { t } = useTranslation();
	const editor = useEditor();

	const [isOpen, setIsOpen] = useState(mixerStore.isOpen);
	const [mixerState, setMixerState] = useState(mixerStore.getState());

	const [playerState, setPlayerState] = useState(audioPlayer.getState());
	const { currentTrack, isPlaying, currentTime, duration } = playerState;

	const coverUrl = useMediaUrl(currentTrack?.imageUrl);

	const vuRefs = useRef<
		Record<
			string,
			{ left: HTMLDivElement | null; right: HTMLDivElement | null }
		>
	>({});
	const rafRef = useRef<number>(0);
	const levelRefs = useRef<Record<string, { left: number; right: number }>>({});

	useEffect(() => {
		const unsubMixer = mixerStore.subscribe(() => {
			setIsOpen(mixerStore.isOpen);
			setMixerState(mixerStore.getState());
		});
		const unsubPlayer = audioPlayer.subscribe(() => {
			setPlayerState(audioPlayer.getState());
		});
		return () => {
			unsubMixer();
			unsubPlayer();
		};
	}, []);

	useEffect(() => {
		if (!isOpen) return;

		const updateVU = () => {
			const attack = 0.95;
			const decay = 0.85;

			const updateChannelVU = (
				id: string,
				rawLevels: { left: number; right: number },
			) => {
				if (!levelRefs.current[id]) {
					levelRefs.current[id] = { left: 0, right: 0 };
				}

				const currentLevels = levelRefs.current[id];

				let nextLeft =
					rawLevels.left > currentLevels.left
						? currentLevels.left * (1 - attack) + rawLevels.left * attack
						: currentLevels.left * decay;

				let nextRight =
					rawLevels.right > currentLevels.right
						? currentLevels.right * (1 - attack) + rawLevels.right * attack
						: currentLevels.right * decay;

				if (nextLeft < 0.002) nextLeft = 0;
				if (nextRight < 0.002) nextRight = 0;

				levelRefs.current[id].left = nextLeft;
				levelRefs.current[id].right = nextRight;

				const refs = vuRefs.current[id];
				if (refs) {
					if (refs.left) {
						refs.left.style.height = `${Math.min(100, nextLeft * 100)}%`;
					}
					if (refs.right) {
						refs.right.style.height = `${Math.min(100, nextRight * 100)}%`;
					}
				}
			};

			// Update Master
			updateChannelVU('master', mixerEngine.getMasterLevels());

			// Update User Channels
			const state = mixerStore.getState();
			for (const ch of state.channels) {
				updateChannelVU(ch.id, mixerEngine.getChannelLevels(ch.id));
			}

			rafRef.current = requestAnimationFrame(updateVU);
		};

		rafRef.current = requestAnimationFrame(updateVU);
		return () => cancelAnimationFrame(rafRef.current);
	}, [isOpen]);

	const handleToggleMixer = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		mixerStore.toggleOpen();
	}, []);

	const handlePlayPause = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		audioPlayer.togglePlayPause();
	}, []);

	const handleStop = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		audioPlayer.stop();
	}, []);

	const handleSeek = useCallback((newTime: number) => {
		audioPlayer.seekTo(newTime);
	}, []);

	const handleGoToTrack = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (!currentTrack?.shapeId) return;

			if (currentTrack.pageId) {
				const currentPageId = editor.getCurrentPageId();
				if (currentPageId !== currentTrack.pageId) {
					editor.setCurrentPage(currentTrack.pageId as any);
				}
			}

			const shapeId = currentTrack.shapeId as any;
			const shape = editor.getShape(shapeId);
			if (shape) {
				editor.select(shape.id);
				const bounds = editor.getShapePageBounds(shape.id);
				if (bounds) {
					const center = bounds.center;
					const vp = editor.getViewportPageBounds();
					const zoom = editor.getZoomLevel();
					editor.setCamera({
						x: -center.x + vp.width / (2 * zoom),
						y: -center.y + vp.height / (2 * zoom),
						z: zoom,
					});
				}
			}
		},
		[currentTrack, editor],
	);

	const handleMasterVolume = useCallback((val: number) => {
		mixerStore.setMasterVolume(val);
	}, []);

	const handleMasterPan = useCallback((val: number) => {
		mixerStore.setMasterPan(val);
	}, []);

	return (
		<>
			<button
				type="button"
				className={`mixer-toggle ${isOpen ? 'mixer-toggle--active' : ''}`}
				onClick={handleToggleMixer}
				onPointerDown={(e) => e.stopPropagation()}
				title={t('mixer.toggleMixer')}
			>
				<FontAwesomeIcon icon={faSliders} />
			</button>

			{isOpen && (
				// biome-ignore lint/a11y/noStaticElementInteractions: stop propagation for canvas
				<div
					className="mixer"
					onPointerDown={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
				>
					<div className="mixer__inner">
						{/* Transport Section */}
						<div className="mixer__transport">
							{currentTrack ? (
								<>
									<div className="mixer__transport-info">
										{coverUrl ? (
											<img
												src={coverUrl}
												alt=""
												className="mixer__transport-cover"
											/>
										) : (
											<div className="mixer__transport-cover-placeholder" />
										)}
										<div className="mixer__transport-track">
											<div
												className="mixer__transport-title"
												title={currentTrack.title}
											>
												{currentTrack.title}
											</div>
										</div>
									</div>

									<div className="mixer__transport-controls">
										<button
											type="button"
											className="mixer__btn"
											onClick={handlePlayPause}
										>
											<FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
										</button>
										<button
											type="button"
											className="mixer__btn"
											onClick={handleStop}
										>
											<FontAwesomeIcon icon={faStop} />
										</button>
										<button
											type="button"
											className="mixer__btn"
											onClick={handleGoToTrack}
										>
											<FontAwesomeIcon icon={faCrosshairs} />
										</button>
									</div>

									<div className="mixer__transport-seek">
										<span className="mixer__time">
											{formatTime(currentTime)}
										</span>
										<SeekSlider
											currentTime={currentTime}
											duration={duration}
											onSeek={handleSeek}
										/>
										<span className="mixer__time">{formatTime(duration)}</span>
									</div>
								</>
							) : (
								<div className="mixer__transport-empty">No track playing</div>
							)}
						</div>

						<div className="mixer__channels">
							{/* Master Channel (Fixed on the left) */}
							<ChannelStrip
								channelState={mixerState.master}
								isMaster
								onVolumeChange={handleMasterVolume}
								onPanChange={handleMasterPan}
								onMuteToggle={() => mixerStore.toggleMasterMute()}
								onSoloToggle={() => mixerStore.toggleMasterSolo()}
								vuLeftRef={(el) => {
									if (!vuRefs.current.master)
										vuRefs.current.master = { left: null, right: null };
									vuRefs.current.master.left = el;
								}}
								vuRightRef={(el) => {
									if (!vuRefs.current.master)
										vuRefs.current.master = { left: null, right: null };
									vuRefs.current.master.right = el;
								}}
							/>

							{/* User Channels (Scrollable container to the right of Master) */}
							<div className="mixer__user-channels">
								{mixerState.channels.map((ch) => (
									<ChannelStrip
										key={ch.id}
										channelState={ch}
										onVolumeChange={(val) =>
											mixerStore.setChannelVolume(ch.id, val)
										}
										onPanChange={(val) => mixerStore.setChannelPan(ch.id, val)}
										onMuteToggle={() => mixerStore.toggleChannelMute(ch.id)}
										onSoloToggle={() => mixerStore.toggleChannelSolo(ch.id)}
										onDelete={() => mixerStore.removeChannel(ch.id)}
										vuLeftRef={(el) => {
											if (!vuRefs.current[ch.id])
												vuRefs.current[ch.id] = { left: null, right: null };
											vuRefs.current[ch.id].left = el;
										}}
										vuRightRef={(el) => {
											if (!vuRefs.current[ch.id])
												vuRefs.current[ch.id] = { left: null, right: null };
											vuRefs.current[ch.id].right = el;
										}}
									/>
								))}
								<div className="mixer__add-channel">
									<button
										type="button"
										className="mixer__btn-add-channel"
										onClick={() => mixerStore.addChannel()}
									>
										+ Add Channel
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
};
