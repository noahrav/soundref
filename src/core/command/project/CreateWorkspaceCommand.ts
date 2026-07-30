import type { Project } from '../../model/Project';
import { Workspace } from '../../model/Workspace';
import { Command } from '../Command';

/**
 * Command creating a workspace tab inside a project with undo capability.
 */
export class CreateWorkspaceCommand extends Command {
	private createdWorkspaceId: string | null = null;

	/**
	 * Creates a CreateWorkspaceCommand instance.
	 * @param project Target Project instance.
	 * @param newWorkspaceName Name of the new workspace.
	 */
	constructor(
		public project: Project,
		public newWorkspaceName: string,
	) {
		super();
	}

	/**
	 * Executes workspace creation.
	 */
	public execute(): void {
		if (this.createdWorkspaceId !== null) return;
		const workspace = new Workspace(this.newWorkspaceName);
		this.createdWorkspaceId = this.project.addWorkspace(workspace);
	}

	/**
	 * Undoes workspace creation.
	 */
	public undo(): void {
		if (this.createdWorkspaceId !== null) {
			this.project.deleteWorkspace(this.createdWorkspaceId);
			this.createdWorkspaceId = null;
		}
	}

	/**
	 * Gets the ID of the created workspace.
	 * @returns Created workspace ID string or null.
	 */
	public getCreatedWorkspaceId(): string | null {
		return this.createdWorkspaceId;
	}
}
