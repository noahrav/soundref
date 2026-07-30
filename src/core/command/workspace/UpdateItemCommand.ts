import type { BoardItem } from '../../model/item/BoardItem';
import type { Workspace } from '../../model/Workspace';
import { Command } from '../Command';

/**
 * Command updating an existing board item on a workspace canvas with undo/redo capability.
 */
export class UpdateItemCommand extends Command {
	/**
	 * Creates an UpdateItemCommand instance.
	 * @param workspace Target Workspace instance.
	 * @param oldItem State of BoardItem prior to mutation.
	 * @param newItem State of BoardItem after mutation.
	 */
	constructor(
		public workspace: Workspace,
		public oldItem: BoardItem,
		public newItem: BoardItem,
	) {
		super();
	}

	/**
	 * Executes item state update.
	 */
	public execute(): void {
		this.workspace.addBoardItem(this.newItem);
	}

	/**
	 * Reverts item state to prior snapshot.
	 */
	public undo(): void {
		this.workspace.addBoardItem(this.oldItem);
	}
}
