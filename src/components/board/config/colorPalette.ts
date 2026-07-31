import type { TLDefaultColorStyle } from 'tldraw';

/**
 * Interface representing a color palette option.
 */
export interface ColorOption {
	/** Unique color key identifier (e.g. 'yellow', 'blue') */
	key: TLDefaultColorStyle;
	/** Hex color code for preview dots and visual UI elements */
	hex: string;
}

/**
 * Standard color palette for sticky notes and board items.
 */
export const NOTE_COLOR_PALETTE: ColorOption[] = [
	{ key: 'yellow', hex: '#ffd700' },
	{ key: 'blue', hex: '#29b6f6' },
	{ key: 'green', hex: '#66bb6a' },
	{ key: 'orange', hex: '#ffa726' },
	{ key: 'red', hex: '#ef5350' },
	{ key: 'violet', hex: '#ab47bc' },
	{ key: 'grey', hex: '#78909c' },
];
