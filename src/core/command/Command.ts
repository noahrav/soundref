export abstract class Command {
	public abstract execute(): void;
	public abstract undo(): void;
}
