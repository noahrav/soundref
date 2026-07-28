import {
	faArrowPointer,
	faChevronDown,
	faHand,
	faNoteSticky,
	faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createShapeId, track, useEditor } from 'tldraw';
import { toRichText } from '../utils/richText';
import './BoardToolbar.scss';

export const BoardToolbar = track(function BoardToolbar() {
	const { t } = useTranslation();
	const editor = useEditor();
	const currentTool = editor.getCurrentToolId();
	const [showAddMenu, setShowAddMenu] = useState(false);
	const addMenuRef = useRef<HTMLDivElement>(null);

	const handleAddStickyNote = useCallback(() => {
		const viewportBounds = editor.getViewportPageBounds();
		const center = viewportBounds.center;
		const newId = createShapeId();

		editor.createShape({
			id: newId,
			type: 'note',
			x: center.x - 100,
			y: center.y - 100,
			props: {
				color: 'yellow',
				richText: toRichText(''),
			},
		});

		editor.select(newId);
		editor.setEditingShape(newId);
		setShowAddMenu(false);
	}, [editor]);

	useEffect(() => {
		if (!showAddMenu) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (
				addMenuRef.current &&
				!addMenuRef.current.contains(e.target as Node)
			) {
				setShowAddMenu(false);
			}
		};
		document.addEventListener('pointerdown', handleClickOutside);
		return () =>
			document.removeEventListener('pointerdown', handleClickOutside);
	}, [showAddMenu]);

	return (
		<div className="board-toolbar">
			<button
				type="button"
				className={`board-toolbar__btn ${currentTool === 'select' ? 'board-toolbar__btn--active' : ''}`}
				onClick={() => {
					editor.setCurrentTool('select');
					setShowAddMenu(false);
				}}
				title={t('board.selectToolTitle')}
			>
				<FontAwesomeIcon icon={faArrowPointer} />
				<span>{t('board.selectTool')}</span>
			</button>

			<button
				type="button"
				className={`board-toolbar__btn ${currentTool === 'hand' ? 'board-toolbar__btn--active' : ''}`}
				onClick={() => {
					editor.setCurrentTool('hand');
					setShowAddMenu(false);
				}}
				title={t('board.handToolTitle')}
			>
				<FontAwesomeIcon icon={faHand} />
				<span>{t('board.handTool')}</span>
			</button>

			<div className="board-toolbar__divider" />

			<div className="board-toolbar__add-wrapper" ref={addMenuRef}>
				<button
					type="button"
					className={`board-toolbar__btn board-toolbar__btn--add ${showAddMenu ? 'board-toolbar__btn--active' : ''}`}
					onClick={() => setShowAddMenu((prev) => !prev)}
					title={t('board.addTitle')}
				>
					<FontAwesomeIcon icon={faPlus} />
					<span>{t('board.add')}</span>
					<FontAwesomeIcon
						icon={faChevronDown}
						style={{ fontSize: 10, marginLeft: 2 }}
					/>
				</button>

				{showAddMenu && (
					<div className="board-toolbar__dropdown">
						<button
							type="button"
							className="board-toolbar__dropdown-item"
							onClick={handleAddStickyNote}
						>
							<FontAwesomeIcon icon={faNoteSticky} />
							<span>{t('board.stickyNote')}</span>
						</button>
					</div>
				)}
			</div>
		</div>
	);
});
