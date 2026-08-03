import { Command } from '@core/command/Command';
import type { Project } from '@core/model/Project';

export interface WorkspaceStatePayload {
	name?: string;
	zoom?: number;
	offsetX?: number;
	offsetY?: number;
}

/**
 * Command updating workspace properties (such as tab name or camera viewport) with undo capability.
 */
export class UpdateWorkspaceCommand extends Command {
	/**
	 * Creates an UpdateWorkspaceCommand instance.
	 * @param project Target Project instance.
	 * @param workspaceId ID string of workspace to update.
	 * @param oldState Previous workspace properties.
	 * @param newState Target workspace properties.
	 */
	constructor(
		public project: Project,
		public workspaceId: string,
		public oldState: WorkspaceStatePayload,
		public newState: WorkspaceStatePayload,
	) {
		super();
	}

	private applyState(state: WorkspaceStatePayload): void {
		const ws = this.project.workspaces.get(this.workspaceId);
		if (!ws) return;

		if (state.name !== undefined) ws.name = state.name;
		if (state.zoom !== undefined) ws.viewportState.zoom = state.zoom;
		if (state.offsetX !== undefined) ws.viewportState.offset.x = state.offsetX;
		if (state.offsetY !== undefined) ws.viewportState.offset.y = state.offsetY;
	}

	/**
	 * Executes workspace update to new state.
	 */
	public execute(): void {
		this.applyState(this.newState);
	}

	/**
	 * Reverts workspace update to previous state.
	 */
	public undo(): void {
		this.applyState(this.oldState);
	}
}
