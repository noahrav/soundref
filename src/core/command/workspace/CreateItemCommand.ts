import type { BoardItem } from '../../model/item/BoardItem';
import type { Workspace } from '../../model/Workspace';
import { Command } from '../Command';

/**
 * Command creating a board item on a workspace canvas with undo capability.
 */
export class CreateItemCommand extends Command {
	private createdItemId: string | null = null;

	/**
	 * Creates a CreateItemCommand instance.
	 * @param workspace Target Workspace instance.
	 * @param item BoardItem instance to create.
	 */
	constructor(
		public workspace: Workspace,
		public item: BoardItem,
	) {
		super();
	}

	/**
	 * Executes item creation.
	 */
	public execute(): void {
		if (this.createdItemId !== null) return;
		this.createdItemId = this.workspace.addBoardItem(this.item);
	}

	/**
	 * Reverts item creation.
	 */
	public undo(): void {
		if (this.createdItemId !== null) {
			this.workspace.deleteBoardItem(this.createdItemId);
			this.createdItemId = null;
		}
	}
}
