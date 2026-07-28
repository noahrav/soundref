import type { TLUiOverrides } from 'tldraw';

export const uiOverrides: TLUiOverrides = {
	tools(_editor, tools) {
		const toolsToRemove = [
			'draw',
			'eraser',
			'laser',
			'highlight',
			'line',
			'arrow',
			'text',
			'frame',
			'geo',
			'asset',
			'embed',
		];

		for (const tool of toolsToRemove) {
			if (tool in tools) {
				delete tools[tool];
			}
		}

		return tools;
	},
};
