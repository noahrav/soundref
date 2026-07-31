/**
 * Detects if current environment/OS is macOS.
 */
export const isMac =
	typeof navigator !== 'undefined' &&
	/Mac|iPod|iPhone|iPad/i.test(
		(navigator as any).userAgentData?.platform ||
			navigator.platform ||
			navigator.userAgent ||
			'',
	);

/**
 * Returns OS-adapted modifier key label: '⌘' on macOS, 'Ctrl+' on Windows/Linux.
 */
export const MODIFIER_KEY = isMac ? '⌘' : 'Ctrl+';

/**
 * Formats a shortcut representation string according to the user's OS.
 * E.g.
 * - '⌘X' -> '⌘X' on Mac, 'Ctrl+X' on Win/Linux
 * - '⌘C' -> '⌘C' on Mac, 'Ctrl+C' on Win/Linux
 * - '⌘V' -> '⌘V' on Mac, 'Ctrl+V' on Win/Linux
 * - '⌘D' -> '⌘D' on Mac, 'Ctrl+D' on Win/Linux
 * - '⌘G' -> '⌘G' on Mac, 'Ctrl+G' on Win/Linux
 * - '⇧⌘G' -> '⇧⌘G' on Mac, 'Ctrl+Shift+G' on Win/Linux
 * - '⌘A' -> '⌘A' on Mac, 'Ctrl+A' on Win/Linux
 * - 'Ctrl+Z' -> '⌘Z' on Mac, 'Ctrl+Z' on Win/Linux
 * - 'Ctrl+Y' -> '⌘Y' on Mac, 'Ctrl+Y' on Win/Linux
 */
export function formatShortcut(shortcut: string): string {
	if (!shortcut) return '';

	if (isMac) {
		return shortcut
			.replace(/Ctrl\+/gi, '⌘')
			.replace(/Shift\+/gi, '⇧');
	}

	let formatted = shortcut;
	// Replace ⇧⌘ or ⌘⇧ with Ctrl+Shift+
	formatted = formatted.replace(/(⇧⌘|⌘⇧)/g, 'Ctrl+Shift+');
	// Replace ⌘ with Ctrl+
	formatted = formatted.replace(/⌘/g, 'Ctrl+');
	// Replace ⇧ with Shift+
	formatted = formatted.replace(/⇧/g, 'Shift+');

	return formatted;
}
