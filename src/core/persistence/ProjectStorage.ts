import type { BoardItem } from '@core/model/item/BoardItem';
import { ImageItem } from '@core/model/item/ImageItem';
import { SectionItem } from '@core/model/item/SectionItem';
import { StickyNoteItem } from '@core/model/item/StickyNoteItem';
import { TextItem } from '@core/model/item/TextItem';
import { TrackItem } from '@core/model/item/TrackItem';
import { Position } from '@core/model/Position';
import { Project } from '@core/model/Project';
import { ViewportState } from '@core/model/ViewportState';
import { Workspace } from '@core/model/Workspace';
import {
	DesktopBridge,
	type KnownProjectEntry,
} from '@core/persistence/DesktopBridge';

const REGISTRY_KEY = 'soundref_projects_registry';

/**
 * Interface representing the JSON structure of serialized project data stored in soundref.json.
 */
export interface ProjectDataJSON {
	/** Unique project ID string */
	id: string;
	/** Project name string */
	name: string;
	/** Folder path of project */
	path: string;
	/** Creation ISO timestamp */
	createdAt: string;
	/** Array of serialized workspace tab objects */
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
			scale?: number;
			width?: number;
			height?: number;
			color?: string;
			title?: string;
			imageUrl?: string;
			audioSource?: string;
			sourceType?: 'local' | 'stream';
			playMode?: 'oneshot' | 'loop';
			loopRegion?: { start: number; end: number };
		}>;
	}>;
}

/**
 * Formats directory path with trailing slash check to soundref.json file path.
 * @param dirPath Directory path string.
 * @returns Complete file path string to soundref.json.
 */
export function formatSoundrefJsonPath(dirPath: string): string {
	const cleanPath = dirPath.trim().replace(/[/\\]+$/, '');
	return cleanPath ? `${cleanPath}/soundref.json` : 'soundref.json';
}

/**
 * Persistence manager handling project registry operations, serialization,
 * desktop file system saving/loading, and web localStorage fallbacks.
 */
export class ProjectStorage {
	/**
	 * Retrieves the list of known project entries from desktop registry or browser localStorage.
	 * @returns Promise resolving to an array of KnownProjectEntry objects.
	 */
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

		try {
			const raw = localStorage.getItem(REGISTRY_KEY);
			if (!raw) return [];
			const list = JSON.parse(raw);

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

	/**
	 * Saves or updates a project entry in the known projects registry.
	 * @param project Project instance to register.
	 */
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

	/**
	 * Removes a project entry by ID from the known projects registry.
	 * @param projectId Project ID string.
	 */
	public static async removeProjectFromRegistry(
		projectId: string,
	): Promise<void> {
		const list = (await ProjectStorage.getKnownProjects()).filter(
			(p) => p.id !== projectId,
		);
		await ProjectStorage.persistRegistry(list);
	}

	/**
	 * Persists updated project registry list to Tauri registry file and localStorage.
	 * @param list Array of KnownProjectEntry records.
	 */
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

		localStorage.setItem(REGISTRY_KEY, jsonStr);
	}

	/**
	 * Serializes a Project instance into a JSON-compatible object structure.
	 * @param project Project instance to serialize.
	 * @returns Serialized ProjectDataJSON object.
	 */
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
					if (item instanceof TextItem || (item as any).type === 'TextItem') {
						const textItem = item as TextItem;
						return {
							id: textItem.id,
							type: 'TextItem',
							position: { x: textItem.position.x, y: textItem.position.y },
							content: textItem.content || '',
							scale: textItem.scale || 1,
							width: textItem.width,
						};
					}
					if (item instanceof TrackItem || (item as any).type === 'TrackItem') {
						const trackItem = item as TrackItem;
						const projectDir = project.path ? project.path.trim().replace(/[/\\]+$/, '') : '';
						
						let audioSource = trackItem.audioSource || '';
						let imageUrl = trackItem.imageUrl || '';

						if (projectDir) {
							if (audioSource.startsWith(`${projectDir}/assets/`) || audioSource.startsWith(`${projectDir}\\assets\\`)) {
								audioSource = audioSource.slice(projectDir.length).replace(/^[/\\]+/, '').replace(/\\/g, '/');
							}
							if (imageUrl.startsWith(`${projectDir}/assets/`) || imageUrl.startsWith(`${projectDir}\\assets\\`)) {
								imageUrl = imageUrl.slice(projectDir.length).replace(/^[/\\]+/, '').replace(/\\/g, '/');
							}
						}

						return {
							id: trackItem.id,
							type: 'TrackItem',
							position: { x: trackItem.position.x, y: trackItem.position.y },
							title: trackItem.title || 'Track',
							imageUrl,
							audioSource,
							sourceType: trackItem.sourceType || 'local',
							loopRegion: trackItem.loopRegion || { start: 0, end: 0 },
							scale: trackItem.scale || 1,
							width: trackItem.width || 200,
						};
					}
					if (
						item instanceof ImageItem ||
						(item as any).type === 'ImageItem' ||
						(item as any).type === 'image_item' ||
						(item as any).type === 'image'
					) {
						const imageItem = item as ImageItem;
						const projectDir = project.path ? project.path.trim().replace(/[/\\]+$/, '') : '';
						let imageUrl = imageItem.imageUrl || '';

						if (projectDir && (imageUrl.startsWith(`${projectDir}/assets/`) || imageUrl.startsWith(`${projectDir}\\assets\\`))) {
							imageUrl = imageUrl.slice(projectDir.length).replace(/^[/\\]+/, '').replace(/\\/g, '/');
						}

						return {
							id: imageItem.id,
							type: 'ImageItem',
							position: { x: imageItem.position.x, y: imageItem.position.y },
							imageUrl,
							scale: imageItem.scale || 1,
							width: imageItem.width || 300,
							height: imageItem.height || 300,
						};
					}
					if (item instanceof SectionItem || (item as any).type === 'SectionItem') {
						const sectionItem = item as SectionItem;
						return {
							id: sectionItem.id,
							type: 'SectionItem',
							position: {
								x: sectionItem.position.x,
								y: sectionItem.position.y,
							},
							title: sectionItem.title || 'Section',
							color: sectionItem.color || 'blue',
							width: sectionItem.width || 400,
							height: sectionItem.height || 300,
						};
					}
					const sticky = item as StickyNoteItem;
					return {
						id: sticky.id,
						type: 'StickyNoteItem',
						position: { x: sticky.position.x, y: sticky.position.y },
						content: sticky.content || '',
						scale: sticky.scale || 1,
						color: sticky.color || 'yellow',
					};
				}),
			}));

		return {
			id: project.id,
			name: project.name,
			path: project.path,
			createdAt: project.createdAt || new Date().toISOString(),
			workspaces: workspacesJson,
		};
	}

	/**
	 * Deserializes project data JSON structure into domain Project object model.
	 * @param json ProjectDataJSON data structure.
	 * @returns Hydrated domain Project instance.
	 */
	public static deserializeProject(json: ProjectDataJSON): Project {
		const project = new Project(json.name, json.path, json.id);
		if (json.createdAt) {
			project.createdAt = json.createdAt;
		}

		if (Array.isArray(json.workspaces)) {
			json.workspaces.forEach((wsJson) => {
				const itemsMap = new Map<string, BoardItem>();

				if (Array.isArray(wsJson.items)) {
					wsJson.items.forEach((itemJson) => {
						const pos = new Position(
							itemJson.position?.x || 0,
							itemJson.position?.y || 0,
						);
						let item: BoardItem;

						if (itemJson.type === 'TextItem' || itemJson.type === 'text') {
							item = new TextItem(
								pos,
								itemJson.content || '',
								itemJson.id,
								itemJson.scale || 1,
								itemJson.width,
							);
						} else if (itemJson.type === 'TrackItem' || itemJson.type === 'track') {
							item = new TrackItem(
								pos,
								itemJson.title || 'Track',
								itemJson.imageUrl || '',
								itemJson.audioSource || '',
								itemJson.sourceType || 'local',
								itemJson.playMode || 'oneshot',
								itemJson.loopRegion || { start: 0, end: 0 },
								itemJson.id,
								itemJson.scale || 1,
								itemJson.width || 200,
							);
						} else if (
							itemJson.type === 'ImageItem' ||
							itemJson.type === 'image_item' ||
							itemJson.type === 'image'
						) {
							item = new ImageItem(
								pos,
								itemJson.imageUrl || '',
								itemJson.id,
								itemJson.scale || 1,
								itemJson.width || 300,
								itemJson.height || 300,
							);
						} else if (itemJson.type === 'SectionItem' || itemJson.type === 'section') {
							item = new SectionItem(
								pos,
								itemJson.title || 'Section',
								itemJson.id,
								itemJson.color || 'blue',
								itemJson.width || 400,
								(itemJson as any).height || 300,
							);
						} else {
							item = new StickyNoteItem(
								pos,
								itemJson.content || '',
								itemJson.id,
								itemJson.scale || 1,
								itemJson.color || 'yellow',
							);
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
				project.workspaces.set(ws.id, ws);
			});
		}

		return project;
	}

	/**
	 * Saves full project data to desktop file system (soundref.json) and localStorage.
	 * @param project Project instance to persist.
	 */
	public static async saveProjectData(project: Project): Promise<void> {
		await ProjectStorage.saveProjectToRegistry(project);

		const data = ProjectStorage.serializeProject(project);
		const jsonStr = JSON.stringify(data, null, 2);

		if (DesktopBridge.isTauri() && project.path) {
			await DesktopBridge.createDir(project.path);
			const filePath = formatSoundrefJsonPath(project.path);
			const written = await DesktopBridge.writeTextFile(filePath, jsonStr);
			if (written) {
				console.log(`[ProjectStorage] Saved project data to ${filePath}`);
			}
		}

		const key = `soundref_data_${project.id}`;
		localStorage.setItem(key, jsonStr);
	}

	/**
	 * Loads full project data by reading desktop file system or localStorage.
	 * @param projectId Project ID string.
	 * @param projectPath Project folder path string.
	 * @returns Promise resolving to loaded Project instance or null.
	 */
	public static async loadProjectData(
		projectId: string,
		projectPath: string,
	): Promise<Project | null> {
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
