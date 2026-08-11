export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
}

type NotificationListener = (toasts: Toast[]) => void;

/**
 * Singleton NotificationService managing toast alerts across the application.
 */
export class NotificationService {
	private static _instance: NotificationService;
	private toasts: Toast[] = [];
	private listeners: Set<NotificationListener> = new Set();

	private constructor() {}

	public static instance(): NotificationService {
		if (!NotificationService._instance) {
			NotificationService._instance = new NotificationService();
		}
		return NotificationService._instance;
	}

	public subscribe(listener: NotificationListener): () => void {
		this.listeners.add(listener);
		listener([...this.toasts]);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify(): void {
		const current = [...this.toasts];
		this.listeners.forEach((l) => {
			l(current);
		});
	}

	public show(
		message: string,
		type: ToastType = 'info',
		durationMs = 4000,
	): void {
		const id = Math.random().toString(36).substring(2, 9);
		const toast: Toast = { id, message, type };
		this.toasts.push(toast);
		this.notify();

		if (durationMs > 0) {
			setTimeout(() => {
				this.dismiss(id);
			}, durationMs);
		}
	}

	public error(message: string, durationMs = 5000): void {
		this.show(message, 'error', durationMs);
	}

	public success(message: string, durationMs = 3000): void {
		this.show(message, 'success', durationMs);
	}

	public warning(message: string, durationMs = 4000): void {
		this.show(message, 'warning', durationMs);
	}

	public info(message: string, durationMs = 3000): void {
		this.show(message, 'info', durationMs);
	}

	public dismiss(id: string): void {
		this.toasts = this.toasts.filter((t) => t.id !== id);
		this.notify();
	}
}

export const notify = NotificationService.instance();
