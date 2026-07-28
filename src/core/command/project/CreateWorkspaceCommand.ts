import type { Project } from '../../model/Project';
import { Workspace } from '../../model/Workspace';
import { Command } from '../Command';

export class CreateWorkspaceCommand extends Command {
	private createdWorkspaceId: string | null = null;

	constructor(
		public project: Project,
		public newWorkspaceName: string,
	) {
		super();
	}

	public execute(): void {
		if (this.createdWorkspaceId !== null) return;
		const workspace = new Workspace(this.newWorkspaceName);
		this.createdWorkspaceId = this.project.addWorkspace(workspace);
	}

	public undo(): void {
		if (this.createdWorkspaceId !== null) {
			this.project.deleteWorkspace(this.createdWorkspaceId);
			this.createdWorkspaceId = null;
		}
	}

	public getCreatedWorkspaceId(): string | null {
		return this.createdWorkspaceId;
	}
}
