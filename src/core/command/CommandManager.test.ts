import { Command } from '@core/command/Command';
import { CommandManager } from '@core/command/CommandManager';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class MockCommand extends Command {
	public execute = vi.fn();
	public undo = vi.fn();
}

function createMockCommand(): MockCommand {
	return new MockCommand();
}

describe('CommandManager', () => {
	let cm: CommandManager;

	beforeEach(() => {
		cm = CommandManager.instance();
		cm.clear();
		(cm as unknown as { listeners: Set<unknown> }).listeners.clear();
	});

	it('should execute a command and push to undo stack', () => {
		const cmd = createMockCommand();
		cm.executeCommand(cmd);

		expect(cmd.execute).toHaveBeenCalledTimes(1);
		expect(cm.canUndo()).toBe(true);
		expect(cm.canRedo()).toBe(false);
	});

	it('should undo a command (Ctrl+Z)', () => {
		const cmd = createMockCommand();
		cm.executeCommand(cmd);
		cm.undo();

		expect(cmd.undo).toHaveBeenCalledTimes(1);
		expect(cm.canUndo()).toBe(false);
		expect(cm.canRedo()).toBe(true);
	});

	it('should redo a command (Ctrl+Y)', () => {
		const cmd = createMockCommand();
		cm.executeCommand(cmd);
		cm.undo();
		cm.redo();

		expect(cmd.execute).toHaveBeenCalledTimes(2);
		expect(cm.canUndo()).toBe(true);
		expect(cm.canRedo()).toBe(false);
	});

	it('should return null when undoing with empty history', () => {
		const result = cm.undo();
		expect(result).toBeNull();
		expect(cm.canUndo()).toBe(false);
	});

	it('should return null when redoing without prior undo', () => {
		const result = cm.redo();
		expect(result).toBeNull();
		expect(cm.canRedo()).toBe(false);
	});

	it('should clear redo stack when executing after undo', () => {
		const cmd1 = createMockCommand();
		const cmd2 = createMockCommand();
		cm.executeCommand(cmd1);
		cm.undo();

		expect(cm.canRedo()).toBe(true);

		cm.executeCommand(cmd2);
		expect(cm.canRedo()).toBe(false);
		expect(cm.canUndo()).toBe(true);
	});

	it('should handle complex sequence: 5 execute, 3 undo, 2 redo', () => {
		const commands = Array.from({ length: 5 }, () => createMockCommand());
		commands.forEach((cmd) => {
			cm.executeCommand(cmd);
		});

		expect(cm.canUndo()).toBe(true);

		cm.undo();
		cm.undo();
		cm.undo();

		expect(commands[4].undo).toHaveBeenCalledTimes(1);
		expect(commands[3].undo).toHaveBeenCalledTimes(1);
		expect(commands[2].undo).toHaveBeenCalledTimes(1);

		cm.redo();
		cm.redo();

		expect(commands[2].execute).toHaveBeenCalledTimes(2);
		expect(commands[3].execute).toHaveBeenCalledTimes(2);

		cm.undo();
		cm.undo();
		cm.undo();
		cm.undo();

		expect(cm.canUndo()).toBe(false);
		expect(cm.canRedo()).toBe(true);
	});

	it('should notify listeners on execute, undo, redo, and clear', () => {
		const listener = vi.fn();
		cm.subscribe(listener);

		const cmd = createMockCommand();
		cm.executeCommand(cmd);
		expect(listener).toHaveBeenCalledTimes(1);

		cm.undo();
		expect(listener).toHaveBeenCalledTimes(2);

		cm.redo();
		expect(listener).toHaveBeenCalledTimes(3);

		cm.clear();
		expect(listener).toHaveBeenCalledTimes(4);
	});

	it('should stop notifying after unsubscribe', () => {
		const listener = vi.fn();
		const unsubscribe = cm.subscribe(listener);

		unsubscribe();

		const cmd = createMockCommand();
		cm.executeCommand(cmd);

		expect(listener).not.toHaveBeenCalled();
	});

	it('should not crash other listeners when one throws', () => {
		const errorListener = vi.fn().mockImplementation(() => {
			throw new Error('Test error');
		});
		const goodListener = vi.fn();

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const unsub1 = cm.subscribe(errorListener);
		const unsub2 = cm.subscribe(goodListener);

		const cmd = createMockCommand();

		expect(() => cm.executeCommand(cmd)).not.toThrow();
		expect(errorListener).toHaveBeenCalledTimes(1);
		expect(goodListener).toHaveBeenCalledTimes(1);
		expect(consoleSpy).toHaveBeenCalled();

		consoleSpy.mockRestore();
		unsub1();
		unsub2();
	});

	it('should clear both undo and redo stacks', () => {
		const cmd = createMockCommand();
		cm.executeCommand(cmd);

		cm.clear();

		expect(cm.canUndo()).toBe(false);
		expect(cm.canRedo()).toBe(false);
	});

	it('should push to undo stack without calling execute when executeImmediately is false', () => {
		const cmd = createMockCommand();
		cm.executeCommand(cmd, false);

		expect(cmd.execute).not.toHaveBeenCalled();
		expect(cm.canUndo()).toBe(true);
	});

	it('should return the undone command', () => {
		const cmd = createMockCommand();
		cm.executeCommand(cmd);

		const result = cm.undo();
		expect(result).toBe(cmd);
	});

	it('should return the redone command', () => {
		const cmd = createMockCommand();
		cm.executeCommand(cmd);
		cm.undo();

		const result = cm.redo();
		expect(result).toBe(cmd);
	});

	it('should always return the same singleton instance', () => {
		const instance1 = CommandManager.instance();
		const instance2 = CommandManager.instance();

		expect(instance1).toBe(instance2);
	});
});
