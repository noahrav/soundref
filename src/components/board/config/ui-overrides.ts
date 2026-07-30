import type { TLUiOverrides } from 'tldraw';

/**
 * UI overrides object suppressing unused built-in tldraw tools to present a focused board interface.
 */
export const uiOverrides: TLUiOverrides = {
	/**
	 * Filters out unnecessary tools from the tldraw tool map.
	 * @param _editor tldraw Editor instance.
	 * @param tools Dictionary of available tools.
	 * @returns Filtered tools map.
	 */
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
