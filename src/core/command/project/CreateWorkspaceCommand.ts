import type { Project } from '../../model/Project';
import { Workspace } from '../../model/Workspace';
import { Command } from '../Command';

/**
 * Command creating a workspace tab inside a project with undo/redo capability.
 */
export class CreateWorkspaceCommand extends Command {
	public workspace: Workspace;

	/**
	 * Creates a CreateWorkspaceCommand instance.
	 * @param project Target Project instance.
	 * @param newWorkspace Workspace instance or workspace name string.
	 * @param workspaceId Optional explicit workspace ID string.
	 */
	constructor(
		public project: Project,
		newWorkspace: string | Workspace,
		workspaceId?: string,
	) {
		super();
		if (typeof newWorkspace === 'string') {
			this.workspace = new Workspace(newWorkspace, workspaceId);
		} else {
			this.workspace = newWorkspace;
		}
	}

	/**
	 * Executes workspace creation.
	 */
	public execute(): void {
		this.project.addWorkspace(this.workspace);
	}

	/**
	 * Undoes workspace creation.
	 */
	public undo(): void {
		this.project.deleteWorkspace(this.workspace.id);
	}

	/**
	 * Gets the ID of the created workspace.
	 * @returns Created workspace ID string.
	 */
	public getCreatedWorkspaceId(): string {
		return this.workspace.id;
	}
}
