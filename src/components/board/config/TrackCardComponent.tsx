import {
	faMusic,
	faPause,
	faPlay,
	faRepeat,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HTMLContainer, useEditor } from 'tldraw';
import { audioPlayer } from '../../../core/audio/audioPlayerStore';
import { useMediaUrl } from '../../../core/utils/mediaUtils';
import type { TLTrackShape } from './TrackShapeUtil';

/**
 * Renders an animated HTML canvas spectrogram overlay when audio playback is active.
 * Uses real-time Web Audio API frequency data or smooth fallback visualizer frames.
 * @param isPlaying Boolean flag indicating if playback is currently active.
 * @param width Canvas width in pixels.
 * @param height Canvas height in pixels.
 */
function SpectrogramOverlay({
	isPlaying,
	width,
	height,
}: {
	isPlaying: boolean;
	width: number;
	height: number;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (!isPlaying) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let animId: number;
		let lastFrameTime = 0;
		const barCount = 24;
		const freqs = Array.from({ length: barCount }, () => 0.1);

		const gradient = ctx.createLinearGradient(0, height, 0, 0);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
		gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.75)');
		gradient.addColorStop(1, 'rgba(255, 255, 255, 0.95)');

		const render = (time: number) => {
			animId = requestAnimationFrame(render);
			if (time - lastFrameTime < 33) return;
			lastFrameTime = time;

			ctx.clearRect(0, 0, width, height);

			const rawData = audioPlayer.getRealtimeFrequencyData();
			const hasRealData = rawData?.some((v) => v > 0);

			const gap = 3;
			const totalGaps = (barCount - 1) * gap;
			const barWidth = Math.max(2, (width - totalGaps) / barCount);

			ctx.fillStyle = gradient;

			for (let i = 0; i < barCount; i++) {
				let norm = 0;
				if (hasRealData && rawData.length > 0) {
					const dataIdx = Math.floor((i / barCount) * rawData.length);
					norm = rawData[dataIdx] / 255;
				} else {
					const timeSec = time / 1000;
					norm = Math.max(
						0.08,
						Math.abs(Math.cos(timeSec * 2 + i * 0.35)) * 0.6,
					);
				}

				freqs[i] += (norm - freqs[i]) * 0.4;

				const barHeight = Math.max(4, freqs[i] * (height * 0.75));
				const x = i * (barWidth + gap);
				const y = height - barHeight;

				ctx.fillRect(x, y, barWidth, barHeight);
			}

			ctx.fillStyle = '#ffffff';
			for (let i = 0; i < barCount; i++) {
				const barHeight = Math.max(4, freqs[i] * (height * 0.75));
				const x = i * (barWidth + gap);
				const y = height - barHeight;
				ctx.fillRect(x, Math.max(0, y - 2), barWidth, 2);
			}
		};

		animId = requestAnimationFrame(render);

		return () => {
			if (animId) cancelAnimationFrame(animId);
		};
	}, [isPlaying, width, height]);

	if (!isPlaying) return null;

	return (
		<canvas
			ref={canvasRef}
			width={width}
			height={height}
			style={{
				position: 'absolute',
				inset: 0,
				pointerEvents: 'none',
				zIndex: 3,
			}}
		/>
	);
}

/**
 * Component rendering the visual card representation of a track shape on the tldraw board.
 * Includes cover image preview, play/pause controls, spectrogram overlay, and double-click editor launcher.
 * @param shape TLTrackShape object passed from tldraw ShapeUtil.
 */
export function TrackCardComponent({ shape }: { shape: TLTrackShape }) {
	const editor = useEditor();

	/**
	 * Computes whether this track is currently active or playing in the global audio store.
	 * @returns Object with isPlayingThis and isActiveThis boolean flags.
	 */
	const checkState = useCallback(() => {
		const state = audioPlayer.getState();
		const isPlayingThis =
			state.currentTrack?.shapeId === shape.id && state.isPlaying;
		const isActiveThis = state.currentTrack?.shapeId === shape.id;
		return { isPlayingThis, isActiveThis };
	}, [shape.id]);

	const [playingStatus, setPlayingStatus] = useState(checkState);
	const {
		title,
		imageUrl,
		audioSource,
		sourceType,
		playMode,
		loopRegion,
		w,
		h,
	} = shape.props;
	const resolvedImageUrl = useMediaUrl(imageUrl);

	useEffect(() => {
		const unsubscribe = audioPlayer.subscribe(() => {
			const next = checkState();
			setPlayingStatus((prev) => {
				if (
					prev.isPlayingThis === next.isPlayingThis &&
					prev.isActiveThis === next.isActiveThis
				) {
					return prev;
				}
				return next;
			});
		});
		return unsubscribe;
	}, [checkState]);

	const isThisTrackPlaying = playingStatus.isPlayingThis;
	const isThisTrackActive = playingStatus.isActiveThis;

	/**
	 * Handles click on the track play button.
	 * @param e Synthetic event.
	 */
	const handlePlayClick = (e: React.SyntheticEvent) => {
		e.stopPropagation();
		audioPlayer.playTrack({
			id: shape.id,
			shapeId: shape.id,
			pageId: editor.getCurrentPageId(),
			title: title || 'Track',
			imageUrl: imageUrl || '',
			audioSource: audioSource || '',
			sourceType: sourceType || 'local',
			playMode: playMode || 'oneshot',
			loopRegion,
		});
	};

	/**
	 * Handles double click to trigger track edit modal.
	 * @param e Mouse event.
	 */
	const handleDoubleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		window.dispatchEvent(
			new CustomEvent('soundref:edit-track', { detail: shape }),
		);
	};

	const size = Math.min(w, h);

	return (
		<HTMLContainer
			style={{
				width: '100%',
				height: '100%',
				pointerEvents: 'none',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: track card double click */}
			<div
				className={`track-card ${isThisTrackActive ? 'track-card--active' : ''}`}
				onDoubleClick={handleDoubleClick}
				style={{
					width: size,
					height: size,
					position: 'relative',
					borderRadius: '4px',
					overflow: 'hidden',
					border: '2px solid #111111',
					boxShadow: 'none',
					background: '#1a1a1a',
					userSelect: 'none',
					pointerEvents: 'auto',
				}}
			>
				{resolvedImageUrl ? (
					<img
						src={resolvedImageUrl}
						alt={title}
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'cover',
							display: 'block',
							pointerEvents: 'none',
						}}
					/>
				) : (
					<div
						style={{
							width: '100%',
							height: '100%',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							background: 'linear-gradient(135deg, #2a2a2a 0%, #111111 100%)',
							color: '#eeeeee',
							fontSize: size * 0.3,
							pointerEvents: 'none',
						}}
					>
						<FontAwesomeIcon icon={faMusic} />
					</div>
				)}

				<SpectrogramOverlay
					isPlaying={isThisTrackPlaying}
					width={size}
					height={size}
				/>

				<button
					type="button"
					onPointerDown={(e) => e.stopPropagation()}
					onClick={handlePlayClick}
					className="track-card__play-btn"
					style={{
						position: 'absolute',
						top: '50%',
						left: '50%',
						transform: 'translate(-50%, -50%)',
						zIndex: 5,
						width: Math.max(36, size * 0.25),
						height: Math.max(36, size * 0.25),
						borderRadius: '50%',
						background: '#111111',
						color: '#ffffff',
						border: '2px solid #ffffff',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						cursor: 'pointer',
						fontSize: Math.max(14, size * 0.1),
						boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
						transition: 'transform 0.12s ease, background 0.12s ease',
						pointerEvents: 'auto',
					}}
					title={isThisTrackPlaying ? 'Pause' : 'Play'}
				>
					<FontAwesomeIcon icon={isThisTrackPlaying ? faPause : faPlay} />
				</button>

				{playMode === 'loop' && (
					<div
						style={{
							position: 'absolute',
							top: 8,
							right: 8,
							zIndex: 4,
							background: '#111111',
							color: '#ffffff',
							padding: '2px 6px',
							borderRadius: '2px',
							fontSize: '10px',
							fontWeight: 600,
							display: 'flex',
							alignItems: 'center',
							gap: '4px',
							border: '1px solid #ffffff',
							pointerEvents: 'none',
						}}
					>
						<FontAwesomeIcon icon={faRepeat} style={{ fontSize: 9 }} />
						<span>LOOP</span>
					</div>
				)}

				<div
					style={{
						position: 'absolute',
						bottom: 0,
						left: 0,
						right: 0,
						zIndex: 4,
						background: 'rgba(17, 17, 17, 0.85)',
						backdropFilter: 'blur(4px)',
						color: '#ffffff',
						padding: '4px 8px',
						fontSize: Math.max(11, size * 0.06),
						fontWeight: 600,
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						textAlign: 'center',
						borderTop: '1px solid rgba(255, 255, 255, 0.2)',
						pointerEvents: 'none',
					}}
				>
					{title || 'Track'}
				</div>
			</div>
		</HTMLContainer>
	);
}
