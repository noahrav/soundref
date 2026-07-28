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
	const dotRadius = 1.25;

	return (
		<svg
			aria-label="Canvas grid"
			className="tl-grid dot-grid"
			width="100%"
			height="100%"
			style={{
				position: 'absolute',
				inset: 0,
				pointerEvents: 'none',
				zIndex: 0,
			}}
		>
			<defs>
				<pattern
					id="dot-grid-pattern"
					width={screenGap}
					height={screenGap}
					patternUnits="userSpaceOnUse"
					patternTransform={`translate(${translateX}, ${translateY})`}
				>
					<circle
						cx={screenGap / 2}
						cy={screenGap / 2}
						r={dotRadius}
						fill="var(--tl-color-grid, #94a3b8)"
						opacity={0.5}
					/>
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill="url(#dot-grid-pattern)" />
		</svg>
	);
}
