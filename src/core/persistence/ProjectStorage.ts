import type { BoardItem } from '../model/item/BoardItem';
import { StickyNoteItem } from '../model/item/StickyNoteItem';
import { Position } from '../model/Position';
import { Project } from '../model/Project';
import { ViewportState } from '../model/ViewportState';
import { Workspace } from '../model/Workspace';
import { DesktopBridge, type KnownProjectEntry } from './DesktopBridge';

const REGISTRY_KEY = 'soundref_projects_registry';

export interface ProjectDataJSON {
	id: string;
	name: string;
	path: string;
	createdAt: string;
	workspaces: Array<{
		id: string;
		name: string;
		viewportState: {
			zoom: number;
			offset: { x: number; y: number };
		};
		items: Array<{
			id: string;
			type: string;
			position: { x: number; y: number };
			content?: string;
		}>;
	}>;
}

export function formatSoundrefJsonPath(dirPath: string): string {
	const cleanPath = dirPath.trim().replace(/[/\\]+$/, '');
	return cleanPath ? `${cleanPath}/soundref.json` : 'soundref.json';
}

export class ProjectStorage {
	public static async getKnownProjects(): Promise<KnownProjectEntry[]> {
		if (DesktopBridge.isTauri()) {
			const regPath = await DesktopBridge.getRegistryFilePath();
			if (regPath) {
				const content = await DesktopBridge.readTextFile(regPath);
				if (content) {
					try {
						return JSON.parse(content);
					} catch (e) {
						console.error(
							'[ProjectStorage] Error parsing desktop projects registry file:',
							e,
						);
					}
				}
			}
		}

		// Fallback to localStorage
		try {
			const raw = localStorage.getItem(REGISTRY_KEY);
			if (!raw) return [];
			const list = JSON.parse(raw);

			// If running in Tauri and we loaded from localStorage, auto-migrate to desktop registry
			if (DesktopBridge.isTauri() && list.length > 0) {
				const regPath = await DesktopBridge.getRegistryFilePath();
				if (regPath) {
					await DesktopBridge.writeTextFile(
						regPath,
						JSON.stringify(list, null, 2),
					);
				}
			}

			return list;
		} catch {
			return [];
		}
	}

	public static async saveProjectToRegistry(project: Project): Promise<void> {
		const list = await ProjectStorage.getKnownProjects();
		const index = list.findIndex((p) => p.id === project.id);
		const entry: KnownProjectEntry = {
			id: project.id,
			name: project.name,
			path: project.path,
			createdAt: project.createdAt,
			workspaceCount: project.workspaces.size,
		};

		if (index >= 0) {
			list[index] = entry;
		} else {
			list.push(entry);
		}

		await ProjectStorage.persistRegistry(list);
	}

	public static async removeProjectFromRegistry(
		projectId: string,
	): Promise<void> {
		const list = (await ProjectStorage.getKnownProjects()).filter(
			(p) => p.id !== projectId,
		);
		await ProjectStorage.persistRegistry(list);
	}

	private static async persistRegistry(
		list: KnownProjectEntry[],
	): Promise<void> {
		const jsonStr = JSON.stringify(list, null, 2);

		if (DesktopBridge.isTauri()) {
			const regPath = await DesktopBridge.getRegistryFilePath();
			if (regPath) {
				await DesktopBridge.writeTextFile(regPath, jsonStr);
			}
		}

		// Always keep localStorage updated as fallback
		localStorage.setItem(REGISTRY_KEY, jsonStr);
	}

	// ---- Serialization & File Persistence ----
	public static serializeProject(project: Project): ProjectDataJSON {
		const workspacesJson = Array.from(project.workspaces.values()).map(
			(ws) => ({
				id: ws.id,
				name: ws.name,
				viewportState: {
					zoom: ws.viewportState.zoom,
					offset: {
						x: ws.viewportState.offset.x,
						y: ws.viewportState.offset.y,
					},
				},
				items: Array.from(ws.items.values()).map((item) => {
					const isSticky =
						item instanceof StickyNoteItem ||
						(item as any).type === 'StickyNoteItem' ||
						'content' in item;
					const itemObj: any = {
						id: item.id,
						type: 'StickyNoteItem',
						position: { x: item.position.x, y: item.position.y },
					};
					if (isSticky) {
						itemObj.content = (item as any).content || '';
					}
					return itemObj;
				}),
			}),
		);

		return {
			id: project.id,
			name: project.name,
			path: project.path,
			createdAt: project.createdAt,
			workspaces: workspacesJson,
		};
	}

	public static deserializeProject(json: ProjectDataJSON): Project {
		const workspacesMap = new Map<string, Workspace>();

		if (json.workspaces) {
			json.workspaces.forEach((wsJson) => {
				const itemsMap = new Map<string, BoardItem>();
				if (wsJson.items) {
					wsJson.items.forEach((itemJson) => {
						const pos = new Position(
							itemJson.position?.x || 0,
							itemJson.position?.y || 0,
						);
						let item: BoardItem;
						if (
							itemJson.type === 'StickyNoteItem' ||
							itemJson.content !== undefined
						) {
							item = new StickyNoteItem(
								pos,
								itemJson.content || '',
								itemJson.id,
							);
						} else {
							item = new StickyNoteItem(pos, '', itemJson.id);
						}
						itemsMap.set(item.id, item);
					});
				}

				const rawZoom = wsJson.viewportState?.zoom;
				const normZoom =
					rawZoom !== undefined && rawZoom > 10
						? rawZoom / 100
						: (rawZoom ?? 1.0);

				const viewport = new ViewportState(
					normZoom,
					new Position(
						wsJson.viewportState?.offset?.x || 0,
						wsJson.viewportState?.offset?.y || 0,
					),
				);

				const ws = new Workspace(wsJson.name, wsJson.id, viewport, itemsMap);
				workspacesMap.set(ws.id, ws);
			});
		}

		return new Project(
			json.name,
			json.path,
			json.id,
			json.createdAt,
			workspacesMap,
		);
	}

	public static async saveProjectData(project: Project): Promise<void> {
		await ProjectStorage.saveProjectToRegistry(project);

		const data = ProjectStorage.serializeProject(project);
		const jsonStr = JSON.stringify(data, null, 2);

		// Save directly to the desktop directory / json file: <projectPath>/soundref.json
		if (DesktopBridge.isTauri() && project.path) {
			await DesktopBridge.createDir(project.path);
			const filePath = formatSoundrefJsonPath(project.path);
			const written = await DesktopBridge.writeTextFile(filePath, jsonStr);
			if (written) {
				console.log(`[ProjectStorage] Saved project data to ${filePath}`);
			}
		}

		// Keep localStorage in sync as backup
		const key = `soundref_data_${project.id}`;
		localStorage.setItem(key, jsonStr);
	}

	public static async loadProjectData(
		projectId: string,
		projectPath: string,
	): Promise<Project | null> {
		// 1. Try reading from desktop filesystem (<projectPath>/soundref.json)
		if (DesktopBridge.isTauri() && projectPath) {
			const filePath = formatSoundrefJsonPath(projectPath);
			const content = await DesktopBridge.readTextFile(filePath);
			if (content) {
				try {
					const json = JSON.parse(content);
					return ProjectStorage.deserializeProject(json);
				} catch (err) {
					console.error(`[ProjectStorage] Error parsing ${filePath}:`, err);
				}
			}
		}

		// 2. Fallback to localStorage
		const raw = localStorage.getItem(`soundref_data_${projectId}`);
		if (raw) {
			try {
				const json = JSON.parse(raw);
				return ProjectStorage.deserializeProject(json);
			} catch (err) {
				console.error(
					'[ProjectStorage] Error parsing stored project JSON from localStorage:',
					err,
				);
			}
		}

		return null;
	}
}
