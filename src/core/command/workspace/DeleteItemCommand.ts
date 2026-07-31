import type { BoardItem } from '../../model/item/BoardItem';
import { TrackItem } from '../../model/item/TrackItem';
import type { Workspace } from '../../model/Workspace';
import { revokeBlobUrlForFile } from '../../utils/mediaUtils';
import { Command } from '../Command';

/**
 * Command deleting a board item from a workspace canvas with undo restore capability.
 */
export class DeleteItemCommand extends Command {
	public itemToDelete: BoardItem | undefined;

	/**
	 * Creates a DeleteItemCommand instance.
	 * @param workspace Target Workspace instance.
	 * @param itemTarget BoardItem instance or item ID string to delete.
	 */
	constructor(
		public workspace: Workspace,
		itemTarget: string | BoardItem,
	) {
		super();
		if (typeof itemTarget === 'string') {
			this.itemToDelete = workspace.items.get(itemTarget);
		} else {
			this.itemToDelete = itemTarget;
		}
	}

	/**
	 * Executes item deletion.
	 */
	public execute(): void {
		if (this.itemToDelete) {
			if (
				this.itemToDelete instanceof TrackItem &&
				this.itemToDelete.audioSource
			) {
				revokeBlobUrlForFile(this.itemToDelete.audioSource);
			}
			this.workspace.deleteBoardItem(this.itemToDelete.id);
		}
	}

	/**
	 * Restores deleted item.
	 */
	public undo(): void {
		if (this.itemToDelete) {
			this.workspace.addBoardItem(this.itemToDelete);
		}
	}
}
