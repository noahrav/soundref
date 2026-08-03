import type { Command } from '@core/command/Command';

type CommandChangeListener = () => void;

/**
 * Singleton manager executing commands and maintaining undo/redo stacks.
 */
export class CommandManager {
	private static _instance: CommandManager;
	private undoStack: Command[] = [];
	private redoStack: Command[] = [];
	private listeners: Set<CommandChangeListener> = new Set();

	/**
	 * Private constructor for singleton pattern.
	 */
	private constructor() {}

	/**
	 * Gets the singleton instance of CommandManager.
	 * @returns CommandManager instance.
	 */
	public static instance(): CommandManager {
		if (!CommandManager._instance) {
			CommandManager._instance = new CommandManager();
		}
		return CommandManager._instance;
	}

	/**
	 * Registers a listener to be notified when undo/redo stack state changes.
	 * @param listener Callback function.
	 * @returns Unsubscribe function.
	 */
	public subscribe(listener: CommandChangeListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((listener) => {
			try {
				listener();
			} catch (e) {
				console.error('[CommandManager] Listener error:', e);
			}
		});
	}

	/**
	 * Executes a command and pushes it onto the undo stack, clearing the redo stack.
	 * @param command Command to execute.
	 * @param executeImmediately If true (default), invokes command.execute() first.
	 */
	public executeCommand(command: Command, executeImmediately = true): void {
		if (executeImmediately) {
			command.execute();
		}
		this.undoStack.push(command);
		this.redoStack = [];
		this.notify();
	}

	/**
	 * Undoes the top command on the undo stack.
	 * @returns The undone Command or null if stack is empty.
	 */
	public undo(): Command | null {
		const command = this.undoStack.pop();
		if (!command) return null;

		command.undo();
		this.redoStack.push(command);
		this.notify();
		return command;
	}

	/**
	 * Redoes the top command on the redo stack.
	 * @returns The redone Command or null if stack is empty.
	 */
	public redo(): Command | null {
		const command = this.redoStack.pop();
		if (!command) return null;

		command.execute();
		this.undoStack.push(command);
		this.notify();
		return command;
	}

	/**
	 * Checks if an undo operation is available.
	 * @returns True if undo stack is not empty.
	 */
	public canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	/**
	 * Checks if a redo operation is available.
	 * @returns True if redo stack is not empty.
	 */
	public canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	/**
	 * Clears both undo and redo stacks.
	 */
	public clear(): void {
		this.undoStack = [];
		this.redoStack = [];
		this.notify();
	}
}
