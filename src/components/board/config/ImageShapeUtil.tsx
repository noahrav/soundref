import type { TLResizeInfo, TLShape } from 'tldraw';
import { BaseBoxShapeUtil, Rectangle2d } from 'tldraw';
import { ImageCardComponent } from '@components/board/config/ImageCardComponent';

declare module 'tldraw' {
	export interface TLGlobalShapePropsMap {
		image_item: {
			imageUrl: string;
			scale: number;
			w: number;
			h: number;
		};
	}
}

/**
 * Type alias representing a tldraw image_item shape.
 */
export type TLImageShape = TLShape<'image_item'>;

/**
 * tldraw ShapeUtil implementation for rendering image cards on the canvas board.
 */
export class ImageShapeUtil extends BaseBoxShapeUtil<TLImageShape> {
	static override type = 'image_item' as const;

	/**
	 * Returns default properties for new image shapes.
	 */
	override getDefaultProps(): TLImageShape['props'] {
		return {
			imageUrl: '',
			scale: 1,
			w: 300,
			h: 300,
		};
	}

	/**
	 * Locks aspect ratio so resizing always preserves image proportions.
	 */
	override isAspectRatioLocked() {
		return true;
	}

	/**
	 * Allows shape resizing.
	 */
	override canResize() {
		return true;
	}

	/**
	 * Shows resize handles on image shapes.
	 */
	override hideResizeHandles() {
		return false;
	}

	/**
	 * Hides default rotation handle on image cards.
	 */
	override hideRotateHandle() {
		return true;
	}

	/**
	 * Locks rotation angle to zero.
	 */
	override onRotate(_initial: TLImageShape, current: TLImageShape) {
		return { ...current, rotation: 0 };
	}

	/**
	 * Computes 2D bounding geometry of the image shape.
	 */
	override getGeometry(shape: TLImageShape) {
		return new Rectangle2d({
			x: 0,
			y: 0,
			width: Math.max(30, shape.props.w),
			height: Math.max(30, shape.props.h),
			isFilled: true,
		});
	}

	/**
	 * Generates SVG path for selection indicator outline.
	 */
	override getIndicatorPath(shape: TLImageShape): Path2D {
		const path = new Path2D();
		path.rect(0, 0, Math.max(30, shape.props.w), Math.max(30, shape.props.h));
		return path;
	}

	/**
	 * Renders React component representation of the image.
	 */
	override component(shape: TLImageShape) {
		return <ImageCardComponent shape={shape} />;
	}

	/**
	 * Renders selection indicator bounding box.
	 */
	override indicator(shape: TLImageShape) {
		return <rect width={shape.props.w} height={shape.props.h} rx={2} ry={2} />;
	}

	/**
	 * Handles shape resize interaction, scaling proportionally to preserve aspect ratio.
	 */
	override onResize(_shape: TLImageShape, info: TLResizeInfo<TLImageShape>) {
		const initialW = Math.max(30, info.initialShape.props.w || 300);
		const initialH = Math.max(30, info.initialShape.props.h || 300);
		const aspect = initialW / initialH;

		const scale =
			Math.abs(info.scaleX) > Math.abs(info.scaleY) ? info.scaleX : info.scaleY;
		const newW = Math.max(30, Math.round(initialW * scale));
		const newH = Math.max(30, Math.round(newW / aspect));

		return {
			props: {
				w: newW,
				h: newH,
			},
		};
	}
}
