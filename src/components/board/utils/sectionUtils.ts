import type { Editor } from 'tldraw';

/**
 * Calculates section bounding geometry (x, y, w, h).
 * If shapes are selected, calculates a bounding rectangle around all selected shapes with padding.
 * Otherwise, falls back to centering around a given point or the current viewport center.
 *
 * @param editor tldraw Editor instance
 * @param fallbackPoint Optional page coordinates for fallback positioning
 * @returns Bounding box { x, y, w, h }
 */
export function getSectionBoundsForSelection(
	editor: Editor,
	fallbackPoint?: { x: number; y: number },
) {
	const selectedShapes = editor.getSelectedShapes();

	if (selectedShapes.length > 0) {
		const selectionBounds = editor.getSelectionPageBounds();
		if (selectionBounds) {
			return {
				x: selectionBounds.x - 20,
				y: selectionBounds.y - 40,
				w: Math.max(200, selectionBounds.w + 40),
				h: Math.max(150, selectionBounds.h + 60),
			};
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		selectedShapes.forEach((s) => {
			const bounds = editor.getShapePageBounds(s);
			if (bounds) {
				minX = Math.min(minX, bounds.minX);
				minY = Math.min(minY, bounds.minY);
				maxX = Math.max(maxX, bounds.maxX);
				maxY = Math.max(maxY, bounds.maxY);
			} else {
				const w = (s.props as any)?.w || 200;
				const h = (s.props as any)?.h || 100;
				minX = Math.min(minX, s.x);
				minY = Math.min(minY, s.y);
				maxX = Math.max(maxX, s.x + w);
				maxY = Math.max(maxY, s.y + h);
			}
		});

		if (minX !== Infinity && minY !== Infinity) {
			return {
				x: minX - 20,
				y: minY - 40,
				w: Math.max(200, maxX - minX + 40),
				h: Math.max(150, maxY - minY + 60),
			};
		}
	}

	if (fallbackPoint) {
		return {
			x: fallbackPoint.x - 200,
			y: fallbackPoint.y - 150,
			w: 400,
			h: 300,
		};
	}

	const viewportBounds = editor.getViewportPageBounds();
	const center = viewportBounds.center;
	return {
		x: center.x - 200,
		y: center.y - 150,
		w: 400,
		h: 300,
	};
}
