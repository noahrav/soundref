import type { TLResizeInfo, TLShape } from 'tldraw';
import { BaseBoxShapeUtil, Rectangle2d, resizeScaled } from 'tldraw';
import { TrackCardComponent } from './TrackCardComponent';

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

export type TLTrackShape = TLShape<'track'>;

export class TrackShapeUtil extends BaseBoxShapeUtil<TLTrackShape> {
	static override type = 'track' as const;

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

	override hideRotateHandle() {
		return true;
	}

	override onRotate(_initial: TLTrackShape, current: TLTrackShape) {
		return { ...current, rotation: 0 };
	}

	override onDoubleClick(shape: TLTrackShape) {
		window.dispatchEvent(
			new CustomEvent('soundref:edit-track', { detail: shape }),
		);
	}

	override getGeometry(shape: TLTrackShape) {
		return new Rectangle2d({
			x: 0,
			y: 0,
			width: shape.props.w,
			height: shape.props.h,
			isFilled: true,
		});
	}

	override getIndicatorPath(shape: TLTrackShape): Path2D {
		const path = new Path2D();
		const size = Math.min(shape.props.w, shape.props.h);
		path.rect(0, 0, size, size);
		return path;
	}

	override component(shape: TLTrackShape) {
		return <TrackCardComponent shape={shape} />;
	}

	override indicator(shape: TLTrackShape) {
		const size = Math.min(shape.props.w, shape.props.h);
		return <rect width={size} height={size} rx={4} ry={4} />;
	}

	override onResize(shape: TLTrackShape, info: TLResizeInfo<TLTrackShape>) {
		return resizeScaled(shape, info);
	}
}
