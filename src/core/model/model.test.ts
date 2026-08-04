import { BoardItem } from '@core/model/item/BoardItem';
import { ImageItem } from '@core/model/item/ImageItem';
import { SectionItem } from '@core/model/item/SectionItem';
import { StickyNoteItem } from '@core/model/item/StickyNoteItem';
import { TextItem } from '@core/model/item/TextItem';
import { TrackItem } from '@core/model/item/TrackItem';
import { Position } from '@core/model/Position';
import { Project } from '@core/model/Project';
import { ViewportState } from '@core/model/ViewportState';
import { Workspace } from '@core/model/Workspace';
import { describe, expect, it } from 'vitest';

describe('Position', () => {
	it('should create a position with default values', () => {
		const pos = new Position();
		expect(pos.x).toBe(0);
		expect(pos.y).toBe(0);
	});

	it('should create a position with specific coordinates', () => {
		const pos = new Position(10, 20);
		expect(pos.x).toBe(10);
		expect(pos.y).toBe(20);
	});
});

describe('ViewportState', () => {
	it('should create a viewport state with default values', () => {
		const state = new ViewportState();
		expect(state.zoom).toBe(1.0);
		expect(state.offset).toBeInstanceOf(Position);
		expect(state.offset.x).toBe(0);
		expect(state.offset.y).toBe(0);
	});

	it('should create a custom viewport state', () => {
		const offset = new Position(100, 200);
		const state = new ViewportState(2.5, offset);
		expect(state.zoom).toBe(2.5);
		expect(state.offset).toBe(offset);
	});
});

describe('Project', () => {
	it('should create a project with auto-generated ID and timestamp', () => {
		const project = new Project('Mon Projet', '/chemin');
		expect(project.id).toBeDefined();
		expect(typeof project.id).toBe('string');
		expect(project.name).toBe('Mon Projet');
		expect(project.path).toBe('/chemin');
		expect(project.createdAt).toBeDefined();
		expect(project.workspaces).toBeInstanceOf(Map);
		expect(project.workspaces.size).toBe(0);
	});

	it('should create a project with explicit values', () => {
		const date = new Date().toISOString();
		const workspaces = new Map<string, Workspace>();
		const project = new Project('Test', '/test', 'custom-id', date, workspaces);

		expect(project.id).toBe('custom-id');
		expect(project.createdAt).toBe(date);
		expect(project.workspaces).toBe(workspaces);
	});

	it('should add a workspace to the project', () => {
		const project = new Project('Projet', '/chemin');
		const workspace = new Workspace('Espace 1');

		const id = project.addWorkspace(workspace);
		expect(id).toBe(workspace.id);
		expect(project.workspaces.get(id)).toBe(workspace);
		expect(project.workspaces.size).toBe(1);
	});

	it('should delete a workspace from the project', () => {
		const project = new Project('Projet', '/chemin');
		const workspace = new Workspace('Espace 1');
		project.addWorkspace(workspace);

		const deleted = project.deleteWorkspace(workspace.id);
		expect(deleted).toBe(workspace);
		expect(project.workspaces.size).toBe(0);
	});

	it('should return undefined when deleting a non-existent workspace', () => {
		const project = new Project('Projet', '/chemin');
		const deleted = project.deleteWorkspace('non-existent');
		expect(deleted).toBeUndefined();
	});
});

describe('Workspace', () => {
	it('should create a workspace with auto-generated ID and defaults', () => {
		const workspace = new Workspace('Mon Espace');
		expect(workspace.id).toBeDefined();
		expect(typeof workspace.id).toBe('string');
		expect(workspace.name).toBe('Mon Espace');
		expect(workspace.viewportState).toBeInstanceOf(ViewportState);
		expect(workspace.items).toBeInstanceOf(Map);
		expect(workspace.items.size).toBe(0);
	});

	it('should add a board item to the workspace', () => {
		const workspace = new Workspace('Espace');
		const item = new TextItem();

		const id = workspace.addBoardItem(item);
		expect(id).toBe(item.id);
		expect(workspace.items.get(id)).toBe(item);
		expect(workspace.items.size).toBe(1);
	});

	it('should delete a board item from the workspace', () => {
		const workspace = new Workspace('Espace');
		const item = new TextItem();
		workspace.addBoardItem(item);

		const deleted = workspace.deleteBoardItem(item.id);
		expect(deleted).toBe(item);
		expect(workspace.items.size).toBe(0);
	});

	it('should return undefined when deleting a non-existent item', () => {
		const workspace = new Workspace('Espace');
		const deleted = workspace.deleteBoardItem('non-existent');
		expect(deleted).toBeUndefined();
	});
});

describe('TrackItem', () => {
	it('should create a track with default values', () => {
		const item = new TrackItem();
		expect(item).toBeInstanceOf(BoardItem);
		expect(item.type).toBe('TrackItem');
		expect(item.title).toBe('Track');
		expect(item.imageUrl).toBe('');
		expect(item.audioSource).toBe('');
		expect(item.sourceType).toBe('local');
		expect(item.playMode).toBe('oneshot');
		expect(item.loopRegion).toEqual({ start: 0, end: 0 });
		expect(item.scale).toBe(1);
		expect(item.width).toBe(200);
		expect(item.id).toBeDefined();
		expect(item.position).toBeInstanceOf(Position);
	});

	it('should create a track with custom values', () => {
		const pos = new Position(10, 10);
		const item = new TrackItem(
			pos,
			'Ma Piste',
			'image.png',
			'audio.mp3',
			'stream',
			'loop',
			{ start: 1, end: 5 },
			'custom-id',
			2,
			400,
		);
		expect(item.position).toBe(pos);
		expect(item.title).toBe('Ma Piste');
		expect(item.imageUrl).toBe('image.png');
		expect(item.audioSource).toBe('audio.mp3');
		expect(item.sourceType).toBe('stream');
		expect(item.playMode).toBe('loop');
		expect(item.loopRegion).toEqual({ start: 1, end: 5 });
		expect(item.id).toBe('custom-id');
		expect(item.scale).toBe(2);
		expect(item.width).toBe(400);
	});
});

describe('ImageItem', () => {
	it('should create an image with default values', () => {
		const item = new ImageItem();
		expect(item).toBeInstanceOf(BoardItem);
		expect(item.type).toBe('ImageItem');
		expect(item.imageUrl).toBe('');
		expect(item.scale).toBe(1);
		expect(item.width).toBe(300);
		expect(item.height).toBe(300);
		expect(item.id).toBeDefined();
		expect(item.position).toBeInstanceOf(Position);
	});

	it('should create an image with specific dimensions', () => {
		const item = new ImageItem(
			new Position(),
			'url',
			'custom-id',
			1.5,
			500,
			600,
		);
		expect(item.imageUrl).toBe('url');
		expect(item.id).toBe('custom-id');
		expect(item.scale).toBe(1.5);
		expect(item.width).toBe(500);
		expect(item.height).toBe(600);
	});
});

describe('StickyNoteItem', () => {
	it('should create a sticky note with default yellow color', () => {
		const item = new StickyNoteItem();
		expect(item).toBeInstanceOf(BoardItem);
		expect(item.type).toBe('StickyNoteItem');
		expect(item.content).toBe('');
		expect(item.scale).toBe(1);
		expect(item.color).toBe('yellow');
		expect(item.id).toBeDefined();
		expect(item.position).toBeInstanceOf(Position);
	});

	it('should create a sticky note with custom color', () => {
		const item = new StickyNoteItem(new Position(), 'Texte', 'id-1', 1, 'pink');
		expect(item.content).toBe('Texte');
		expect(item.id).toBe('id-1');
		expect(item.color).toBe('pink');
	});
});

describe('SectionItem', () => {
	it('should create a section with default values', () => {
		const item = new SectionItem(new Position());
		expect(item).toBeInstanceOf(BoardItem);
		expect(item.title).toBe('Section');
		expect(item.color).toBe('blue');
		expect(item.width).toBe(400);
		expect(item.height).toBe(300);
		expect(item.id).toBeDefined();
		expect(item.position).toBeInstanceOf(Position);
	});

	it('should create a section with custom values', () => {
		const item = new SectionItem(
			new Position(),
			'Ma Section',
			'sec-1',
			'red',
			800,
			600,
		);
		expect(item.title).toBe('Ma Section');
		expect(item.id).toBe('sec-1');
		expect(item.color).toBe('red');
		expect(item.width).toBe(800);
		expect(item.height).toBe(600);
	});
});

describe('TextItem', () => {
	it('should create a text item with default values', () => {
		const item = new TextItem();
		expect(item).toBeInstanceOf(BoardItem);
		expect(item.type).toBe('TextItem');
		expect(item.content).toBe('');
		expect(item.scale).toBe(1);
		expect(item.width).toBeUndefined();
		expect(item.id).toBeDefined();
		expect(item.position).toBeInstanceOf(Position);
	});

	it('should create a text item with fixed width', () => {
		const item = new TextItem(new Position(), 'Bonjour', 'text-1', 2, 500);
		expect(item.content).toBe('Bonjour');
		expect(item.id).toBe('text-1');
		expect(item.scale).toBe(2);
		expect(item.width).toBe(500);
	});
});
