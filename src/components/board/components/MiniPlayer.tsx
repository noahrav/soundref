import {
	faCrosshairs,
	faPause,
	faPlay,
	faRepeat,
	faStop,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor } from 'tldraw';
import { audioPlayer } from '../../../core/audio/audioPlayerStore';
import { useMediaUrl } from '../../../core/utils/mediaUtils';
import { parseStreamUrl } from '../utils/embedUtils';
import './MiniPlayer.scss';

/**
 * MiniPlayer component rendering global floating playback controls,
 * loop progress bar, location navigation, and iframe streaming embeds.
 */
export function MiniPlayer() {
	const { t } = useTranslation();
	const editor = useEditor();
	const [playerState, setPlayerState] = useState(audioPlayer.getState());

	useEffect(() => {
		const unsubscribe = audioPlayer.subscribe(() => {
			setPlayerState(audioPlayer.getState());
		});
		return unsubscribe;
	}, []);

	const { currentTrack, isPlaying, currentTime, duration } = playerState;
	const resolvedCoverUrl = useMediaUrl(currentTrack?.imageUrl);

	if (!currentTrack) return null;

	const isLoop =
		currentTrack.playMode === 'loop' &&
		currentTrack.sourceType === 'local' &&
		duration > 0;

	const loopStart = currentTrack.loopRegion?.start ?? 0;
	const rawLoopEnd = currentTrack.loopRegion?.end ?? 0;
	const loopEnd =
		rawLoopEnd > loopStart ? Math.min(duration, rawLoopEnd) : duration;
	const effectiveStart = Math.min(loopEnd, Math.max(0, loopStart));
	const displayDuration = isLoop ? loopEnd - effectiveStart : duration;
	const displayTime = isLoop
		? Math.max(0, Math.min(displayDuration, currentTime - effectiveStart))
		: currentTime;

	const streamInfo = currentTrack.audioSource
		? parseStreamUrl(currentTrack.audioSource)
		: { isStream: false };

	/**
	 * Toggles play and pause state for the active track.
	 */
	const handleTogglePlayPause = () => {
		audioPlayer.togglePlayPause();
	};

	/**
	 * Stops audio playback and closes active track state.
	 */
	const handleStop = () => {
		audioPlayer.stop();
	};

	/**
	 * Centers the tldraw camera view onto the canvas track card.
	 */
	const handleGoToTrack = () => {
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
	};

	/**
	 * Handles manual slider seek interactions.
	 * @param e Change event from the range input element.
	 */
	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const timeVal = parseFloat(e.target.value);
		const targetTime = isLoop ? effectiveStart + timeVal : timeVal;
		audioPlayer.seekTo(targetTime);
	};

	/**
	 * Formats raw seconds into human readable M:SS string representation.
	 * @param secs Seconds timestamp.
	 * @returns Formatted time string.
	 */
	const formatTime = (secs: number) => {
		if (Number.isNaN(secs) || secs < 0) return '0:00';
		const m = Math.floor(secs / 60);
		const s = Math.floor(secs % 60);
		return `${m}:${s < 10 ? '0' : ''}${s}`;
	};

	return (
		<div className="mini-player">
			<div className="mini-player__main">
				{resolvedCoverUrl ? (
					<img
						src={resolvedCoverUrl}
						alt={currentTrack.title}
						className="mini-player__cover"
					/>
				) : (
					<div className="mini-player__cover-placeholder">♫</div>
				)}

				<div className="mini-player__info">
					<span className="mini-player__title" title={currentTrack.title}>
						{currentTrack.title}
					</span>
					{currentTrack.sourceType === 'local' && (
						<span className="mini-player__time">
							{isLoop && (
								<FontAwesomeIcon
									icon={faRepeat}
									style={{ marginRight: 4, fontSize: '0.85em' }}
									title={t('trackForm.loop')}
								/>
							)}
							{formatTime(displayTime)} / {formatTime(displayDuration)}
						</span>
					)}
				</div>

				<div className="mini-player__controls">
					<button
						type="button"
						className="mini-player__btn"
						onClick={handleTogglePlayPause}
						title={isPlaying ? t('miniPlayer.pause') : t('miniPlayer.play')}
					>
						<FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
					</button>

					<button
						type="button"
						className="mini-player__btn"
						onClick={handleStop}
						title={t('miniPlayer.stop')}
					>
						<FontAwesomeIcon icon={faStop} />
					</button>

					{currentTrack.shapeId && (
						<button
							type="button"
							className="mini-player__btn mini-player__btn--goto"
							onClick={handleGoToTrack}
							title={t('miniPlayer.goToTrack')}
						>
							<FontAwesomeIcon icon={faCrosshairs} />
							<span>{t('miniPlayer.goToTrackShort')}</span>
						</button>
					)}
				</div>
			</div>

			{currentTrack.sourceType === 'local' && displayDuration > 0 && (
				<div className="mini-player__progress-container">
					<input
						type="range"
						min={0}
						max={displayDuration}
						step={0.1}
						value={displayTime}
						onChange={handleSeek}
						className="mini-player__progress"
					/>
				</div>
			)}

			{streamInfo.isStream && streamInfo.embedUrl && (
				<div className="mini-player__stream-embed">
					<iframe
						src={streamInfo.embedUrl}
						title={currentTrack.title}
						width="100%"
						height={streamInfo.height || '120'}
						frameBorder="0"
						allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
						allowFullScreen
					/>
				</div>
			)}
		</div>
	);
}
