import { ImageCardComponent } from '@components/board/config/ImageCardComponent';
import type { TLResizeInfo, TLShape } from 'tldraw';
import { BaseBoxShapeUtil, Rectangle2d } from 'tldraw';

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
	 * Clamps width and height between 30px and 4096px safety limits to prevent CPU/RAM crashes.
	 */
	override onResize(_shape: TLImageShape, info: TLResizeInfo<TLImageShape>) {
		const MAX_IMAGE_SIZE = 4096;
		const MIN_IMAGE_SIZE = 30;

		const initialW = Math.max(MIN_IMAGE_SIZE, info.initialShape.props.w || 300);
		const initialH = Math.max(MIN_IMAGE_SIZE, info.initialShape.props.h || 300);
		let aspect = initialW / initialH;
		if (!Number.isFinite(aspect) || aspect <= 0) {
			aspect = 1;
		}

		const scale =
			Math.abs(info.scaleX) > Math.abs(info.scaleY) ? info.scaleX : info.scaleY;
		let newW = Math.round(initialW * scale);
		let newH = Math.round(newW / aspect);

		if (newW > MAX_IMAGE_SIZE) {
			newW = MAX_IMAGE_SIZE;
			newH = Math.round(newW / aspect);
		}
		if (newH > MAX_IMAGE_SIZE) {
			newH = MAX_IMAGE_SIZE;
			newW = Math.round(newH * aspect);
		}

		newW = Math.max(MIN_IMAGE_SIZE, Math.min(MAX_IMAGE_SIZE, newW));
		newH = Math.max(MIN_IMAGE_SIZE, Math.min(MAX_IMAGE_SIZE, newH));

		return {
			props: {
				w: newW,
				h: newH,
			},
		};
	}
}
