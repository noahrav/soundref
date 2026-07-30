import type { Project } from '../../model/Project';
import type { Workspace } from '../../model/Workspace';
import { Command } from '../Command';

/**
 * Command deleting a workspace tab from a project with undo restore capability.
 */
export class DeleteWorkspaceCommand extends Command {
	private deletedWorkspace: Workspace | undefined = undefined;

	/**
	 * Creates a DeleteWorkspaceCommand instance.
	 * @param project Target Project instance.
	 * @param workspaceToDeleteId ID string of workspace to delete.
	 */
	constructor(
		public project: Project,
		public workspaceToDeleteId: string,
	) {
		super();
	}

	/**
	 * Executes workspace deletion.
	 */
	public execute(): void {
		if (this.deletedWorkspace !== undefined) return;
		this.deletedWorkspace = this.project.deleteWorkspace(
			this.workspaceToDeleteId,
		);
	}

	/**
	 * Restores the deleted workspace.
	 */
	public undo(): void {
		if (this.deletedWorkspace !== undefined) {
			this.project.addWorkspace(this.deletedWorkspace);
			this.deletedWorkspace = undefined;
		}
	}
}
