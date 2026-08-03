import { BoardItem } from '@core/model/item/BoardItem';
import type { Position } from '@core/model/Position';

/**
 * Domain model representing an organizational section container box on the workspace board.
 */
export class SectionItem extends BoardItem {
	public title: string;
	public color: string;
	public width: number;
	public height: number;

	constructor(
		position: Position,
		title = 'Section',
		id?: string,
		color = 'blue',
		width = 400,
		height = 300,
	) {
		super(position, id);
		this.title = title;
		this.color = color;
		this.width = width;
		this.height = height;
	}
}
