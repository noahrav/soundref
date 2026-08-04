import { ColorPicker } from '@components/board/components/ColorPicker';
import { compressImageToDataUrl } from '@components/board/utils/imageCompressor';
import { toRichText } from '@components/board/utils/richText';
import { getSectionBoundsForSelection } from '@components/board/utils/sectionUtils';
import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { getImageDimensions } from '@core/utils/mediaUtils';
import {
	faArrowPointer,
	faChevronDown,
	faFont,
	faHand,
	faImage,
	faLayerGroup,
	faMusic,
	faNoteSticky,
	faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ProjectService } from '@services/ProjectService';
import { SettingsService } from '@services/SettingsService';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	createShapeId,
	type TLDefaultColorStyle,
	track,
	useEditor,
} from 'tldraw';
import '@components/board/components/BoardToolbar.scss';

/**
 * Props for BoardToolbar component.
 */
interface BoardToolbarProps {
	/** Callback function triggered to open track creation modal */
	onOpenTrackModal?: (pos?: { x: number; y: number }) => void;
}

/**
 * Floating toolbar component for tool switching (select, hand) and item creation (Text, Sticky Note, Track, Section Box).
 */
export const BoardToolbar = track(function BoardToolbar({
	onOpenTrackModal,
}: BoardToolbarProps) {
	const { t } = useTranslation();
	const editor = useEditor();
	const currentTool = editor.getCurrentToolId();
	const [showAddMenu, setShowAddMenu] = useState(false);
	const addMenuRef = useRef<HTMLDivElement>(null);

	const selectedShapes = editor.getSelectedShapes();
	const colorableShapes = selectedShapes.filter(
		(s) => s.type === 'note' || s.type === 'section',
	);
	const activeColor =
		colorableShapes.length > 0
			? (colorableShapes[0].props as any)?.color
			: undefined;

	const handleColorChange = useCallback(
		(colorKey: TLDefaultColorStyle) => {
			colorableShapes.forEach((s) => {
				editor.updateShape({
					id: s.id,
					type: s.type,
					props: { color: colorKey },
				});
			});
		},
		[editor, colorableShapes],
	);

	/**
	 * Creates a new sticky note at the viewport center.
	 */
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

	/**
	 * Creates a new text block at the viewport center.
	 */
	const handleAddTextItem = useCallback(() => {
		const viewportBounds = editor.getViewportPageBounds();
		const center = viewportBounds.center;
		const newId = createShapeId();

		editor.createShape({
			id: newId,
			type: 'text',
			x: center.x - 100,
			y: center.y - 20,
			props: {
				richText: toRichText(''),
				autoSize: true,
			},
		});

		editor.select(newId);
		editor.setEditingShape(newId);
		setShowAddMenu(false);
	}, [editor]);

	/**
	 * Creates a new section box around selection or at viewport center.
	 */
	const handleAddSectionItem = useCallback(() => {
		const bounds = getSectionBoundsForSelection(editor);
		const newId = createShapeId();

		editor.createShape({
			id: newId,
			type: 'section',
			x: bounds.x,
			y: bounds.y,
			props: {
				title: 'Section',
				color: 'blue',
				w: bounds.w,
				h: bounds.h,
			},
		});

		editor.sendToBack([newId]);
		editor.select(newId);
		setShowAddMenu(false);
	}, [editor]);

	/**
	 * Opens track modal to create a new track shape.
	 */
	const handleAddTrackItem = useCallback(() => {
		const viewportBounds = editor.getViewportPageBounds();
		const center = viewportBounds.center;
		if (onOpenTrackModal) {
			onOpenTrackModal({ x: center.x - 100, y: center.y - 100 });
		}
		setShowAddMenu(false);
	}, [editor, onOpenTrackModal]);

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
							onClick={handleAddTextItem}
						>
							<FontAwesomeIcon icon={faFont} />
							<span>{t('board.textItem')}</span>
						</button>
						<button
							type="button"
							className="board-toolbar__dropdown-item"
							onClick={handleAddStickyNote}
						>
							<FontAwesomeIcon icon={faNoteSticky} />
							<span>{t('board.stickyNote')}</span>
						</button>
						<button
							type="button"
							className="board-toolbar__dropdown-item"
							onClick={handleAddSectionItem}
						>
							<FontAwesomeIcon icon={faLayerGroup} />
							<span>{t('board.groupItem')}</span>
						</button>
						<button
							type="button"
							className="board-toolbar__dropdown-item"
							onClick={handleAddTrackItem}
						>
							<FontAwesomeIcon icon={faMusic} />
							<span>{t('board.trackItem')}</span>
						</button>
						<button
							type="button"
							className="board-toolbar__dropdown-item"
							onClick={async () => {
								setShowAddMenu(false);
								const point = {
									x: editor.getViewportPageBounds().center.x - 150,
									y: editor.getViewportPageBounds().center.y - 150,
								};

								if (DesktopBridge.isTauri()) {
									const picked = await DesktopBridge.pickImageFile();
									if (picked) {
										const mode =
											SettingsService.instance().getAudioStorageMode();
										const activeProj =
											ProjectService.instance().getActiveProject();
										const fileName = picked.split(/[/\\]/).pop() || 'image.png';
										let finalUrl = picked;

										if (mode === 'assets' && activeProj?.path) {
											const assetsDir = `${activeProj.path.replace(/[/\\]+$/, '')}/assets`;
											const targetPath = `${assetsDir}/${fileName}`;
											await DesktopBridge.createDir(assetsDir);
											const copied = await DesktopBridge.copyFile(
												picked,
												targetPath,
											);
											if (copied) {
												finalUrl = `assets/${fileName}`;
											}
										}

										const dims = await getImageDimensions(finalUrl);
										const newId = createShapeId();
										editor.createShape({
											id: newId,
											type: 'image_item',
											x: point.x - dims.w / 2,
											y: point.y - dims.h / 2,
											props: {
												imageUrl: finalUrl,
												scale: 1,
												w: dims.w,
												h: dims.h,
											},
										});
										editor.sendToBack([newId]);
										const sectionIds = editor
											.getCurrentPageShapes()
											.filter((s) => s.type === 'section')
											.map((s) => s.id);
										if (sectionIds.length > 0) {
											editor.sendToBack(sectionIds);
										}
										editor.select(newId);
									}
								} else {
									const input = document.createElement('input');
									input.type = 'file';
									input.accept = 'image/*';
									input.onchange = (e: any) => {
										const file = e.target?.files?.[0];
										if (file) {
											const reader = new FileReader();
											reader.onload = async (evt) => {
												if (evt.target?.result) {
													const src = evt.target.result as string;
													const compressed = await compressImageToDataUrl(
														src,
														1920,
														1920,
														0.85,
													);
													const dims = await getImageDimensions(compressed);
													const newId = createShapeId();
													editor.createShape({
														id: newId,
														type: 'image_item',
														x: point.x - dims.w / 2,
														y: point.y - dims.h / 2,
														props: {
															imageUrl: compressed,
															scale: 1,
															w: dims.w,
															h: dims.h,
														},
													});
													editor.sendToBack([newId]);
													editor.select(newId);
												}
											};
											reader.readAsDataURL(file);
										}
									};
									input.click();
								}
							}}
						>
							<FontAwesomeIcon icon={faImage} />
							<span>{t('board.imageItem')}</span>
						</button>
					</div>
				)}
			</div>

			{colorableShapes.length > 0 && (
				<>
					<div className="board-toolbar__divider" />
					<ColorPicker
						selectedColor={activeColor}
						onSelectColor={handleColorChange}
						size={18}
					/>
				</>
			)}
		</div>
	);
});
