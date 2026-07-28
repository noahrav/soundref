import type { Project } from '../../model/Project';
import type { Workspace } from '../../model/Workspace';
import { Command } from '../Command';

export class DeleteWorkspaceCommand extends Command {
	private deletedWorkspace: Workspace | undefined = undefined;

	constructor(
		public project: Project,
		public workspaceToDeleteId: string,
	) {
		super();
	}

	public execute(): void {
		if (this.deletedWorkspace !== undefined) return;
		this.deletedWorkspace = this.project.deleteWorkspace(
			this.workspaceToDeleteId,
		);
	}

	public undo(): void {
		if (this.deletedWorkspace !== undefined) {
			this.project.addWorkspace(this.deletedWorkspace);
			this.deletedWorkspace = undefined;
		}
	}
}
