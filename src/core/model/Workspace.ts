import type { BoardItem } from './item/BoardItem';
import { ViewportState } from './ViewportState';

export class Workspace {
	public id: string;
	public name: string;
	public viewportState: ViewportState;
	public items: Map<string, BoardItem>;

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

	public addBoardItem(newItem: BoardItem): string {
		if (!newItem.id) {
			newItem.id = crypto.randomUUID();
		}
		this.items.set(newItem.id, newItem);
		return newItem.id;
	}

	public deleteBoardItem(itemId: string): BoardItem | undefined {
		const item = this.items.get(itemId);
		this.items.delete(itemId);
		return item;
	}
}
