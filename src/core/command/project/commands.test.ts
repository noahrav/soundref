import { Project } from '@core/model/Project';
import { Workspace } from '@core/model/Workspace';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateWorkspaceCommand } from './CreateWorkspaceCommand';
import { DeleteWorkspaceCommand } from './DeleteWorkspaceCommand';
import { UpdateWorkspaceCommand } from './UpdateWorkspaceCommand';

describe('CreateWorkspaceCommand', () => {
	let project: Project;

	beforeEach(() => {
		project = new Project('Test Project', '/test');
	});

	it('should add workspace to project on execute', () => {
		const command = new CreateWorkspaceCommand(project, 'New Workspace');
		command.execute();

		expect(project.workspaces.size).toBe(1);
		const ws = project.workspaces.get(command.getCreatedWorkspaceId());
		expect(ws).toBeDefined();
		expect(ws?.name).toBe('New Workspace');
	});

	it('should remove workspace on undo', () => {
		const command = new CreateWorkspaceCommand(project, 'New Workspace');
		command.execute();
		command.undo();

		expect(project.workspaces.size).toBe(0);
	});

	it('should restore workspace after execute, undo, redo round-trip', () => {
		const command = new CreateWorkspaceCommand(project, 'New Workspace');
		command.execute();
		command.undo();
		command.execute();

		expect(project.workspaces.size).toBe(1);
	});

	it('should create workspace with explicit ID', () => {
		const command = new CreateWorkspaceCommand(
			project,
			'New Workspace',
			'custom-id',
		);
		command.execute();

		expect(project.workspaces.has('custom-id')).toBe(true);
		expect(command.getCreatedWorkspaceId()).toBe('custom-id');
	});

	it('should accept an existing Workspace instance', () => {
		const ws = new Workspace('Existing Workspace', 'existing-id');
		const command = new CreateWorkspaceCommand(project, ws);
		command.execute();

		expect(project.workspaces.has('existing-id')).toBe(true);
		expect(project.workspaces.get('existing-id')).toBe(ws);
	});

	it('should return the created workspace ID', () => {
		const command = new CreateWorkspaceCommand(project, 'New Workspace');
		expect(command.getCreatedWorkspaceId()).toBeDefined();
		expect(command.getCreatedWorkspaceId()).toBe(command.workspace.id);
	});
});

describe('DeleteWorkspaceCommand', () => {
	let project: Project;
	let workspace: Workspace;

	beforeEach(() => {
		project = new Project('Test Project', '/test');
		workspace = new Workspace('To Delete', 'delete-id');
		project.addWorkspace(workspace);
	});

	it('should remove workspace on execute', () => {
		const command = new DeleteWorkspaceCommand(project, 'delete-id');
		command.execute();

		expect(project.workspaces.size).toBe(0);
	});

	it('should restore workspace on undo', () => {
		const command = new DeleteWorkspaceCommand(project, 'delete-id');
		command.execute();
		command.undo();

		expect(project.workspaces.size).toBe(1);
		expect(project.workspaces.get('delete-id')).toBe(workspace);
	});

	it('should restore workspace identically after round-trip', () => {
		const command = new DeleteWorkspaceCommand(project, 'delete-id');
		command.execute();
		command.undo();

		expect(project.workspaces.size).toBe(1);
		expect(project.workspaces.get('delete-id')).toBe(workspace);
	});

	it('should accept a direct Workspace instance', () => {
		const command = new DeleteWorkspaceCommand(project, workspace);
		command.execute();

		expect(project.workspaces.size).toBe(0);
	});

	it('should do nothing when deleting a non-existent workspace', () => {
		const command = new DeleteWorkspaceCommand(project, 'unknown-id');
		command.execute();

		expect(project.workspaces.size).toBe(1);
	});
});

describe('UpdateWorkspaceCommand', () => {
	let project: Project;
	let workspace: Workspace;

	beforeEach(() => {
		project = new Project('Test Project', '/test');
		workspace = new Workspace('Old Name', 'update-id');
		workspace.viewportState.zoom = 1;
		workspace.viewportState.offset = { x: 0, y: 0 };
		project.addWorkspace(workspace);
	});

	it('should apply new name on execute', () => {
		const command = new UpdateWorkspaceCommand(
			project,
			'update-id',
			{ name: 'Old Name' },
			{ name: 'New Name' },
		);
		command.execute();

		expect(workspace.name).toBe('New Name');
	});

	it('should restore old name on undo', () => {
		const command = new UpdateWorkspaceCommand(
			project,
			'update-id',
			{ name: 'Old Name' },
			{ name: 'New Name' },
		);
		command.execute();
		command.undo();

		expect(workspace.name).toBe('Old Name');
	});

	it('should update viewport zoom on execute', () => {
		const command = new UpdateWorkspaceCommand(
			project,
			'update-id',
			{ zoom: 1 },
			{ zoom: 2 },
		);
		command.execute();

		expect(workspace.viewportState.zoom).toBe(2);
	});

	it('should update viewport offset on execute', () => {
		const command = new UpdateWorkspaceCommand(
			project,
			'update-id',
			{ offsetX: 0, offsetY: 0 },
			{ offsetX: 100, offsetY: 200 },
		);
		command.execute();

		expect(workspace.viewportState.offset.x).toBe(100);
		expect(workspace.viewportState.offset.y).toBe(200);
	});

	it('should only update specified fields in partial update', () => {
		const command = new UpdateWorkspaceCommand(
			project,
			'update-id',
			{ name: 'Old Name' },
			{ name: 'New Name' },
		);
		command.execute();

		expect(workspace.name).toBe('New Name');
		expect(workspace.viewportState.zoom).toBe(1);
	});

	it('should do nothing when workspace does not exist', () => {
		const command = new UpdateWorkspaceCommand(
			project,
			'unknown-id',
			{ name: 'Old Name' },
			{ name: 'New Name' },
		);
		command.execute();

		expect(workspace.name).toBe('Old Name');
	});

	it('should restore all properties after full round-trip', () => {
		const oldState = { name: 'Old Name', zoom: 1, offsetX: 0, offsetY: 0 };
		const newState = { name: 'New Name', zoom: 1.5, offsetX: 50, offsetY: -50 };
		const command = new UpdateWorkspaceCommand(
			project,
			'update-id',
			oldState,
			newState,
		);

		command.execute();
		expect(workspace.name).toBe('New Name');
		expect(workspace.viewportState.zoom).toBe(1.5);
		expect(workspace.viewportState.offset.x).toBe(50);
		expect(workspace.viewportState.offset.y).toBe(-50);

		command.undo();
		expect(workspace.name).toBe('Old Name');
		expect(workspace.viewportState.zoom).toBe(1);
		expect(workspace.viewportState.offset.x).toBe(0);
		expect(workspace.viewportState.offset.y).toBe(0);
	});
});
