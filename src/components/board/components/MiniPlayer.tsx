import {
	faCrosshairs,
	faPause,
	faPlay,
	faStop,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor } from 'tldraw';
import { audioPlayer } from '../../../core/audio/audioPlayerStore';
import { useMediaUrl } from '../../../core/utils/mediaUtils';
import './MiniPlayer.scss';

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

	const handleTogglePlayPause = () => {
		audioPlayer.togglePlayPause();
	};

	const handleStop = () => {
		audioPlayer.stop();
	};

	const handleGoToTrack = () => {
		if (!currentTrack?.shapeId) return;

		// 1. Switch to workspace tab/page if needed
		if (currentTrack.pageId) {
			const currentPageId = editor.getCurrentPageId();
			if (currentPageId !== currentTrack.pageId) {
				editor.setCurrentPage(currentTrack.pageId as any);
			}
		}

		// 2. Select shape and center camera on shape
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

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const time = parseFloat(e.target.value);
		audioPlayer.seekTo(time);
	};

	const formatTime = (secs: number) => {
		if (isNaN(secs) || secs < 0) return '0:00';
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
							{formatTime(currentTime)} / {formatTime(duration)}
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

			{currentTrack.sourceType === 'local' && duration > 0 && (
				<div className="mini-player__progress-container">
					<input
						type="range"
						min={0}
						max={duration}
						step={0.1}
						value={currentTime}
						onChange={handleSeek}
						className="mini-player__progress"
					/>
				</div>
			)}
		</div>
	);
}
