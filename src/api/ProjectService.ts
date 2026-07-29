import { CreateWorkspaceCommand } from '../core/command/project/CreateWorkspaceCommand';
import { DeleteWorkspaceCommand } from '../core/command/project/DeleteWorkspaceCommand';
import { CreateItemCommand } from '../core/command/workspace/CreateItemCommand';
import { DeleteItemCommand } from '../core/command/workspace/DeleteItemCommand';
import type { BoardItem } from '../core/model/item/BoardItem';
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

export class ProjectService {
	private static _instance: ProjectService;
	private activeProject: Project | null = null;

	private constructor() {}

	public static instance(): ProjectService {
		if (!ProjectService._instance) {
			ProjectService._instance = new ProjectService();
		}
		return ProjectService._instance;
	}

	private stripPagePrefix(id: string): string {
		return id.replace(/^page:/, '');
	}

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

	public async getProjects(): Promise<KnownProjectEntry[]> {
		return await ProjectStorage.getKnownProjects();
	}

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

	public async deleteProject(id: string): Promise<void> {
		if (this.activeProject?.id === id) {
			this.activeProject = null;
		}
		await ProjectStorage.removeProjectFromRegistry(id);
	}

	public async getWorkspaces(projectId: string): Promise<Workspace[]> {
		const project = await this.getOrLoadProject(projectId);
		if (!project) return [];
		return Array.from(project.workspaces.values());
	}

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

	public async createItem(
		projectId: string,
		workspaceId: string,
		itemPayload: {
			type: string;
			positionX: number;
			positionY: number;
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
		},
	): Promise<BoardItem> {
		const cleanWsId = this.stripPagePrefix(workspaceId);
		const project = await this.getOrLoadProject(projectId);
		if (!project) throw new Error(`Project ${projectId} not found`);

		const ws = project.workspaces.get(cleanWsId);
		if (!ws) throw new Error(`Workspace ${workspaceId} not found`);

		const pos = new Position(itemPayload.positionX, itemPayload.positionY);
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

	public async deleteItem(
		projectId: string,
		workspaceId: string,
		itemId: string,
	): Promise<void> {
		const cleanWsId = this.stripPagePrefix(workspaceId);
		const project = await this.getOrLoadProject(projectId);
		if (!project) return;

		const ws = project.workspaces.get(cleanWsId);
		if (ws && ws.items.has(itemId)) {
			const cmd = new DeleteItemCommand(ws, itemId);
			cmd.execute();
			await ProjectStorage.saveProjectData(project);
		}
	}
}
