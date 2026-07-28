import type { BoardItem } from '../../model/item/BoardItem';
import type { Workspace } from '../../model/Workspace';
import { Command } from '../Command';

export class DeleteItemCommand extends Command {
	private deletedItem: BoardItem | undefined = undefined;

	constructor(
		public workspace: Workspace,
		public itemToDeleteId: string,
	) {
		super();
	}

	public execute(): void {
		if (this.deletedItem !== undefined) return;
		this.deletedItem = this.workspace.deleteBoardItem(this.itemToDeleteId);
	}

	public undo(): void {
		if (this.deletedItem !== undefined) {
			this.workspace.addBoardItem(this.deletedItem);
			this.deletedItem = undefined;
		}
	}
}
