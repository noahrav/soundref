import type { BoardItem } from '../../model/item/BoardItem';
import type { Workspace } from '../../model/Workspace';
import { Command } from '../Command';

export class CreateItemCommand extends Command {
	private createdItemId: string | null = null;

	constructor(
		public workspace: Workspace,
		public item: BoardItem,
	) {
		super();
	}

	public execute(): void {
		if (this.createdItemId !== null) return;
		this.createdItemId = this.workspace.addBoardItem(this.item);
	}

	public undo(): void {
		if (this.createdItemId !== null) {
			this.workspace.deleteBoardItem(this.createdItemId);
			this.createdItemId = null;
		}
	}
}
