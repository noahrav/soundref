import { fromRichText, toRichText } from '@components/board/utils/richText';
import { describe, expect, it } from 'vitest';

describe('toRichText', () => {
	it('should convert single line text to AST with one paragraph', () => {
		const result = toRichText('Hello');
		expect(result).toEqual({
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Hello' }],
				},
			],
		});
	});

	it('should convert multi-line text to AST with multiple paragraphs', () => {
		const result = toRichText('Hello\nWorld');
		expect(result).toEqual({
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Hello' }],
				},
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'World' }],
				},
			],
		});
	});

	it('should convert empty string to AST with empty paragraph', () => {
		const result = toRichText('');
		expect(result).toEqual({
			type: 'doc',
			content: [
				{
					type: 'paragraph',
				},
			],
		});
	});

	it('should handle empty line in the middle', () => {
		const result = toRichText('Hello\n\nWorld');
		expect(result).toEqual({
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Hello' }],
				},
				{
					type: 'paragraph',
				},
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'World' }],
				},
			],
		});
	});

	it('should preserve special characters (accents, &, <)', () => {
		const result = toRichText('Élève & <test>');
		expect(result).toEqual({
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Élève & <test>' }],
				},
			],
		});
	});
});

describe('fromRichText', () => {
	it('should extract text from simple AST doc', () => {
		const ast = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Hello' }],
				},
			],
		};
		expect(fromRichText(ast)).toBe('Hello');
	});

	it('should join paragraphs with newline', () => {
		const ast = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Hello' }],
				},
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'World' }],
				},
			],
		};
		expect(fromRichText(ast)).toBe('Hello\nWorld');
	});

	it('should return empty string for null/undefined input', () => {
		expect(fromRichText(null)).toBe('');
		expect(fromRichText(undefined)).toBe('');
	});

	it('should return string input as-is', () => {
		expect(fromRichText('Direct string')).toBe('Direct string');
	});

	it('should return empty line for paragraph without content', () => {
		const ast = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Hello' }],
				},
				{
					type: 'paragraph',
				},
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'World' }],
				},
			],
		};
		expect(fromRichText(ast)).toBe('Hello\n\nWorld');
	});

	it('should return empty string for empty content array', () => {
		expect(fromRichText({ type: 'doc', content: [] })).toBe('');
	});

	it('should handle null paragraph in content', () => {
		const ast = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Hello' }],
				},
				null,
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'World' }],
				},
			],
		};
		expect(fromRichText(ast)).toBe('Hello\n\nWorld');
	});

	it('should handle string content node instead of object', () => {
		const ast = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: ['Hello'],
				},
			],
		};
		expect(fromRichText(ast)).toBe('Hello');
	});
});

describe('Round-trip', () => {
	it('should round-trip simple text', () => {
		const text = 'Hello';
		expect(fromRichText(toRichText(text))).toBe(text);
	});

	it('should round-trip multi-line text', () => {
		const text = 'Hello\nWorld\n\nTest';
		expect(fromRichText(toRichText(text))).toBe(text);
	});

	it('should round-trip empty text', () => {
		expect(fromRichText(toRichText(''))).toBe('');
	});

	it('should round-trip text with special characters', () => {
		const text = 'Élève & <test>\nÀ bientôt !';
		expect(fromRichText(toRichText(text))).toBe(text);
	});
});
