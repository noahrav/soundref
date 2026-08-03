import type { BoardItem } from '@core/model/item/BoardItem';
import { ViewportState } from '@core/model/ViewportState';

/**
 * Represents an individual workspace canvas page containing items and viewport camera state.
 */
export class Workspace {
	/** Unique workspace ID string */
	public id: string;
	/** Display tab name of the workspace */
	public name: string;
	/** Viewport state camera zoom and offset */
	public viewportState: ViewportState;
	/** Map of item ID to BoardItem domain instances */
	public items: Map<string, BoardItem>;

	/**
	 * Creates a Workspace instance.
	 * @param name Name of the workspace.
	 * @param id Optional explicit UUID string.
	 * @param viewportState Optional ViewportState instance.
	 * @param items Optional pre-hydrated map of board items.
	 */
	constructor(
		name: string,
		id?: string,
		viewportState?: ViewportState,
		items?: Map<string, BoardItem>,
	) {
		this.id = id || crypto.randomUUID();
		this.name = name;
		this.viewportState = viewportState || new ViewportState();
		this.items = items || new Map<string, BoardItem>();
	}

	/**
	 * Adds a board item to the workspace.
	 * @param newItem BoardItem instance to add.
	 * @returns Assigned item ID string.
	 */
	public addBoardItem(newItem: BoardItem): string {
		if (!newItem.id) {
			newItem.id = crypto.randomUUID();
		}
		this.items.set(newItem.id, newItem);
		return newItem.id;
	}

	/**
	 * Deletes a board item by ID from the workspace.
	 * @param itemId Item ID string.
	 * @returns Deleted BoardItem instance or undefined if not found.
	 */
	public deleteBoardItem(itemId: string): BoardItem | undefined {
		const item = this.items.get(itemId);
		this.items.delete(itemId);
		return item;
	}
}
