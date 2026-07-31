/**
 * Represents 2D spatial coordinates (X, Y) on the canvas board.
 */
export class Position {
	/**
	 * Creates a Position instance.
	 * @param x Horizontal coordinate in pixels.
	 * @param y Vertical coordinate in pixels.
	 */
	constructor(
		public x: number = 0,
		public y: number = 0,
	) {}
}
