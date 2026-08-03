import { ImageShapeUtil } from '@components/board/config/ImageShapeUtil';
import { SectionShapeUtil } from '@components/board/config/SectionShapeUtil';
import { TrackShapeUtil } from '@components/board/config/TrackShapeUtil';
import {
	NoteShapeUtil,
	resizeScaled,
	type TLNoteShape,
	type TLResizeInfo,
} from 'tldraw';

/**
 * Custom Note shape utility overriding standard tldraw sticky note behaviors (disabling rotation, enabling scaling).
 */
export class CustomNoteShapeUtil extends NoteShapeUtil {
	static override type = 'note' as const;

	/**
	 * Hides default rotation handle on sticky note shapes.
	 */
	override hideRotateHandle() {
		return true;
	}

	/**
	 * Shows resize handles on sticky notes.
	 */
	override hideResizeHandles() {
		return false;
	}

	/**
	 * Locks rotation angle to zero.
	 */
	override onRotate(_initial: TLNoteShape, current: TLNoteShape) {
		return { ...current, rotation: 0 };
	}

	/**
	 * Handles shape resize scaling.
	 */
	override onResize(shape: TLNoteShape, info: TLResizeInfo<TLNoteShape>) {
		return resizeScaled(shape, info);
	}
}

/**
 * Registered custom shape utilities array for the tldraw component instance.
 */
export const customShapeUtils = [
	CustomNoteShapeUtil,
	TrackShapeUtil,
	SectionShapeUtil,
	ImageShapeUtil,
];
