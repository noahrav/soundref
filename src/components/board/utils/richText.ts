export function toRichText(text: string) {
	const lines = text.split('\n');
	const content = lines.map((line) => {
		if (!line) {
			return { type: 'paragraph' };
		}
		return {
			type: 'paragraph',
			content: [{ type: 'text', text: line }],
		};
	});
	return {
		type: 'doc',
		content,
	};
}

export function fromRichText(richText: any): string {
	if (!richText) return '';
	if (typeof richText === 'string') return richText;
	if (!richText.content || !Array.isArray(richText.content)) return '';
	return richText.content
		.map((p: any) => {
			if (!p) return '';
			if (typeof p === 'string') return p;
			if (!p.content || !Array.isArray(p.content)) return '';
			return p.content
				.map((c: any) => {
					if (typeof c === 'string') return c;
					return c?.text || '';
				})
				.join('');
		})
		.join('\n');
}
