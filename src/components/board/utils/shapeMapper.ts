import { ImageItem } from '@core/model/item/ImageItem';
import { SectionItem } from '@core/model/item/SectionItem';
import { StickyNoteItem } from '@core/model/item/StickyNoteItem';
import { TextItem } from '@core/model/item/TextItem';
import { TrackItem } from '@core/model/item/TrackItem';
import type { Editor, TLShapeId } from 'tldraw';
import { fromRichText, toRichText } from './richText';

/**
 * Extracts plain text string content from raw note or text shape properties.
 * @param props Raw shape props object.
 * @returns Plain text string.
 */
export function extractNoteContent(props: any): string {
	if (!props) return '';
	if (typeof props.text === 'string' && props.text) return props.text;
	if (props.richText) {
		const rich = fromRichText(props.richText);
		if (rich) return rich;
	}
	return props.text || '';
}

/**
 * Sends a shape to the back of the z-index stack, but keeps section shapes behind it.
 * @param editor tldraw Editor instance.
 * @param shapeId Target shape ID.
 */
export function sendShapeToBackAboveSections(
	editor: Editor,
	shapeId: TLShapeId,
): void {
	editor.sendToBack([shapeId]);
	const sectionIds = editor
		.getCurrentPageShapes()
		.filter((s) => s.type === 'section')
		.map((s) => s.id);
	if (sectionIds.length > 0) {
		editor.sendToBack(sectionIds);
	}
}

/**
 * Converts a tldraw shape object to a domain item payload for synchronization.
 * @param shape tldraw shape object.
 * @returns Serialized domain item payload or null if unrecognized shape.
 */
export function shapeToDomainPayload(shape: any): any | null {
	const cleanId = shape.id.replace(/^shape:/, '');
	const p = shape.props as any;

	if (shape.type === 'note') {
		return {
			id: cleanId,
			type: 'StickyNoteItem',
			x: shape.x,
			y: shape.y,
			content: extractNoteContent(p),
			scale: p?.scale || 1,
			color: p?.color || 'yellow',
		};
	}
	if (shape.type === 'text') {
		return {
			id: cleanId,
			type: 'TextItem',
			x: shape.x,
			y: shape.y,
			content: extractNoteContent(p),
			scale: p?.scale || 1,
			width: p?.w,
		};
	}
	if (shape.type === 'track') {
		return {
			id: cleanId,
			type: 'TrackItem',
			x: shape.x,
			y: shape.y,
			title: p?.title || 'Track',
			imageUrl: p?.imageUrl || '',
			audioSource: p?.audioSource || '',
			sourceType: p?.sourceType || 'local',
			playMode: p?.playMode || 'oneshot',
			loopRegion: p?.loopRegion || { start: 0, end: 0 },
			scale: p?.scale || 1,
			width: p?.w || 200,
		};
	}
	if (shape.type === 'image_item') {
		return {
			id: cleanId,
			type: 'ImageItem',
			x: shape.x,
			y: shape.y,
			imageUrl: p?.imageUrl || '',
			scale: p?.scale || 1,
			width: p?.w || 300,
			height: p?.h || 300,
		};
	}
	if (shape.type === 'section') {
		return {
			id: cleanId,
			type: 'SectionItem',
			x: shape.x,
			y: shape.y,
			title: p?.title || 'Section',
			color: p?.color || 'blue',
			width: p?.w || 400,
			height: p?.h || 300,
		};
	}
	return null;
}

/**
 * Creates or updates a tldraw shape from a domain item in the specified editor.
 * @param editor tldraw Editor instance.
 * @param item Domain BoardItem instance.
 * @param shapeId Target TLShapeId.
 */
export function createShapeFromDomainItem(
	editor: Editor,
	item: any,
	shapeId: TLShapeId,
): void {
	if (item instanceof TextItem || item.type === 'TextItem') {
		const textItem = item as TextItem;
		editor.createShape({
			id: shapeId,
			type: 'text',
			x: item.position.x,
			y: item.position.y,
			props: {
				richText: toRichText(textItem.content || ''),
				scale: textItem.scale || 1,
				w: textItem.width || 200,
				autoSize: !textItem.width,
			},
		});
	} else if (item instanceof TrackItem || item.type === 'TrackItem') {
		const trackItem = item as TrackItem;
		editor.createShape({
			id: shapeId,
			type: 'track',
			x: item.position.x,
			y: item.position.y,
			props: {
				title: trackItem.title || 'Track',
				imageUrl: trackItem.imageUrl || '',
				audioSource: trackItem.audioSource || '',
				sourceType: trackItem.sourceType || 'local',
				playMode: trackItem.playMode || 'oneshot',
				loopRegion: trackItem.loopRegion || { start: 0, end: 0 },
				w: trackItem.width || 200,
				h: trackItem.width || 200,
			},
		});
	} else if (item instanceof ImageItem || item.type === 'ImageItem') {
		const imageItem = item as ImageItem;
		editor.createShape({
			id: shapeId,
			type: 'image_item',
			x: item.position.x,
			y: item.position.y,
			props: {
				imageUrl: imageItem.imageUrl || '',
				scale: imageItem.scale || 1,
				w: imageItem.width || 300,
				h: imageItem.height || 300,
			},
		});
		sendShapeToBackAboveSections(editor, shapeId);
	} else if (item instanceof SectionItem || item.type === 'SectionItem') {
		const sectionItem = item as SectionItem;
		editor.createShape({
			id: shapeId,
			type: 'section',
			x: item.position.x,
			y: item.position.y,
			props: {
				title: sectionItem.title || 'Section',
				color: (sectionItem.color || 'blue') as any,
				w: sectionItem.width || 400,
				h: sectionItem.height || 300,
			},
		});
		editor.sendToBack([shapeId]);
	} else if (
		item instanceof StickyNoteItem ||
		item.type === 'StickyNoteItem' ||
		item.type === 'note'
	) {
		const stickyItem = item as StickyNoteItem;
		editor.createShape({
			id: shapeId,
			type: 'note',
			x: item.position.x,
			y: item.position.y,
			props: {
				color: (stickyItem.color || 'yellow') as any,
				richText: toRichText(stickyItem.content || ''),
				scale: stickyItem.scale || 1,
			},
		});
	}
}
