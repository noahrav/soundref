import { Position } from '../Position';

/**
 * Abstract base class representing an item placed on the canvas board.
 */
export abstract class BoardItem {
	/** Unique ID string of the item */
	public id: string;

	/**
	 * Creates a BoardItem instance.
	 * @param position Position coordinates on the canvas.
	 * @param id Optional explicit UUID string.
	 */
	constructor(
		public position: Position = new Position(),
		id?: string,
	) {
		this.id = id || crypto.randomUUID();
	}
}
