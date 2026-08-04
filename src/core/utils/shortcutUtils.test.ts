import { formatShortcut, isMac, MODIFIER_KEY } from '@core/utils/shortcutUtils';
import { describe, expect, it } from 'vitest';

describe('shortcutUtils', () => {
	describe('Environment detection', () => {
		it('isMac should be false in Node.js test environment', () => {
			expect(isMac).toBe(false);
		});

		it('MODIFIER_KEY should be "Ctrl+" in test environment', () => {
			expect(MODIFIER_KEY).toBe('Ctrl+');
		});
	});

	describe('formatShortcut (Windows/Linux)', () => {
		it('should return empty string for empty input', () => {
			expect(formatShortcut('')).toBe('');
		});

		it('should replace ⌘ with Ctrl+ (⌘Z -> Ctrl+Z)', () => {
			expect(formatShortcut('⌘Z')).toBe('Ctrl+Z');
		});

		it('should replace ⌘ with Ctrl+ (⌘C -> Ctrl+C)', () => {
			expect(formatShortcut('⌘C')).toBe('Ctrl+C');
		});

		it('should replace ⌘ with Ctrl+ (⌘V -> Ctrl+V)', () => {
			expect(formatShortcut('⌘V')).toBe('Ctrl+V');
		});

		it('should replace ⌘ with Ctrl+ (⌘X -> Ctrl+X)', () => {
			expect(formatShortcut('⌘X')).toBe('Ctrl+X');
		});

		it('should replace ⇧⌘ with Ctrl+Shift+', () => {
			expect(formatShortcut('⇧⌘G')).toBe('Ctrl+Shift+G');
		});

		it('should replace ⌘⇧ with Ctrl+Shift+', () => {
			expect(formatShortcut('⌘⇧G')).toBe('Ctrl+Shift+G');
		});

		it('should pass through Windows format (Ctrl+Z)', () => {
			expect(formatShortcut('Ctrl+Z')).toBe('Ctrl+Z');
		});

		it('should pass through Windows format (Ctrl+Shift+Z)', () => {
			expect(formatShortcut('Ctrl+Shift+Z')).toBe('Ctrl+Shift+Z');
		});

		it('should replace ⇧ with Shift+ when no cmd', () => {
			expect(formatShortcut('⇧A')).toBe('Shift+A');
		});

		it('should pass through text without symbols', () => {
			expect(formatShortcut('Enter')).toBe('Enter');
		});

		it('should replace ⌘ with Ctrl+ (⌘A -> Ctrl+A)', () => {
			expect(formatShortcut('⌘A')).toBe('Ctrl+A');
		});

		it('should replace ⌘ with Ctrl+ (⌘D -> Ctrl+D)', () => {
			expect(formatShortcut('⌘D')).toBe('Ctrl+D');
		});
	});
});
