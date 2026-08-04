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
	formatSoundrefJsonPath,
	ProjectStorage,
} from '@core/persistence/ProjectStorage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@core/persistence/DesktopBridge', () => ({
	DesktopBridge: {
		isTauri: vi.fn(() => false),
		getRegistryFilePath: vi.fn(),
		readTextFile: vi.fn(),
		writeTextFile: vi.fn(),
		createDir: vi.fn(),
	},
}));

describe('ProjectStorage', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
	});

	describe('formatSoundrefJsonPath', () => {
		it('should append /soundref.json to folder path', () => {
			expect(formatSoundrefJsonPath('/path/to/project')).toBe(
				'/path/to/project/soundref.json',
			);
		});

		it('should remove trailing slashes before appending', () => {
			expect(formatSoundrefJsonPath('/path/to/project/')).toBe(
				'/path/to/project/soundref.json',
			);
		});

		it('should handle empty path by returning soundref.json', () => {
			expect(formatSoundrefJsonPath('')).toBe('soundref.json');
		});
	});

	describe('serializeProject', () => {
		it('should serialize project metadata', () => {
			const project = new Project('My Project', '/my/path', 'p1');
			const json = ProjectStorage.serializeProject(project);

			expect(json.id).toBe('p1');
			expect(json.name).toBe('My Project');
			expect(json.path).toBe('/my/path');
			expect(json.createdAt).toBe(project.createdAt);
		});

		it('should serialize workspaces and their viewport states', () => {
			const project = new Project('My Project', '/my/path', 'p1');
			const ws = new Workspace(
				'Main Workspace',
				'w1',
				new ViewportState(1.5, new Position(10, 20)),
			);
			project.addWorkspace(ws);

			const json = ProjectStorage.serializeProject(project);

			expect(json.workspaces).toHaveLength(1);
			expect(json.workspaces[0].id).toBe('w1');
			expect(json.workspaces[0].name).toBe('Main Workspace');
			expect(json.workspaces[0].viewportState).toEqual({
				zoom: 1.5,
				offset: { x: 10, y: 20 },
			});
		});

		it('should serialize all item types', () => {
			const project = new Project('My Project', '/my/path', 'p1');
			const ws = new Workspace('Main Workspace', 'w1');

			const textItem = new TextItem(new Position(0, 0), 'Hello', 'i1');
			const trackItem = new TrackItem(
				new Position(10, 10),
				'Audio',
				'',
				'/my/path/assets/audio.mp3',
				'local',
				'oneshot',
				{ start: 0, end: 0 },
				'i2',
			);
			const imageItem = new ImageItem(
				new Position(20, 20),
				'/my/path/assets/img.png',
				'i3',
			);
			const sectionItem = new SectionItem(
				new Position(30, 30),
				'Section',
				'i4',
				'red',
				100,
				100,
			);
			const stickyItem = new StickyNoteItem(new Position(40, 40), 'Note', 'i5');

			ws.addBoardItem(textItem);
			ws.addBoardItem(trackItem);
			ws.addBoardItem(imageItem);
			ws.addBoardItem(sectionItem);
			ws.addBoardItem(stickyItem);
			project.addWorkspace(ws);

			const json = ProjectStorage.serializeProject(project);

			expect(json.workspaces[0].items).toHaveLength(5);
			expect(json.workspaces[0].items.find((i) => i.id === 'i1')?.type).toBe(
				'TextItem',
			);
			expect(json.workspaces[0].items.find((i) => i.id === 'i2')?.type).toBe(
				'TrackItem',
			);
			expect(json.workspaces[0].items.find((i) => i.id === 'i3')?.type).toBe(
				'ImageItem',
			);
			expect(json.workspaces[0].items.find((i) => i.id === 'i4')?.type).toBe(
				'SectionItem',
			);
			expect(json.workspaces[0].items.find((i) => i.id === 'i5')?.type).toBe(
				'StickyNoteItem',
			);
		});

		it('should rewrite asset paths relative to project folder', () => {
			const project = new Project('My Project', '/my/path', 'p1');
			const ws = new Workspace('Main', 'w1');
			const trackItem = new TrackItem(
				new Position(0, 0),
				'Audio',
				'',
				'/my/path/assets/audio.mp3',
				'local',
				'oneshot',
				{ start: 0, end: 0 },
				'i1',
			);
			ws.addBoardItem(trackItem);
			project.addWorkspace(ws);

			const json = ProjectStorage.serializeProject(project);

			const serializedTrack = json.workspaces[0].items.find(
				(i) => i.id === 'i1',
			);
			expect(serializedTrack?.audioSource).toBe('assets/audio.mp3');
		});
	});

	describe('deserializeProject', () => {
		it('should deserialize project metadata', () => {
			const json = {
				id: 'p1',
				name: 'My Project',
				path: '/my/path',
				createdAt: '2026-01-01T00:00:00.000Z',
				workspaces: [],
			};

			const project = ProjectStorage.deserializeProject(json);

			expect(project.id).toBe('p1');
			expect(project.name).toBe('My Project');
			expect(project.path).toBe('/my/path');
			expect(project.createdAt).toBe('2026-01-01T00:00:00.000Z');
		});

		it('should deserialize workspaces and items into domain class instances', () => {
			const json = {
				id: 'p1',
				name: 'Project',
				path: '/my/path',
				createdAt: '2026-01-01T00:00:00.000Z',
				workspaces: [
					{
						id: 'w1',
						name: 'Main',
						viewportState: { zoom: 1.5, offset: { x: 10, y: 20 } },
						items: [
							{
								type: 'TextItem',
								id: 'i1',
								position: { x: 0, y: 0 },
								content: 'Hello',
							},
							{
								type: 'TrackItem',
								id: 'i2',
								position: { x: 10, y: 10 },
								audioSource: 'audio.mp3',
								title: 'Audio',
							},
						],
					},
				],
			};

			const project = ProjectStorage.deserializeProject(json);

			expect(project.workspaces.size).toBe(1);
			const ws = project.workspaces.get('w1');
			expect(ws).toBeDefined();
			expect(ws?.viewportState.offset.x).toBe(10);
			expect(ws?.viewportState.zoom).toBe(1.5);

			expect(ws?.items.size).toBe(2);
			const item1 = ws?.items.get('i1');
			const item2 = ws?.items.get('i2');
			expect(item1).toBeInstanceOf(TextItem);
			expect(item2).toBeInstanceOf(TrackItem);
			expect((item2 as TrackItem).audioSource).toBe('audio.mp3');
		});

		it('should handle legacy zoom > 10 normalization (divide by 100)', () => {
			const json = {
				id: 'p1',
				name: 'Project',
				path: '/path',
				createdAt: '2026-01-01T00:00:00.000Z',
				workspaces: [
					{
						id: 'w1',
						name: 'W',
						viewportState: { zoom: 50, offset: { x: 0, y: 0 } },
						items: [],
					},
				],
			};

			const project = ProjectStorage.deserializeProject(json);
			const ws = project.workspaces.get('w1');
			expect(ws?.viewportState.zoom).toBe(0.5);
		});

		it('should handle missing or optional fields gracefully with defaults', () => {
			const json = {
				id: 'p1',
				name: 'Project',
				path: '/path',
				createdAt: '2026-01-01T00:00:00.000Z',
				workspaces: [
					{
						id: 'w1',
						name: 'W',
						viewportState: { zoom: 1, offset: { x: 0, y: 0 } },
						items: [],
					},
				],
			};

			const project = ProjectStorage.deserializeProject(json);
			const ws = project.workspaces.get('w1');
			expect(ws?.viewportState).toBeInstanceOf(ViewportState);
			expect(ws?.viewportState.zoom).toBe(1);
		});
	});

	describe('Round-trip', () => {
		it('should preserve project state through serialize -> deserialize round-trip', () => {
			const originalProject = new Project('My Project', '/my/path', 'p1');
			const ws = new Workspace(
				'Main',
				'w1',
				new ViewportState(1.25, new Position(10, -10)),
			);

			const textItem = new TextItem(new Position(0, 0), 'Hello', 'i1');
			const trackItem = new TrackItem(
				new Position(10, 10),
				'Audio',
				'',
				'audio.mp3',
				'local',
				'oneshot',
				{ start: 0, end: 0 },
				'i2',
			);

			ws.addBoardItem(textItem);
			ws.addBoardItem(trackItem);
			originalProject.addWorkspace(ws);

			const serialized = ProjectStorage.serializeProject(originalProject);
			const deserialized = ProjectStorage.deserializeProject(serialized);

			expect(deserialized.id).toBe(originalProject.id);
			expect(deserialized.name).toBe(originalProject.name);
			expect(deserialized.path).toBe(originalProject.path);

			expect(deserialized.workspaces.size).toBe(1);
			const restoredWs = deserialized.workspaces.get('w1');
			expect(restoredWs).toBeDefined();
			if (!restoredWs) return;

			expect(restoredWs.id).toBe(ws.id);
			expect(restoredWs.viewportState.offset.x).toBe(ws.viewportState.offset.x);
			expect(restoredWs.viewportState.zoom).toBe(ws.viewportState.zoom);

			expect(restoredWs.items.size).toBe(2);
			const restoredText = restoredWs.items.get('i1') as TextItem;
			expect(restoredText.id).toBe(textItem.id);
			expect(restoredText.content).toBe(textItem.content);

			const restoredTrack = restoredWs.items.get('i2') as TrackItem;
			expect(restoredTrack.id).toBe(trackItem.id);
			expect(restoredTrack.audioSource).toBe(trackItem.audioSource);
		});
	});

	describe('Registry operations (localStorage fallback)', () => {
		it('should return empty array when no known projects exist', async () => {
			const projects = await ProjectStorage.getKnownProjects();
			expect(projects).toEqual([]);
		});

		it('should save project to registry', async () => {
			const project = new Project('Saved Project', '/saved/path', 'p1');
			await ProjectStorage.saveProjectToRegistry(project);

			const projects = await ProjectStorage.getKnownProjects();
			expect(projects).toHaveLength(1);
			expect(projects[0]).toEqual(
				expect.objectContaining({
					id: 'p1',
					name: 'Saved Project',
					path: '/saved/path',
				}),
			);
		});

		it('should update existing project in registry', async () => {
			const project = new Project('Saved Project', '/saved/path', 'p1');
			await ProjectStorage.saveProjectToRegistry(project);

			const updatedProject = new Project('Updated Project', '/new/path', 'p1');
			await ProjectStorage.saveProjectToRegistry(updatedProject);

			const projects = await ProjectStorage.getKnownProjects();
			expect(projects).toHaveLength(1);
			expect(projects[0].name).toBe('Updated Project');
			expect(projects[0].path).toBe('/new/path');
		});

		it('should remove project from registry', async () => {
			const project = new Project('Saved Project', '/saved/path', 'p1');
			await ProjectStorage.saveProjectToRegistry(project);

			let projects = await ProjectStorage.getKnownProjects();
			expect(projects).toHaveLength(1);

			await ProjectStorage.removeProjectFromRegistry('p1');

			projects = await ProjectStorage.getKnownProjects();
			expect(projects).toHaveLength(0);
		});
	});
});
