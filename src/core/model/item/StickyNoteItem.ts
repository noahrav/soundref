import { Position } from '../Position';
import { BoardItem } from './BoardItem';

export class StickyNoteItem extends BoardItem {
	public readonly type: string = 'StickyNoteItem';

	constructor(
		position: Position = new Position(),
		public content: string = '',
		id?: string,
	) {
		super(position, id);
	}
}
