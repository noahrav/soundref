import { useEditor, useValue } from 'tldraw';

export function DotGrid() {
	const editor = useEditor();
	const camera = useValue('camera', () => editor.getCamera(), [editor]);
	const gridSize = useValue(
		'gridSize',
		() => editor.getDocumentSettings().gridSize,
		[editor],
	);

	const { x, y, z } = camera;
	const BASE_GAP = (gridSize || 10) * 2;

	// Dynamically scale step so screenGap stays between 16px and 64px
	let stepGap = BASE_GAP;
	if (z > 0) {
		while (stepGap * z < 16) {
			stepGap *= 2;
		}
		while (stepGap * z > 64) {
			stepGap /= 2;
		}
	}

	const screenGap = stepGap * z;
	const translateX = x * z;
	const translateY = y * z;

	return (
		<div
			className="tl-grid dot-grid"
			style={{
				position: 'absolute',
				inset: 0,
				pointerEvents: 'none',
				zIndex: 0,
				backgroundImage:
					'radial-gradient(circle, var(--tl-color-grid, #94a3b8) 1.25px, transparent 1.25px)',
				backgroundSize: `${screenGap}px ${screenGap}px`,
				backgroundPosition: `${translateX}px ${translateY}px`,
				opacity: 0.5,
				willChange: 'background-position, background-size',
			}}
		/>
	);
}
