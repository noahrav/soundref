import { Position } from '../Position';
import { BoardItem } from './BoardItem';

/**
 * Domain model representing a standalone text block item on the canvas.
 */
export class TextItem extends BoardItem {
	/** Serialized type discriminant */
	public readonly type: string = 'TextItem';

	/**
	 * Creates a TextItem instance.
	 * @param position Canvas coordinates.
	 * @param content Text block string content.
	 * @param id Optional explicit UUID.
	 * @param scale Visual scale factor.
	 * @param width Optional fixed width constraint in pixels.
	 */
	constructor(
		position: Position = new Position(),
		public content: string = '',
		id?: string,
		public scale: number = 1,
		public width?: number,
	) {
		super(position, id);
	}
}
