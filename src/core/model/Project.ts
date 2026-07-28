import type { Workspace } from './Workspace';

export class Project {
	public id: string;
	public name: string;
	public path: string;
	public workspaces: Map<string, Workspace>;
	public createdAt: string;

	constructor(
		name: string,
		path: string,
		id?: string,
		createdAt?: string,
		workspaces?: Map<string, Workspace>,
	) {
		this.id = id || crypto.randomUUID();
		this.name = name;
		this.path = path;
		this.createdAt = createdAt || new Date().toISOString();
		this.workspaces = workspaces || new Map<string, Workspace>();
	}

	public addWorkspace(newWorkspace: Workspace): string {
		if (!newWorkspace.id) {
			newWorkspace.id = crypto.randomUUID();
		}
		this.workspaces.set(newWorkspace.id, newWorkspace);
		return newWorkspace.id;
	}

	public deleteWorkspace(workspaceId: string): Workspace | undefined {
		const workspace = this.workspaces.get(workspaceId);
		this.workspaces.delete(workspaceId);
		return workspace;
	}
}
