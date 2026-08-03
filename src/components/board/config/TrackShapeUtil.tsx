import type { TLResizeInfo, TLShape } from 'tldraw';
import { BaseBoxShapeUtil, Rectangle2d, resizeScaled } from 'tldraw';
import { TrackCardComponent } from '@components/board/config/TrackCardComponent';

declare module 'tldraw' {
	export interface TLGlobalShapePropsMap {
		track: {
			title: string;
			imageUrl: string;
			audioSource: string;
			sourceType: 'local' | 'stream';
			playMode: 'oneshot' | 'loop';
			loopRegion: { start: number; end: number };
			scale: number;
			w: number;
			h: number;
		};
	}
}

/**
 * Type alias representing a tldraw track shape.
 */
export type TLTrackShape = TLShape<'track'>;

/**
 * tldraw ShapeUtil implementation for rendering audio track cards on the canvas board.
 */
export class TrackShapeUtil extends BaseBoxShapeUtil<TLTrackShape> {
	static override type = 'track' as const;

	/**
	 * Returns default properties for new track shapes.
	 */
	override getDefaultProps(): TLTrackShape['props'] {
		return {
			title: 'Track',
			imageUrl: '',
			audioSource: '',
			sourceType: 'local',
			playMode: 'oneshot',
			loopRegion: { start: 0, end: 0 },
			scale: 1,
			w: 200,
			h: 200,
		};
	}

	/**
	 * Hides default rotation handle on track cards.
	 */
	override hideRotateHandle() {
		return true;
	}

	/**
	 * Locks rotation angle to zero.
	 */
	override onRotate(_initial: TLTrackShape, current: TLTrackShape) {
		return { ...current, rotation: 0 };
	}

	/**
	 * Triggers custom edit event on double click.
	 */
	override onDoubleClick(shape: TLTrackShape) {
		window.dispatchEvent(
			new CustomEvent('soundref:edit-track', { detail: shape }),
		);
	}

	/**
	 * Computes 2D bounding geometry of the track shape.
	 */
	override getGeometry(shape: TLTrackShape) {
		return new Rectangle2d({
			x: 0,
			y: 0,
			width: shape.props.w,
			height: shape.props.h,
			isFilled: true,
		});
	}

	/**
	 * Generates SVG path for selection indicator outline.
	 */
	override getIndicatorPath(shape: TLTrackShape): Path2D {
		const path = new Path2D();
		const size = Math.min(shape.props.w, shape.props.h);
		path.rect(0, 0, size, size);
		return path;
	}

	/**
	 * Renders React component representation of the track.
	 */
	override component(shape: TLTrackShape) {
		return <TrackCardComponent shape={shape} />;
	}

	/**
	 * Renders selection indicator bounding box.
	 */
	override indicator(shape: TLTrackShape) {
		const size = Math.min(shape.props.w, shape.props.h);
		return <rect width={size} height={size} rx={4} ry={4} />;
	}

	/**
	 * Handles shape resize interaction.
	 */
	override onResize(shape: TLTrackShape, info: TLResizeInfo<TLTrackShape>) {
		return resizeScaled(shape, info);
	}
}
