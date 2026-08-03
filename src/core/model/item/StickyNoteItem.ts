import { Position } from '@core/model/Position';
import { BoardItem } from '@core/model/item/BoardItem';

/**
 * Domain model representing a sticky note item on the canvas.
 */
export class StickyNoteItem extends BoardItem {
	/** Serialized type discriminant */
	public readonly type: string = 'StickyNoteItem';

	/**
	 * Creates a StickyNoteItem instance.
	 * @param position Canvas coordinates.
	 * @param content Note text content.
	 * @param id Optional explicit UUID.
	 * @param scale Visual scale factor.
	 * @param color Note background color theme.
	 */
	constructor(
		position: Position = new Position(),
		public content: string = '',
		id?: string,
		public scale: number = 1,
		public color: string = 'yellow',
	) {
		super(position, id);
	}
}
