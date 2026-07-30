import { CreateWorkspaceCommand } from '../core/command/project/CreateWorkspaceCommand';
import { DeleteWorkspaceCommand } from '../core/command/project/DeleteWorkspaceCommand';
import { CreateItemCommand } from '../core/command/workspace/CreateItemCommand';
import { DeleteItemCommand } from '../core/command/workspace/DeleteItemCommand';
import type { BoardItem } from '../core/model/item/BoardItem';
import { SectionItem } from '../core/model/item/SectionItem';
import { StickyNoteItem } from '../core/model/item/StickyNoteItem';
import { TextItem } from '../core/model/item/TextItem';
import { TrackItem } from '../core/model/item/TrackItem';
import { Position } from '../core/model/Position';
import { Project } from '../core/model/Project';
import type { Workspace } from '../core/model/Workspace';
import {
	DesktopBridge,
	type KnownProjectEntry,
} from '../core/persistence/DesktopBridge';
import {
	formatSoundrefJsonPath,
	ProjectStorage,
} from '../core/persistence/ProjectStorage';
import i18n from '../i18n';

/**
 * Service class managing project lifecycle, workspace operations, and item sync with storage.
 */
export class ProjectService {
	private static _instance: ProjectService;
	private activeProject: Project | null = null;

	/**
	 * Private constructor for singleton pattern.
	 */
	private constructor() {}

	/**
	 * Gets the singleton instance of ProjectService.
	 * @returns ProjectService instance.
	 */
	public static instance(): ProjectService {
		if (!ProjectService._instance) {
			ProjectService._instance = new ProjectService();
		}
		return ProjectService._instance;
	}

	/**
	 * Helper method to remove tldraw "page:" prefix from workspace IDs.
	 * @param id Raw ID string.
	 * @returns ID string without page: prefix.
	 */
	private stripPagePrefix(id: string): string {
		return id.replace(/^page:/, '');
	}

	/**
	 * Loads a project by ID or returns the currently active cached project.
	 * @param projectId Project ID string.
	 * @returns Promise resolving to Project instance or null.
	 */
	private async getOrLoadProject(projectId: string): Promise<Project | null> {
		if (this.activeProject?.id === projectId) {
			return this.activeProject;
		}

		const knownList = await ProjectStorage.getKnownProjects();
		const meta = knownList.find((p) => p.id === projectId);
		if (!meta) return null;

		const project = await ProjectStorage.loadProjectData(meta.id, meta.path);
		if (project) {
			this.activeProject = project;
			return project;
		}

		const fallback = new Project(meta.name, meta.path, meta.id, meta.createdAt);
		this.activeProject = fallback;
		return fallback;
	}

	/**
	 * Retrieves all known project entries from storage.
	 * @returns Promise resolving to an array of KnownProjectEntry records.
	 */
	public async getProjects(): Promise<KnownProjectEntry[]> {
		return await ProjectStorage.getKnownProjects();
	}

	/**
	 * Creates a new project with a initial workspace and saves it to persistence.
	 * @param name Name of the project.
	 * @param path Directory path of the project.
	 * @param workspaceName Optional initial workspace name.
	 * @returns Promise resolving to the newly created Project instance.
	 */
	public async createProject(
		name: string,
		path: string,
		workspaceName?: string,
	): Promise<Project> {
		const project = new Project(name, path);
		const initialWorkspaceName =
			workspaceName || i18n.t('board.defaultWorkspaceName', { number: 1 });
		const cmd = new CreateWorkspaceCommand(project, initialWorkspaceName);
		cmd.execute();
		this.activeProject = project;
		await ProjectStorage.saveProjectData(project);
		return project;
	}

	/**
	 * Opens an existing project folder on disk and loads its metadata.
	 * @param folderPath Folder directory path.
	 * @returns Promise resolving to the opened Project.
	 */
	public async openExistingProjectFolder(folderPath: string): Promise<Project> {
		const jsonPath = formatSoundrefJsonPath(folderPath);
		if (await DesktopBridge.fileExists(jsonPath)) {
			const content = await DesktopBridge.readTextFile(jsonPath);
			if (content) {
				try {
					const json = JSON.parse(content);
					json.path = folderPath;
					const project = ProjectStorage.deserializeProject(json);
					this.activeProject = project;
					await ProjectStorage.saveProjectData(project);
					return project;
				} catch (e) {
					console.error(
						'[ProjectService] Error parsing existing soundref.json:',
						e,
					);
				}
			}
		}
		const folderName =
			folderPath
				.trim()
				.replace(/[/\\]+$/, '')
				.split(/[/\\]/)
				.pop() || i18n.t('board.defaultProjectName');
		return await this.createProject(folderName, folderPath);
	}

	/**
	 * Removes a project by ID from local project registry.
	 * @param id Project ID string.
	 */
	public async deleteProject(id: string): Promise<void> {
		if (this.activeProject?.id === id) {
			this.activeProject = null;
		}
		await ProjectStorage.removeProjectFromRegistry(id);
	}

	/**
	 * Retrieves all workspaces in a given project.
	 * @param projectId Project ID string.
	 * @returns Promise resolving to array of Workspace objects.
	 */
	public async getWorkspaces(projectId: string): Promise<Workspace[]> {
		const project = await this.getOrLoadProject(projectId);
		if (!project) return [];
		return Array.from(project.workspaces.values());
	}

	/**
	 * Retrieves a specific workspace by ID within a project.
	 * @param projectId Project ID string.
	 * @param workspaceId Workspace ID string.
	 * @returns Promise resolving to Workspace instance.
	 */
	public async getWorkspace(
		projectId: string,
		workspaceId: string,
	): Promise<Workspace> {
		const cleanWsId = this.stripPagePrefix(workspaceId);
		const project = await this.getOrLoadProject(projectId);
		const ws = project?.workspaces.get(cleanWsId);
		if (!ws || !project) throw new Error(`Workspace ${workspaceId} not found`);
		return ws;
	}

	/**
	 * Creates a new workspace tab in a project.
	 * @param projectId Project ID string.
	 * @param name Display name for the workspace.
	 * @returns Promise resolving to created Workspace instance.
	 */
	public async createWorkspace(
		projectId: string,
		name: string,
	): Promise<Workspace> {
		const project = await this.getOrLoadProject(projectId);
		if (!project) throw new Error(`Project ${projectId} not found`);

		const cmd = new CreateWorkspaceCommand(project, name);
		cmd.execute();

		const createdId = cmd.getCreatedWorkspaceId();
		const ws = createdId ? project.workspaces.get(createdId) : undefined;
		if (!ws) throw new Error('Workspace creation failed');

		await ProjectStorage.saveProjectData(project);
		return ws;
	}

	/**
	 * Updates properties or viewport settings of a workspace.
	 * @param projectId Project ID string.
	 * @param workspaceId Workspace ID string.
	 * @param payload Object containing optional name, zoom, and offset position updates.
	 * @returns Promise resolving to updated Workspace instance.
	 */
	public async updateWorkspace(
		projectId: string,
		workspaceId: string,
		payload: {
			name?: string;
			zoom?: number;
			offsetX?: number;
			offsetY?: number;
		},
	): Promise<Workspace> {
		const cleanWsId = this.stripPagePrefix(workspaceId);
		const project = await this.getOrLoadProject(projectId);
		if (!project) throw new Error(`Project ${projectId} not found`);

		const ws = project.workspaces.get(cleanWsId);
		if (!ws) throw new Error(`Workspace ${workspaceId} not found`);

		if (payload.name !== undefined) ws.name = payload.name;
		if (payload.zoom !== undefined) ws.viewportState.zoom = payload.zoom;
		if (payload.offsetX !== undefined)
			ws.viewportState.offset.x = payload.offsetX;
		if (payload.offsetY !== undefined)
			ws.viewportState.offset.y = payload.offsetY;

		await ProjectStorage.saveProjectData(project);
		return ws;
	}

	/**
	 * Deletes a workspace tab from a project.
	 * @param projectId Project ID string.
	 * @param workspaceId Workspace ID string.
	 */
	public async deleteWorkspace(
		projectId: string,
		workspaceId: string,
	): Promise<void> {
		const cleanWsId = this.stripPagePrefix(workspaceId);
		const project = await this.getOrLoadProject(projectId);
		if (!project) return;

		const cmd = new DeleteWorkspaceCommand(project, cleanWsId);
		cmd.execute();

		await ProjectStorage.saveProjectData(project);
	}

	/**
	 * Retrieves all board items belonging to a specific workspace.
	 * @param projectId Project ID string.
	 * @param workspaceId Workspace ID string.
	 * @returns Promise resolving to an array of BoardItem objects.
	 */
	public async getItems(
		projectId: string,
		workspaceId: string,
	): Promise<BoardItem[]> {
		const cleanWsId = this.stripPagePrefix(workspaceId);
		const project = await this.getOrLoadProject(projectId);
		if (!project) return [];

		const ws = project.workspaces.get(cleanWsId);
		if (ws) {
			return Array.from(ws.items.values());
		}
		return [];
	}

	/**
	 * Synchronizes an array of item payloads into a workspace item map and saves state.
	 * @param projectId Project ID string.
	 * @param workspaceId Workspace ID string.
	 * @param itemsPayload Array of serialized item data.
	 */
	public async syncWorkspaceItems(
		projectId: string,
		workspaceId: string,
		itemsPayload: Array<{
			id: string;
			type?: string;
			x: number;
			y: number;
			content?: string;
			scale?: number;
			width?: number;
			color?: string;
			title?: string;
			imageUrl?: string;
			audioSource?: string;
			sourceType?: 'local' | 'stream';
			playMode?: 'oneshot' | 'loop';
			loopRegion?: { start: number; end: number };
		}>,
	): Promise<void> {
		const cleanWsId = this.stripPagePrefix(workspaceId);
		const project = await this.getOrLoadProject(projectId);
		if (!project) return;

		const ws = project.workspaces.get(cleanWsId);
		if (!ws) return;

		const newItemsMap = new Map<string, BoardItem>();
		itemsPayload.forEach((p) => {
			const pos = new Position(p.x, p.y);
			let item: BoardItem;
			if (p.type === 'TextItem' || p.type === 'text') {
				item = new TextItem(pos, p.content || '', p.id, p.scale || 1, p.width);
			} else if (p.type === 'TrackItem' || p.type === 'track') {
				item = new TrackItem(
					pos,
					p.title || 'Track',
					p.imageUrl || '',
					p.audioSource || '',
					p.sourceType || 'local',
					p.playMode || 'oneshot',
					p.loopRegion || { start: 0, end: 0 },
					p.id,
					p.scale || 1,
					p.width || 200,
				);
			} else if (
				p.type === 'SectionItem' ||
				p.type === 'section'
			) {
				item = new SectionItem(
					pos,
					p.title || 'Section',
					p.id,
					p.color || 'blue',
					p.width || 400,
					(p as any).height || 300,
				);
			} else {
				item = new StickyNoteItem(
					pos,
					p.content || '',
					p.id,
					p.scale || 1,
					p.color || 'yellow',
				);
			}
			newItemsMap.set(item.id, item);
		});

		ws.items = newItemsMap;
		await ProjectStorage.saveProjectData(project);
	}

	/**
	 * Creates a single board item in a workspace.
	 * @param projectId Project ID.
	 * @param workspaceId Workspace ID.
	 * @param itemPayload Payload defining item properties and position.
	 * @returns Promise resolving to created BoardItem instance.
	 */
	public async createItem(
		projectId: string,
		workspaceId: string,
		itemPayload: any,
	): Promise<BoardItem> {
		const cleanWsId = this.stripPagePrefix(workspaceId);
		const project = await this.getOrLoadProject(projectId);
		if (!project) throw new Error(`Project ${projectId} not found`);

		const ws = project.workspaces.get(cleanWsId);
		if (!ws) throw new Error(`Workspace ${workspaceId} not found`);

		const pos = new Position(
			itemPayload.positionX || itemPayload.position?.x || 0,
			itemPayload.positionY || itemPayload.position?.y || 0,
		);
		let item: BoardItem;

		if (itemPayload.type === 'TextItem' || itemPayload.type === 'text') {
			item = new TextItem(
				pos,
				itemPayload.content || '',
				undefined,
				itemPayload.scale || 1,
				itemPayload.width,
			);
		} else if (
			itemPayload.type === 'TrackItem' ||
			itemPayload.type === 'track'
		) {
			item = new TrackItem(
				pos,
				itemPayload.title || 'Track',
				itemPayload.imageUrl || '',
				itemPayload.audioSource || '',
				itemPayload.sourceType || 'local',
				itemPayload.playMode || 'oneshot',
				itemPayload.loopRegion || { start: 0, end: 0 },
				undefined,
				itemPayload.scale || 1,
				itemPayload.width || 200,
			);
		} else if (
			itemPayload.type === 'SectionItem' ||
			itemPayload.type === 'section'
		) {
			item = new SectionItem(
				pos,
				itemPayload.title || 'Section',
				undefined,
				itemPayload.color || 'blue',
				itemPayload.width || 400,
				itemPayload.height || 300,
			);
		} else {
			item = new StickyNoteItem(
				pos,
				itemPayload.content || '',
				undefined,
				itemPayload.scale || 1,
				itemPayload.color || 'yellow',
			);
		}

		const cmd = new CreateItemCommand(ws, item);
		cmd.execute();

		await ProjectStorage.saveProjectData(project);
		return item;
	}

	/**
	 * Deletes a single board item by ID from a workspace.
	 * @param projectId Project ID string.
	 * @param workspaceId Workspace ID string.
	 * @param itemId Item ID string.
	 */
	public async deleteItem(
		projectId: string,
		workspaceId: string,
		itemId: string,
	): Promise<void> {
		const cleanWsId = this.stripPagePrefix(workspaceId);
		const project = await this.getOrLoadProject(projectId);
		if (!project) return;

		const ws = project.workspaces.get(cleanWsId);
		if (ws?.items.has(itemId)) {
			const cmd = new DeleteItemCommand(ws, itemId);
			cmd.execute();
			await ProjectStorage.saveProjectData(project);
		}
	}
}
