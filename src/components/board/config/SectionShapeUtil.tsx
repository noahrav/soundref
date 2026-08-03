import { SectionComponent } from '@components/board/config/SectionComponent';
import type {
	TLDefaultColorStyle,
	TLResizeInfo,
	TLShape,
	TLShapeId,
} from 'tldraw';
import { BaseBoxShapeUtil, Rectangle2d } from 'tldraw';

declare module 'tldraw' {
	export interface TLGlobalShapePropsMap {
		section: {
			title: string;
			color: TLDefaultColorStyle;
			w: number;
			h: number;
		};
	}
}

/**
 * Type alias representing a tldraw section shape.
 */
export type TLSectionShape = TLShape<'section'>;

/**
 * tldraw ShapeUtil implementation for rendering organizational section boxes on the canvas.
 */
export class SectionShapeUtil extends BaseBoxShapeUtil<TLSectionShape> {
	static override type = 'section' as const;

	/** Storage cache for child shapes contained within the section when translation starts */
	private translateChildrenCache: Array<{
		id: TLShapeId;
		type: string;
		x: number;
		y: number;
	}> = [];

	/**
	 * Returns default properties for new section shapes.
	 */
	override getDefaultProps(): TLSectionShape['props'] {
		return {
			title: 'Section',
			color: 'blue',
			w: 400,
			h: 300,
		};
	}

	/**
	 * Hides default rotation handle on section boxes.
	 */
	override hideRotateHandle() {
		return true;
	}

	/**
	 * Locks rotation angle to zero.
	 */
	override onRotate(_initial: TLSectionShape, current: TLSectionShape) {
		return { ...current, rotation: 0 };
	}

	/**
	 * Marks section as an editable shape so tldraw handles double-clicks for editing
	 * instead of spawning a default text tool shape.
	 */
	override canEdit() {
		return true;
	}

	/**
	 * Sets editing shape on double click.
	 */
	override onDoubleClick(shape: TLSectionShape) {
		this.editor.setEditingShape(shape.id);
	}

	/**
	 * Called when user starts dragging/translating the section box.
	 * Caches all shapes currently contained within section bounds.
	 */
	override onTranslateStart(shape: TLSectionShape) {
		const pageShapes = this.editor.getCurrentPageShapes();
		const boxX = shape.x;
		const boxY = shape.y;
		const boxW = shape.props.w;
		const boxH = shape.props.h;

		this.translateChildrenCache = pageShapes
			.filter((s) => {
				if (s.id === shape.id) return false;
				const sW = (s.props as any)?.w || 100;
				const sH = (s.props as any)?.h || 100;
				const centerX = s.x + sW / 2;
				const centerY = s.y + sH / 2;
				return (
					centerX >= boxX &&
					centerX <= boxX + boxW &&
					centerY >= boxY &&
					centerY <= boxY + boxH
				);
			})
			.map((s) => ({
				id: s.id,
				type: s.type,
				x: s.x,
				y: s.y,
			}));
	}

	/**
	 * Called as user translates section box across canvas.
	 * Moves all cached contained child shapes by the translation delta.
	 */
	override onTranslate(initial: TLSectionShape, current: TLSectionShape) {
		const dx = current.x - initial.x;
		const dy = current.y - initial.y;

		if (dx === 0 && dy === 0) return;

		this.translateChildrenCache.forEach((child) => {
			this.editor.updateShape({
				id: child.id,
				type: child.type as any,
				x: child.x + dx,
				y: child.y + dy,
			});
		});
	}

	/**
	 * Computes 2D bounding geometry of the section box shape.
	 */
	override getGeometry(shape: TLSectionShape) {
		return new Rectangle2d({
			x: 0,
			y: 0,
			width: Math.max(100, shape.props.w),
			height: Math.max(80, shape.props.h),
			isFilled: true,
		});
	}

	/**
	 * Generates SVG path for selection indicator outline.
	 */
	override getIndicatorPath(shape: TLSectionShape): Path2D {
		const path = new Path2D();
		path.rect(0, 0, Math.max(100, shape.props.w), Math.max(80, shape.props.h));
		return path;
	}

	/**
	 * Renders React component representation of the section box.
	 */
	override component(shape: TLSectionShape) {
		return <SectionComponent shape={shape} />;
	}

	/**
	 * Renders selection indicator bounding box.
	 */
	override indicator(shape: TLSectionShape) {
		return (
			<rect
				width={Math.max(100, shape.props.w)}
				height={Math.max(80, shape.props.h)}
				rx={0}
				ry={0}
			/>
		);
	}

	/**
	 * Handles shape resize interaction.
	 */
	override onResize(
		_shape: TLSectionShape,
		info: TLResizeInfo<TLSectionShape>,
	) {
		return {
			props: {
				w: Math.max(120, info.initialShape.props.w * info.scaleX),
				h: Math.max(80, info.initialShape.props.h * info.scaleY),
			},
		};
	}
}
