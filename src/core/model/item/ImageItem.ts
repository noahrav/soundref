import { BoardItem } from '@core/model/item/BoardItem';
import { Position } from '@core/model/Position';

/**
 * Domain model representing a standalone image element placed on the canvas board.
 */
export class ImageItem extends BoardItem {
	/** Serialized type discriminant */
	public readonly type: string = 'ImageItem';

	/**
	 * Creates an ImageItem instance.
	 * @param position Canvas coordinates.
	 * @param imageUrl File system path, relative assets path, or web URL.
	 * @param id Optional explicit UUID string.
	 * @param scale Visual scale factor.
	 * @param width Image container width in pixels.
	 * @param height Image container height in pixels.
	 */
	constructor(
		position: Position = new Position(),
		public imageUrl: string = '',
		id?: string,
		public scale: number = 1,
		public width: number = 300,
		public height: number = 300,
	) {
		super(position, id);
	}
}
