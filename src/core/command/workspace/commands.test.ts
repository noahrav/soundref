import { ImageItem } from '@core/model/item/ImageItem';
import { StickyNoteItem } from '@core/model/item/StickyNoteItem';
import { TrackItem } from '@core/model/item/TrackItem';
import { Position } from '@core/model/Position';
import { Workspace } from '@core/model/Workspace';
import { revokeBlobUrlForFile } from '@core/utils/mediaUtils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateItemCommand } from './CreateItemCommand';
import { DeleteItemCommand } from './DeleteItemCommand';
import { UpdateItemCommand } from './UpdateItemCommand';

vi.mock('@core/utils/mediaUtils', () => ({
	revokeBlobUrlForFile: vi.fn(),
}));

describe('CreateItemCommand', () => {
	let workspace: Workspace;

	beforeEach(() => {
		workspace = new Workspace('Test Workspace', 'ws-id');
	});

	it('should add item to workspace on execute', () => {
		const item = new StickyNoteItem(new Position(0, 0), 'Hello', 'item-id');
		const command = new CreateItemCommand(workspace, item);

		command.execute();

		expect(workspace.items.size).toBe(1);
		expect(workspace.items.get('item-id')).toBe(item);
	});

	it('should remove item on undo', () => {
		const item = new StickyNoteItem(new Position(0, 0), 'Hello', 'item-id');
		const command = new CreateItemCommand(workspace, item);

		command.execute();
		command.undo();

		expect(workspace.items.size).toBe(0);
	});

	it('should restore item after execute, undo, redo round-trip', () => {
		const item = new StickyNoteItem(new Position(0, 0), 'Hello', 'item-id');
		const command = new CreateItemCommand(workspace, item);

		command.execute();
		command.undo();
		command.execute();

		expect(workspace.items.size).toBe(1);
		expect(workspace.items.get('item-id')).toBe(item);
	});

	it('should support creating different item types (track, image)', () => {
		const trackItem = new TrackItem(
			new Position(10, 10),
			'Track 1',
			undefined,
			undefined,
			'local',
			'oneshot',
			undefined,
			'track-id',
		);
		const trackCommand = new CreateItemCommand(workspace, trackItem);
		trackCommand.execute();

		const imageItem = new ImageItem(new Position(20, 20), 'url', 'image-id');
		const imageCommand = new CreateItemCommand(workspace, imageItem);
		imageCommand.execute();

		expect(workspace.items.size).toBe(2);
		expect(workspace.items.get('track-id')).toBe(trackItem);
		expect(workspace.items.get('image-id')).toBe(imageItem);
	});
});

describe('DeleteItemCommand', () => {
	let workspace: Workspace;
	let stickyNote: StickyNoteItem;

	beforeEach(() => {
		vi.clearAllMocks();
		workspace = new Workspace('Test Workspace', 'ws-id');
		stickyNote = new StickyNoteItem(new Position(0, 0), 'Note', 'note-id');
		workspace.addBoardItem(stickyNote);
	});

	it('should remove item from workspace on execute', () => {
		const command = new DeleteItemCommand(workspace, stickyNote);
		command.execute();

		expect(workspace.items.size).toBe(0);
	});

	it('should restore item on undo', () => {
		const command = new DeleteItemCommand(workspace, stickyNote);
		command.execute();
		command.undo();

		expect(workspace.items.size).toBe(1);
		expect(workspace.items.get('note-id')).toBe(stickyNote);
	});

	it('should restore item identically after round-trip', () => {
		const command = new DeleteItemCommand(workspace, stickyNote);
		command.execute();
		command.undo();

		expect(workspace.items.size).toBe(1);
		expect(workspace.items.get('note-id')).toBe(stickyNote);
	});

	it('should call revokeBlobUrlForFile when deleting TrackItem with audioSource', () => {
		const audioSource = 'blob:http://localhost/1234';
		const trackItem = new TrackItem(
			new Position(0, 0),
			'Track',
			undefined,
			audioSource,
			'local',
			'oneshot',
			undefined,
			'track-id',
		);
		workspace.addBoardItem(trackItem);

		const command = new DeleteItemCommand(workspace, trackItem);
		command.execute();

		expect(workspace.items.has('track-id')).toBe(false);
		expect(revokeBlobUrlForFile).toHaveBeenCalledWith(audioSource);
	});

	it('should not call revokeBlobUrlForFile when deleting TrackItem without audioSource', () => {
		const trackItem = new TrackItem(
			new Position(0, 0),
			'Track',
			undefined,
			undefined,
			'local',
			'oneshot',
			undefined,
			'track-id',
		);
		workspace.addBoardItem(trackItem);

		const command = new DeleteItemCommand(workspace, trackItem);
		command.execute();

		expect(workspace.items.has('track-id')).toBe(false);
		expect(revokeBlobUrlForFile).not.toHaveBeenCalled();
	});

	it('should accept item ID string', () => {
		const command = new DeleteItemCommand(workspace, 'note-id');
		command.execute();

		expect(workspace.items.size).toBe(0);
	});

	it('should do nothing when deleting a non-existent item', () => {
		const command = new DeleteItemCommand(workspace, 'unknown-id');
		command.execute();

		expect(workspace.items.size).toBe(1);
	});
});

describe('UpdateItemCommand', () => {
	let workspace: Workspace;
	let oldItem: StickyNoteItem;

	beforeEach(() => {
		workspace = new Workspace('Test Workspace', 'ws-id');
		oldItem = new StickyNoteItem(new Position(0, 0), 'Old Content', 'note-id');
		workspace.addBoardItem(oldItem);
	});

	it('should replace item with new version on execute', () => {
		const newItem = new StickyNoteItem(
			new Position(0, 0),
			'New Content',
			'note-id',
		);
		const command = new UpdateItemCommand(workspace, oldItem, newItem);

		command.execute();

		expect(workspace.items.size).toBe(1);
		const updatedItem = workspace.items.get('note-id') as StickyNoteItem;
		expect(updatedItem.content).toBe('New Content');
		expect(updatedItem).toBe(newItem);
	});

	it('should restore old item on undo', () => {
		const newItem = new StickyNoteItem(
			new Position(0, 0),
			'New Content',
			'note-id',
		);
		const command = new UpdateItemCommand(workspace, oldItem, newItem);

		command.execute();
		command.undo();

		expect(workspace.items.size).toBe(1);
		const restoredItem = workspace.items.get('note-id') as StickyNoteItem;
		expect(restoredItem.content).toBe('Old Content');
		expect(restoredItem).toBe(oldItem);
	});

	it('should restore new item after execute, undo, redo round-trip', () => {
		const newItem = new StickyNoteItem(
			new Position(0, 0),
			'New Content',
			'note-id',
		);
		const command = new UpdateItemCommand(workspace, oldItem, newItem);

		command.execute();
		command.undo();
		command.execute();

		expect(workspace.items.size).toBe(1);
		const updatedItem = workspace.items.get('note-id') as StickyNoteItem;
		expect(updatedItem.content).toBe('New Content');
		expect(updatedItem).toBe(newItem);
	});

	it('should keep the same ID for old and new items', () => {
		const newItem = new StickyNoteItem(
			new Position(0, 0),
			'New Content',
			'note-id',
		);
		const command = new UpdateItemCommand(workspace, oldItem, newItem);

		expect(oldItem.id).toBe(newItem.id);
		command.execute();
		expect(workspace.items.get(oldItem.id)).toBe(newItem);
	});
});
