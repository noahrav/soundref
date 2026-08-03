import { NOTE_COLOR_PALETTE } from '@components/board/config/colorPalette';
import type { TLSectionShape } from '@components/board/config/SectionShapeUtil';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { useEditor, useValue } from 'tldraw';
import '@components/board/config/SectionComponent.scss';

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
	const isEditingShape = useValue(
		'isEditingShape',
		() => editor.getEditingShapeId() === shape.id,
		[editor, shape.id],
	);
	const [localEditing, setLocalEditing] = useState(false);
	const isEditingTitle = isEditingShape || localEditing;
	const [titleInput, setTitleInput] = useState(shape.props.title || 'Section');
	const inputRef = useRef<HTMLInputElement>(null);
	const mountTimeRef = useRef<number>(0);

	useEffect(() => {
		setTitleInput(shape.props.title);
	}, [shape.props.title]);

	useLayoutEffect(() => {
		if (isEditingTitle) {
			mountTimeRef.current = Date.now();
			setTitleInput(shape.props.title);
			if (inputRef.current) {
				inputRef.current.focus();
			}
		}
	}, [isEditingTitle, shape.props.title]);

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
		if (Date.now() - mountTimeRef.current < 300) {
			if (inputRef.current) {
				inputRef.current.focus();
			}
			return;
		}
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
			e.preventDefault();
			editor.setEditingShape(shape.id);
			setLocalEditing(true);
		},
		[editor, shape.id],
	);

	const handleHeaderPointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			if (!editor.getSelectedShapeIds().includes(shape.id)) {
				editor.setSelectedShapes([shape.id]);
			}
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
					color: colorObj.hex,
				}}
				onPointerDown={handleHeaderPointerDown}
				onDoubleClick={startEditing}
			>
				{isEditingTitle ? (
					<input
						ref={inputRef}
						type="text"
						className="section-shape__title-input"
						style={{
							color: colorObj.hex,
						}}
						value={titleInput}
						onChange={handleTitleChange}
						onBlur={handleTitleBlur}
						onKeyDown={handleTitleKeyDown}
						onPointerDown={(e) => e.stopPropagation()}
						onClick={(e) => e.stopPropagation()}
						onDoubleClick={(e) => e.stopPropagation()}
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
