import { Position } from './Position';

export class ViewportState {
	constructor(
		public zoom: number = 1.0,
		public offset: Position = new Position(0, 0),
	) {}
}
