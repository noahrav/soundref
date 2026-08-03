import type { Project } from '@core/model/Project';
import type { Workspace } from '@core/model/Workspace';
import { Command } from '@core/command/Command';

/**
 * Command deleting a workspace tab from a project with undo restore capability.
 */
export class DeleteWorkspaceCommand extends Command {
	public workspaceToDelete: Workspace | undefined;

	/**
	 * Creates a DeleteWorkspaceCommand instance.
	 * @param project Target Project instance.
	 * @param workspaceTarget Workspace instance or workspace ID string to delete.
	 */
	constructor(
		public project: Project,
		workspaceTarget: string | Workspace,
	) {
		super();
		if (typeof workspaceTarget === 'string') {
			this.workspaceToDelete = project.workspaces.get(workspaceTarget);
		} else {
			this.workspaceToDelete = workspaceTarget;
		}
	}

	/**
	 * Executes workspace deletion.
	 */
	public execute(): void {
		if (this.workspaceToDelete) {
			this.project.deleteWorkspace(this.workspaceToDelete.id);
		}
	}

	/**
	 * Restores the deleted workspace.
	 */
	public undo(): void {
		if (this.workspaceToDelete) {
			this.project.addWorkspace(this.workspaceToDelete);
		}
	}
}
