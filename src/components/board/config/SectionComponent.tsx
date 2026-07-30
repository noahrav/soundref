import { useCallback, useEffect, useState } from 'react';
import { useEditor } from 'tldraw';
import { NOTE_COLOR_PALETTE } from './colorPalette';
import type { TLSectionShape } from './SectionShapeUtil';
import './SectionComponent.scss';

/**
 * Props for SectionComponent.
 */
interface SectionComponentProps {
	/** tldraw shape instance for section */
	shape: TLSectionShape;
}

/**
 * React component rendering a section container box with editable header title
 * and custom color palette styling.
 */
export function SectionComponent({ shape }: SectionComponentProps) {
	const editor = useEditor();
	const isEditingShape = editor.getEditingShapeId() === shape.id;
	const [localEditing, setLocalEditing] = useState(false);
	const isEditingTitle = isEditingShape || localEditing;
	const [titleInput, setTitleInput] = useState(shape.props.title || 'Section');

	useEffect(() => {
		setTitleInput(shape.props.title || 'Section');
	}, [shape.props.title]);

	const colorObj =
		NOTE_COLOR_PALETTE.find((c) => c.key === shape.props.color) ||
		NOTE_COLOR_PALETTE[1];

	const handleTitleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const val = e.target.value;
			setTitleInput(val);
			editor.updateShape({
				id: shape.id,
				type: 'section',
				props: { title: val },
			});
		},
		[editor, shape.id],
	);

	const handleTitleBlur = useCallback(() => {
		setLocalEditing(false);
		if (editor.getEditingShapeId() === shape.id) {
			editor.setEditingShape(null);
		}
		const finalTitle = titleInput.trim() || 'Section';
		if (finalTitle !== shape.props.title) {
			editor.updateShape({
				id: shape.id,
				type: 'section',
				props: { title: finalTitle },
			});
		}
	}, [editor, shape.id, shape.props.title, titleInput]);

	const handleTitleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			e.stopPropagation();
			if (e.key === 'Enter') {
				e.preventDefault();
				handleTitleBlur();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				setLocalEditing(false);
				if (editor.getEditingShapeId() === shape.id) {
					editor.setEditingShape(null);
				}
			}
		},
		[editor, handleTitleBlur, shape.id],
	);

	const startEditing = useCallback(
		(e: React.SyntheticEvent) => {
			e.stopPropagation();
			editor.setEditingShape(shape.id);
			setLocalEditing(true);
		},
		[editor, shape.id],
	);

	return (
		<div
			className="section-shape"
			style={{
				width: shape.props.w,
				height: shape.props.h,
			}}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: double click edit section title */}
			<div
				className="section-shape__outline"
				style={{
					borderColor: colorObj.hex,
					backgroundColor: `${colorObj.hex}1a`,
				}}
				onDoubleClick={startEditing}
			/>

			{/* biome-ignore lint/a11y/noStaticElementInteractions: double click edit title */}
			<div
				className="section-shape__header"
				style={{
					backgroundColor: colorObj.hex,
					color: shape.props.color === 'yellow' ? '#111111' : '#ffffff',
				}}
				onDoubleClick={startEditing}
			>
				{isEditingTitle ? (
					<input
						type="text"
						className="section-shape__title-input"
						style={{
							color: shape.props.color === 'yellow' ? '#111111' : '#ffffff',
						}}
						value={titleInput}
						onChange={handleTitleChange}
						onBlur={handleTitleBlur}
						onKeyDown={handleTitleKeyDown}
						onPointerDown={(e) => e.stopPropagation()}
						onClick={(e) => e.stopPropagation()}
						// biome-ignore lint/a11y/noAutofocus: edit focus
						autoFocus
					/>
				) : (
					// biome-ignore lint/a11y/noStaticElementInteractions: double click edit title
					<span
						className="section-shape__title"
						onDoubleClick={startEditing}
						title="Double-cliquer pour modifier le titre"
					>
						{shape.props.title || 'Section'}
					</span>
				)}
			</div>
		</div>
	);
}
