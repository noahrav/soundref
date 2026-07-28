import { Position } from '../Position';

export abstract class BoardItem {
	public id: string;

	constructor(
		public position: Position = new Position(),
		id?: string,
	) {
		this.id = id || crypto.randomUUID();
	}
}
