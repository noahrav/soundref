import { Command } from '@core/command/Command';
import type { BoardItem } from '@core/model/item/BoardItem';
import type { Workspace } from '@core/model/Workspace';

/**
 * Command creating a board item on a workspace canvas with undo/redo capability.
 */
export class CreateItemCommand extends Command {
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
		this.workspace.addBoardItem(this.item);
	}

	/**
	 * Reverts item creation.
	 */
	public undo(): void {
		this.workspace.deleteBoardItem(this.item.id);
	}
}
