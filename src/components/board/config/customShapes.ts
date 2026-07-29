import {
	NoteShapeUtil,
	resizeScaled,
	type TLNoteShape,
	type TLResizeInfo,
} from 'tldraw';

export class CustomNoteShapeUtil extends NoteShapeUtil {
	static override type = 'note' as const;

	override hideRotateHandle() {
		return true;
	}

	override hideResizeHandles() {
		return false;
	}

	override onRotate(_initial: TLNoteShape, current: TLNoteShape) {
		return { ...current, rotation: 0 };
	}

	override onResize(shape: TLNoteShape, info: TLResizeInfo<TLNoteShape>) {
		return resizeScaled(shape, info);
	}
}

export const customShapeUtils = [CustomNoteShapeUtil];
