import { Position } from '../Position';
import { BoardItem } from './BoardItem';

export class TextItem extends BoardItem {
	public readonly type: string = 'TextItem';

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
