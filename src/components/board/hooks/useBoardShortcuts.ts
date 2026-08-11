import { ProjectService } from '@services/ProjectService';
import { useEffect } from 'react';
import type { Editor } from 'tldraw';

/**
 * Custom hook registering global undo/redo keyboard shortcuts (Ctrl+Z / Ctrl+Y / Cmd+Shift+Z).
 * Skips execution when focused inside input, textarea, or contentEditable elements.
 * @param editorRef Ref to tldraw Editor instance.
 */
export function useBoardShortcuts(
	editorRef: React.RefObject<Editor | null>,
): void {
	const service = ProjectService.instance();

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === 'INPUT' ||
					target.tagName === 'TEXTAREA' ||
					target.isContentEditable)
			) {
				return;
			}

			if (editorRef.current && editorRef.current.getEditingShapeId() !== null) {
				return;
			}

			const isCtrlOrCmd = e.ctrlKey || e.metaKey;
			const key = e.key.toLowerCase();

			if (isCtrlOrCmd && key === 'z' && !e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				service.undo();
			} else if (isCtrlOrCmd && (key === 'y' || (key === 'z' && e.shiftKey))) {
				e.preventDefault();
				e.stopPropagation();
				service.redo();
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [editorRef, service]);
}
