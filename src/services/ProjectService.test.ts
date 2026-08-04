import { CommandManager } from '@core/command/CommandManager';
import { StickyNoteItem } from '@core/model/item/StickyNoteItem';
import type { Project } from '@core/model/Project';
import { ProjectService } from '@services/ProjectService';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@core/persistence/DesktopBridge', () => ({
	DesktopBridge: {
		isTauri: vi.fn(() => false),
		fileExists: vi.fn(),
		readTextFile: vi.fn(),
		writeTextFile: vi.fn(),
		createDir: vi.fn(),
		getRegistryFilePath: vi.fn(),
	},
}));

vi.mock('@core/persistence/ProjectStorage', () => {
	const storage = new Map<string, Project>();
	return {
		formatSoundrefJsonPath: (p: string) => `${p}/soundref.json`,
		ProjectStorage: {
			getKnownProjects: vi.fn(async () => []),
			saveProjectToRegistry: vi.fn(async () => {}),
			saveProjectData: vi.fn(async (project: Project) => {
				storage.set(project.id, project);
			}),
			loadProjectData: vi.fn(async (id: string) => storage.get(id) || null),
			removeProjectFromRegistry: vi.fn(async () => {}),
		},
	};
});

describe('ProjectService', () => {
	beforeEach(() => {
		localStorage.clear();
		CommandManager.instance().clear();
		(ProjectService as unknown as { _instance: undefined })._instance =
			undefined;
	});

	describe('Project lifecycle management', () => {
		it('should return null when no project is active', () => {
			const service = ProjectService.instance();
			expect(service.getActiveProject()).toBeNull();
		});

		it('should create a new project with an initial workspace', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);

			expect(project.name).toBe('Test Project');
			expect(project.path).toBe('/path/to/test');
			const workspaces = await service.getWorkspaces(project.id);
			expect(workspaces.length).toBe(1);
		});

		it('should set created project as active project', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);

			const activeProject = service.getActiveProject();
			expect(activeProject).toBeDefined();
			expect(activeProject?.id).toBe(project.id);
		});

		it('should close active project and clear command manager', async () => {
			const service = ProjectService.instance();
			await service.createProject('Test Project', '/path/to/test');

			expect(service.getActiveProject()).not.toBeNull();

			const clearSpy = vi.spyOn(CommandManager.instance(), 'clear');
			service.closeActiveProject();

			expect(service.getActiveProject()).toBeNull();
			expect(clearSpy).toHaveBeenCalled();
		});
	});

	describe('Workspace management', () => {
		it('should get workspaces for the active project', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);

			const workspaces = await service.getWorkspaces(project.id);
			expect(workspaces.length).toBe(1);
		});

		it('should create a new workspace', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);

			const newWorkspace = await service.createWorkspace(
				project.id,
				'New Workspace',
			);
			expect(newWorkspace.name).toBe('New Workspace');

			const workspaces = await service.getWorkspaces(project.id);
			expect(workspaces.length).toBe(2);
		});

		it('should update name and viewport of a workspace', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);
			const workspaces = await service.getWorkspaces(project.id);
			const workspace = workspaces[0];

			await service.updateWorkspace(project.id, workspace.id, {
				name: 'Updated Name',
				zoom: 1.5,
				offsetX: 10,
				offsetY: 20,
			});

			const updatedWorkspace = await service.getWorkspace(
				project.id,
				workspace.id,
			);
			expect(updatedWorkspace.name).toBe('Updated Name');
			expect(updatedWorkspace.viewportState.offset.x).toBe(10);
			expect(updatedWorkspace.viewportState.offset.y).toBe(20);
			expect(updatedWorkspace.viewportState.zoom).toBe(1.5);
		});

		it('should delete a workspace', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);
			const workspaces = await service.getWorkspaces(project.id);
			const workspace = workspaces[0];

			await service.deleteWorkspace(project.id, workspace.id);

			const remainingWorkspaces = await service.getWorkspaces(project.id);
			expect(remainingWorkspaces.length).toBe(0);
		});

		it('should strip "page:" prefix from workspace IDs', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);
			const workspace = await service.createWorkspace(project.id, 'Test WS');

			const result = await service.getWorkspace(
				project.id,
				`page:${workspace.id}`,
			);
			expect(result.id).toBe(workspace.id);
		});
	});

	describe('Item management', () => {
		it('should create an item in a workspace', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);
			const workspaces = await service.getWorkspaces(project.id);
			const workspace = workspaces[0];

			const itemPayload = {
				type: 'StickyNoteItem',
				positionX: 10,
				positionY: 20,
				content: 'hello',
				color: 'yellow',
			};
			const createdItem = await service.createItem(
				project.id,
				workspace.id,
				itemPayload,
			);

			expect(createdItem).toBeInstanceOf(StickyNoteItem);
			const items = await service.getItems(project.id, workspace.id);
			expect(items.length).toBe(1);
			expect(items[0].id).toBe(createdItem.id);
		});

		it('should get items from a workspace', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);
			const workspaces = await service.getWorkspaces(project.id);
			const workspace = workspaces[0];

			await service.createItem(project.id, workspace.id, {
				type: 'StickyNoteItem',
				positionX: 0,
				positionY: 0,
				content: 'note',
			});

			const items = await service.getItems(project.id, workspace.id);
			expect(items.length).toBe(1);
		});

		it('should delete an item from a workspace', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);
			const workspaces = await service.getWorkspaces(project.id);
			const workspace = workspaces[0];

			const createdItem = await service.createItem(project.id, workspace.id, {
				type: 'StickyNoteItem',
				positionX: 0,
				positionY: 0,
				content: 'to delete',
			});

			await service.deleteItem(project.id, workspace.id, createdItem.id);

			const items = await service.getItems(project.id, workspace.id);
			expect(items.length).toBe(0);
		});
	});

	describe('syncWorkspaceItems diffing', () => {
		it('should create new items when sync payload contains new items', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject('Test', '/path');
			const workspaces = await service.getWorkspaces(project.id);
			const workspace = workspaces[0];

			const payload = [
				{
					id: 'item-1',
					type: 'StickyNoteItem',
					x: 0,
					y: 0,
					content: 'hello',
					color: 'yellow',
				},
			];

			await service.syncWorkspaceItems(project.id, workspace.id, payload);

			const items = await service.getItems(project.id, workspace.id);
			expect(items.length).toBe(1);
			expect(items[0].id).toBe('item-1');
		});

		it('should delete items when sync payload omits existing items', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject('Test', '/path');
			const workspaces = await service.getWorkspaces(project.id);
			const workspace = workspaces[0];

			await service.createItem(project.id, workspace.id, {
				type: 'StickyNoteItem',
				positionX: 0,
				positionY: 0,
				content: 'hello',
			});

			await service.syncWorkspaceItems(project.id, workspace.id, []);

			const items = await service.getItems(project.id, workspace.id);
			expect(items.length).toBe(0);
		});

		it('should update items when sync payload modifies item properties', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject('Test', '/path');
			const workspaces = await service.getWorkspaces(project.id);
			const workspace = workspaces[0];

			await service.syncWorkspaceItems(project.id, workspace.id, [
				{
					id: 'item-1',
					type: 'StickyNoteItem',
					x: 0,
					y: 0,
					content: 'hello',
					color: 'yellow',
				},
			]);

			await service.syncWorkspaceItems(project.id, workspace.id, [
				{
					id: 'item-1',
					type: 'StickyNoteItem',
					x: 10,
					y: 10,
					content: 'updated',
					color: 'blue',
				},
			]);

			const items = await service.getItems(project.id, workspace.id);
			expect(items.length).toBe(1);
			const updatedItem = items[0] as StickyNoteItem;
			expect(updatedItem.content).toBe('updated');
			expect(updatedItem.color).toBe('blue');
		});
	});

	describe('Undo / Redo', () => {
		it('should perform undo and redo operations', async () => {
			const service = ProjectService.instance();
			const project = await service.createProject(
				'Test Project',
				'/path/to/test',
			);
			const workspaces = await service.getWorkspaces(project.id);
			const workspace = workspaces[0];

			await service.createItem(project.id, workspace.id, {
				type: 'StickyNoteItem',
				positionX: 0,
				positionY: 0,
				content: 'hello',
			});
			expect((await service.getItems(project.id, workspace.id)).length).toBe(1);

			await service.undo();
			expect((await service.getItems(project.id, workspace.id)).length).toBe(0);

			await service.redo();
			expect((await service.getItems(project.id, workspace.id)).length).toBe(1);
		});
	});
});
