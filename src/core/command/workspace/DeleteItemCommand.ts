import type { BoardItem } from '../../model/item/BoardItem';
import type { Workspace } from '../../model/Workspace';
import { Command } from '../Command';

/**
 * Command deleting a board item from a workspace canvas with undo restore capability.
 */
export class DeleteItemCommand extends Command {
	private deletedItem: BoardItem | undefined = undefined;

	/**
	 * Creates a DeleteItemCommand instance.
	 * @param workspace Target Workspace instance.
	 * @param itemToDeleteId Item ID string to delete.
	 */
	constructor(
		public workspace: Workspace,
		public itemToDeleteId: string,
	) {
		super();
	}

	/**
	 * Executes item deletion.
	 */
	public execute(): void {
		if (this.deletedItem !== undefined) return;
		this.deletedItem = this.workspace.deleteBoardItem(this.itemToDeleteId);
	}

	/**
	 * Restores deleted item.
	 */
	public undo(): void {
		if (this.deletedItem !== undefined) {
			this.workspace.addBoardItem(this.deletedItem);
			this.deletedItem = undefined;
		}
	}
}
