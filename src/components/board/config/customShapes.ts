import {
	NoteShapeUtil,
	resizeScaled,
	type TLNoteShape,
	type TLResizeInfo,
} from 'tldraw';

export class CustomNoteShapeUtil extends NoteShapeUtil {
	static override type = 'note' as const;

	override hideResizeHandles() {
		return false;
	}

	override onResize(shape: TLNoteShape, info: TLResizeInfo<TLNoteShape>) {
		return resizeScaled(shape, info);
	}
}

export const customShapeUtils = [CustomNoteShapeUtil];
