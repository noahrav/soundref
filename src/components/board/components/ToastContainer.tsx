import { NotificationService, type Toast } from '@services/NotificationService';
import { useEffect, useState } from 'react';
import './ToastContainer.scss';

export function ToastContainer() {
	const [toasts, setToasts] = useState<Toast[]>([]);

	useEffect(() => {
		const unsub = NotificationService.instance().subscribe((list) => {
			setToasts(list);
		});
		return unsub;
	}, []);

	if (toasts.length === 0) return null;

	return (
		<div className="toast-container">
			{toasts.map((toast) => (
				<div key={toast.id} className={`toast toast--${toast.type}`}>
					<span className="toast__message">{toast.message}</span>
					<button
						type="button"
						className="toast__close"
						onClick={() => NotificationService.instance().dismiss(toast.id)}
					>
						✕
					</button>
				</div>
			))}
		</div>
	);
}
