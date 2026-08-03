import { Position } from '@core/model/Position';

/**
 * Represents the viewport camera zoom level and pan offset for a workspace canvas.
 */
export class ViewportState {
	/**
	 * Creates a ViewportState instance.
	 * @param zoom Camera zoom factor level.
	 * @param offset Pan position offset in 2D coordinates.
	 */
	constructor(
		public zoom: number = 1.0,
		public offset: Position = new Position(0, 0),
	) {}
}
