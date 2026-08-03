import type { Workspace } from '@core/model/Workspace';

/**
 * Represents a SoundRef project containing workspaces, metadata, and disk folder path.
 */
export class Project {
	/** Unique project UUID string */
	public id: string;
	/** Display name of the project */
	public name: string;
	/** Folder path of the project on disk */
	public path: string;
	/** Map of workspace ID to Workspace domain instances */
	public workspaces: Map<string, Workspace>;
	/** ISO string timestamp of creation time */
	public createdAt: string;

	/**
	 * Creates a Project domain model instance.
	 * @param name Name of the project.
	 * @param path Folder path of the project.
	 * @param id Optional explicit UUID string.
	 * @param createdAt Optional creation ISO timestamp.
	 * @param workspaces Optional pre-hydrated map of workspaces.
	 */
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

	/**
	 * Adds a workspace to the project.
	 * @param newWorkspace Workspace instance to add.
	 * @returns Assigned workspace ID string.
	 */
	public addWorkspace(newWorkspace: Workspace): string {
		if (!newWorkspace.id) {
			newWorkspace.id = crypto.randomUUID();
		}
		this.workspaces.set(newWorkspace.id, newWorkspace);
		return newWorkspace.id;
	}

	/**
	 * Deletes a workspace by ID from the project.
	 * @param workspaceId Workspace ID string.
	 * @returns Deleted Workspace instance or undefined if not found.
	 */
	public deleteWorkspace(workspaceId: string): Workspace | undefined {
		const workspace = this.workspaces.get(workspaceId);
		this.workspaces.delete(workspaceId);
		return workspace;
	}
}
