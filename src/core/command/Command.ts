/**
 * Abstract command base class following the Command design pattern for undoable operations.
 */
export abstract class Command {
	/** Executes the command mutation */
	public abstract execute(): void;

	/** Reverts the command mutation */
	public abstract undo(): void;
}
