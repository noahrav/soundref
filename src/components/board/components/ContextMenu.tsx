import { NOTE_COLOR_PALETTE } from '@components/board/config/colorPalette';
import {
	fetchCoverArt,
	parseStreamUrl,
} from '@components/board/utils/embedUtils';
import { toRichText } from '@components/board/utils/richText';
import { getSectionBoundsForSelection } from '@components/board/utils/sectionUtils';
import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { getImageDimensions } from '@core/utils/mediaUtils';
import { formatShortcut } from '@core/utils/shortcutUtils';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import {
	faAngleDoubleDown,
	faAngleDoubleUp,
	faArrowDown,
	faArrowUp,
	faChevronRight,
	faFont,
	faImage,
	faLayerGroup,
	faMusic,
	faNoteSticky,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ProjectService } from '@services/ProjectService';
import { SettingsService } from '@services/SettingsService';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TLUiContextMenuProps } from 'tldraw';
import {
	createShapeId,
	track,
	useActions,
	useEditor,
	useEditorComponents,
} from 'tldraw';

/**
 * Screen position coordinates for contextual popup menu.
 */
interface MenuPosition {
	/** Screen X pixel coordinate */
	x: number;
	/** Screen Y pixel coordinate */
	y: number;
}

/**
 * Definition for sub-menu items within the context menu.
 */
interface SubmenuItemDef {
	/** Unique sub-item ID */
	id: string;
	/** Display label string */
	label: string;
	/** Optional FontAwesome icon definition */
	icon?: IconDefinition;
	/** Optional custom hex color dot string */
	colorDot?: string;
	/** Callback function on selection */
	onSelect: () => void;
}

/**
 * Definition for context menu items.
 */
interface MenuItemDef {
	/** Unique item ID */
	id: string;
	/** Display label string */
	label: string;
	/** Optional keyboard shortcut string representation */
	shortcut?: string;
	/** Danger styling flag */
	danger?: boolean;
	/** Disabled state flag */
	disabled?: boolean;
	/** Callback function on selection */
	onSelect: () => void;
	/** Optional array of sub-menu items */
	submenu?: SubmenuItemDef[];
}

/**
 * Group of context menu items separated by horizontal rules.
 */
interface MenuGroupDef {
	/** Unique group ID */
	id: string;
	/** Items contained in group */
	items: MenuItemDef[];
}

/**
 * Props for CustomContextMenu component.
 */
interface CustomContextMenuProps extends TLUiContextMenuProps {
	/** Callback function triggered to open track modal */
	onOpenTrackModal?: (pos?: { x: number; y: number }, editShape?: any) => void;
}

/**
 * Custom context menu component for tldraw canvas board.
 * Provides right-click operations, smart clipboard pasting, item creation, sticky note color editing, and track editing.
 */
export const CustomContextMenu = track(function CustomContextMenu({
	children,
	onOpenTrackModal,
}: CustomContextMenuProps) {
	const { t } = useTranslation();
	const editor = useEditor();
	const actions = useActions();
	const { Canvas } = useEditorComponents();
	const [menu, setMenu] = useState<MenuPosition | null>(null);

	const selectedIds = editor.getSelectedShapeIds();
	const hasSelection = selectedIds.length > 0;
	const selectedShapes = editor.getSelectedShapes();
	const singleSelectedShape =
		selectedShapes.length === 1 ? selectedShapes[0] : null;
	const hasColorableShapesSelected = selectedShapes.some(
		(s) => s.type === 'note' || s.type === 'section',
	);

	/**
	 * Smart paste handler reading clipboard text content.
	 * Automatically creates Track shapes for audio files or stream links, or Text shapes otherwise.
	 */
	const handlePasteContent = useCallback(async () => {
		if (!menu) return;
		try {
			const text = await navigator.clipboard.readText();
			if (!text) return;

			const point = editor.screenToPage({
				x: menu.x,
				y: menu.y,
			});

			const streamResult = parseStreamUrl(text);
			const cleanUrl = text.trim();
			const isAudioFile = /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(cleanUrl);
			const isImageFile =
				cleanUrl.startsWith('data:image/') ||
				/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(cleanUrl);

			if (isImageFile) {
				const mode = SettingsService.instance().getAudioStorageMode();
				const activeProj = ProjectService.instance().getActiveProject();
				let finalUrl = cleanUrl;

				if (
					mode === 'assets' &&
					activeProj?.path &&
					DesktopBridge.isTauri() &&
					!cleanUrl.startsWith('data:') &&
					!cleanUrl.startsWith('http://') &&
					!cleanUrl.startsWith('https://')
				) {
					const fileName = cleanUrl.split(/[/\\]/).pop() || 'image.png';
					const assetsDir = `${activeProj.path.replace(/[/\\]+$/, '')}/assets`;
					const targetPath = `${assetsDir}/${fileName}`;
					await DesktopBridge.createDir(assetsDir);
					const copied = await DesktopBridge.copyFile(cleanUrl, targetPath);
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
			} else if (streamResult || isAudioFile) {
				let title = 'Audio';
				let imageUrl = '';
				let audioSource = cleanUrl;
				let sourceType: 'local' | 'stream' = 'local';

				if (streamResult) {
					sourceType = 'stream';
					audioSource = text.trim();
					const serviceName = streamResult.service || 'Stream';
					title = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
					imageUrl = (await fetchCoverArt(audioSource)) || '';
				}

				const newId = createShapeId();
				editor.createShape({
					id: newId,
					type: 'track',
					x: point.x - 100,
					y: point.y - 100,
					props: {
						title,
						imageUrl,
						audioSource,
						sourceType,
						playMode: 'oneshot',
						loopRegion: { start: 0, end: 0 },
						w: 200,
						h: 200,
					},
				});
				editor.select(newId);
			} else {
				const newId = createShapeId();
				editor.createShape({
					id: newId,
					type: 'text',
					x: point.x - 100,
					y: point.y - 20,
					props: {
						richText: toRichText(text),
						autoSize: true,
					},
				});
				editor.select(newId);
			}
		} catch (err) {
			console.warn('[ContextMenu] Clipboard paste failed:', err);
		}
	}, [editor, menu]);

	const isTrackSelected = singleSelectedShape?.type === 'track';
	const isSectionSelected = singleSelectedShape?.type === 'section';

	const selectionGroups: MenuGroupDef[] = hasSelection
		? [
				...(isTrackSelected
					? [
							{
								id: 'track-edit',
								items: [
									{
										id: 'edit-track',
										label: t('contextMenu.editTrack'),
										onSelect: () => {
											if (onOpenTrackModal && singleSelectedShape) {
												onOpenTrackModal(
													{
														x: singleSelectedShape.x,
														y: singleSelectedShape.y,
													},
													singleSelectedShape,
												);
											}
										},
									},
								],
							},
						]
					: []),
				...(isSectionSelected
					? [
							{
								id: 'section-edit',
								items: [
									{
										id: 'rename-section',
										label: t('contextMenu.renameSection'),
										onSelect: () => {
											if (singleSelectedShape) {
												editor.setEditingShape(singleSelectedShape.id);
											}
										},
									},
								],
							},
						]
					: []),
				...(hasColorableShapesSelected
					? [
							{
								id: 'note-edit',
								items: [
									{
										id: 'change-note-color',
										label: t('contextMenu.noteColor'),
										onSelect: () => {},
										submenu: NOTE_COLOR_PALETTE.map((c) => ({
											id: `color-${c.key}`,
											label: t(`contextMenu.color_${c.key}`),
											colorDot: c.hex,
											onSelect: () => {
												const targets = editor
													.getSelectedShapes()
													.filter(
														(s) => s.type === 'note' || s.type === 'section',
													);
												targets.forEach((shape) => {
													editor.updateShape({
														id: shape.id,
														type: shape.type,
														props: { color: c.key },
													});
												});
											},
										})),
									},
								],
							},
						]
					: []),
				{
					id: 'clipboard',
					items: [
						{
							id: 'cut',
							label: t('contextMenu.cut'),
							shortcut: '⌘X',
							onSelect: () => actions.cut?.onSelect('context-menu'),
						},
						{
							id: 'copy',
							label: t('contextMenu.copy'),
							shortcut: '⌘C',
							onSelect: () => actions.copy?.onSelect('context-menu'),
						},
						{
							id: 'paste',
							label: t('contextMenu.paste'),
							shortcut: '⌘V',
							onSelect: handlePasteContent,
						},
						{
							id: 'duplicate',
							label: t('contextMenu.duplicate'),
							shortcut: '⌘D',
							onSelect: () => {
								editor.duplicateShapes(editor.getSelectedShapeIds());
							},
						},
					],
				},
				{
					id: 'organize',
					items: [
						{
							id: 'create-section',
							label: t('board.groupItem'),
							onSelect: () => {
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
							},
						},
						{
							id: 'group',
							label: t('contextMenu.group'),
							shortcut: '⌘G',
							onSelect: () => {
								editor.groupShapes(editor.getSelectedShapeIds());
							},
						},
						{
							id: 'ungroup',
							label: t('contextMenu.ungroup'),
							shortcut: '⇧⌘G',
							onSelect: () => {
								editor.ungroupShapes(editor.getSelectedShapeIds());
							},
						},
						{
							id: 'lock',
							label: t('contextMenu.lock'),
							onSelect: () => {
								editor.toggleLock(editor.getSelectedShapeIds());
							},
						},
						{
							id: 'reorder',
							label: t('contextMenu.reorder'),
							onSelect: () => {},
							submenu: [
								{
									id: 'bring-to-front',
									label: t('contextMenu.bringToFront'),
									icon: faAngleDoubleUp,
									onSelect: () => {
										editor.bringToFront(editor.getSelectedShapeIds());
										const sectionIds = editor
											.getCurrentPageShapes()
											.filter((s) => s.type === 'section')
											.map((s) => s.id);
										if (sectionIds.length > 0) {
											editor.sendToBack(sectionIds);
										}
									},
								},
								{
									id: 'bring-forward',
									label: t('contextMenu.bringForward'),
									icon: faArrowUp,
									onSelect: () => {
										editor.bringForward(editor.getSelectedShapeIds());
										const sectionIds = editor
											.getCurrentPageShapes()
											.filter((s) => s.type === 'section')
											.map((s) => s.id);
										if (sectionIds.length > 0) {
											editor.sendToBack(sectionIds);
										}
									},
								},
								{
									id: 'send-backward',
									label: t('contextMenu.sendBackward'),
									icon: faArrowDown,
									onSelect: () => {
										editor.sendBackward(editor.getSelectedShapeIds());
										const sectionIds = editor
											.getCurrentPageShapes()
											.filter((s) => s.type === 'section')
											.map((s) => s.id);
										if (sectionIds.length > 0) {
											editor.sendToBack(sectionIds);
										}
									},
								},
								{
									id: 'send-to-back',
									label: t('contextMenu.sendToBack'),
									icon: faAngleDoubleDown,
									onSelect: () => {
										editor.sendToBack(editor.getSelectedShapeIds());
										const sectionIds = editor
											.getCurrentPageShapes()
											.filter((s) => s.type === 'section')
											.map((s) => s.id);
										if (sectionIds.length > 0) {
											editor.sendToBack(sectionIds);
										}
									},
								},
							],
						},
					],
				},
				{
					id: 'danger',
					items: [
						{
							id: 'delete',
							label: t('contextMenu.delete'),
							shortcut: '⌫',
							danger: true,
							onSelect: () => {
								editor.deleteShapes(editor.getSelectedShapeIds());
							},
						},
					],
				},
			]
		: [
				{
					id: 'canvas',
					items: [
						{
							id: 'add',
							label: t('contextMenu.add'),
							onSelect: () => {},
							submenu: [
								{
									id: 'add-text-item',
									label: t('board.textItem'),
									icon: faFont,
									onSelect: () => {
										if (menu) {
											const point = editor.screenToPage({
												x: menu.x,
												y: menu.y,
											});
											const newId = createShapeId();
											editor.createShape({
												id: newId,
												type: 'text',
												x: point.x - 100,
												y: point.y - 20,
												props: {
													richText: toRichText(''),
													autoSize: true,
												},
											});
											editor.select(newId);
											editor.setEditingShape(newId);
										}
									},
								},
								{
									id: 'add-sticky-note',
									label: t('board.stickyNote'),
									icon: faNoteSticky,
									onSelect: () => {
										if (menu) {
											const point = editor.screenToPage({
												x: menu.x,
												y: menu.y,
											});
											const newId = createShapeId();
											editor.createShape({
												id: newId,
												type: 'note',
												x: point.x - 100,
												y: point.y - 100,
												props: {
													color: 'yellow',
													richText: toRichText(''),
												},
											});
											editor.select(newId);
											editor.setEditingShape(newId);
										}
									},
								},
								{
									id: 'add-section',
									label: t('board.groupItem'),
									icon: faLayerGroup,
									onSelect: () => {
										if (menu) {
											const point = editor.screenToPage({
												x: menu.x,
												y: menu.y,
											});
											const bounds = getSectionBoundsForSelection(
												editor,
												point,
											);
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
										}
									},
								},
								{
									id: 'add-track-item',
									label: t('board.trackItem'),
									icon: faMusic,
									onSelect: () => {
										if (menu && onOpenTrackModal) {
											const point = editor.screenToPage({
												x: menu.x,
												y: menu.y,
											});
											onOpenTrackModal({
												x: point.x - 100,
												y: point.y - 100,
											});
										}
									},
								},
								{
									id: 'add-image-item',
									label: t('board.imageItem'),
									icon: faImage,
									onSelect: async () => {
										if (menu) {
											const point = editor.screenToPage({
												x: menu.x,
												y: menu.y,
											});
											if (DesktopBridge.isTauri()) {
												const picked = await DesktopBridge.pickImageFile();
												if (picked) {
													const mode =
														SettingsService.instance().getAudioStorageMode();
													const activeProj =
														ProjectService.instance().getActiveProject();
													const fileName =
														picked.split(/[/\\]/).pop() || 'image.png';
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
																const dims = await getImageDimensions(src);
																const newId = createShapeId();
																editor.createShape({
																	id: newId,
																	type: 'image_item',
																	x: point.x - dims.w / 2,
																	y: point.y - dims.h / 2,
																	props: {
																		imageUrl: src,
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
										}
									},
								},
							],
						},
						{
							id: 'paste',
							label: t('contextMenu.paste'),
							shortcut: '⌘V',
							onSelect: handlePasteContent,
						},
						{
							id: 'select-all',
							label: t('contextMenu.selectAll'),
							shortcut: '⌘A',
							onSelect: () => {
								editor.selectAll();
							},
						},
					],
				},
			];

	const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

	const handlePointerDown = useCallback((e: React.PointerEvent) => {
		if (e.button === 2) {
			pointerDownRef.current = { x: e.clientX, y: e.clientY };
		}
	}, []);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (e.button === 2 && pointerDownRef.current) {
				const dist = Math.hypot(
					e.clientX - pointerDownRef.current.x,
					e.clientY - pointerDownRef.current.y,
				);
				pointerDownRef.current = null;

				if (dist < 6) {
					const target = e.target as HTMLElement;
					if (
						target.tagName === 'INPUT' ||
						target.tagName === 'TEXTAREA' ||
						target.isContentEditable
					) {
						return;
					}
					const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
					const shapeAtPoint = editor.getShapeAtPoint(point, {
						hitInside: true,
						margin: 0,
					});
					if (
						shapeAtPoint &&
						!editor.getSelectedShapeIds().includes(shapeAtPoint.id)
					) {
						editor.select(shapeAtPoint.id);
					}
					setMenu({ x: e.clientX, y: e.clientY });
				}
			}
		},
		[editor],
	);

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
	}, []);

	const closeMenu = useCallback(() => setMenu(null), []);

	const handleItemClick = useCallback(
		(item: MenuItemDef) => {
			if (item.disabled || item.submenu) return;
			item.onSelect();
			closeMenu();
		},
		[closeMenu],
	);

	useEffect(() => {
		if (!menu) return;
		const handleScroll = () => setMenu(null);
		window.addEventListener('wheel', handleScroll, { passive: true });
		return () => window.removeEventListener('wheel', handleScroll);
	}, [menu]);

	useEffect(() => {
		if (!menu) return;
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setMenu(null);
		};
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	}, [menu]);

	return (
		<section
			onContextMenu={handleContextMenu}
			onPointerDown={handlePointerDown}
			onPointerUp={handlePointerUp}
			aria-label="Board canvas"
			style={{ position: 'absolute', inset: 0 }}
		>
			{Canvas ? <Canvas /> : children}

			{menu && (
				<>
					<button
						type="button"
						aria-label="Close menu"
						className="context-menu__backdrop"
						onClick={closeMenu}
					/>

					<div className="context-menu" style={{ left: menu.x, top: menu.y }}>
						{selectionGroups.map((group) => (
							<div key={group.id} className="context-menu__group">
								{group.items.map((item) => (
									<div
										key={item.id}
										className={`context-menu__item-wrapper ${item.submenu ? 'context-menu__has-submenu' : ''}`}
									>
										<button
											type="button"
											className={[
												'context-menu__item',
												item.danger && 'context-menu__item--danger',
												item.disabled && 'context-menu__item--disabled',
											]
												.filter(Boolean)
												.join(' ')}
											onClick={() => handleItemClick(item)}
										>
											<span>{item.label}</span>
											{item.shortcut && (
												<span className="context-menu__shortcut">
													{formatShortcut(item.shortcut)}
												</span>
											)}
											{item.submenu && (
												<span className="context-menu__arrow">
													<FontAwesomeIcon icon={faChevronRight} />
												</span>
											)}
										</button>

										{item.submenu && (
											<div className="context-menu__submenu">
												{item.submenu.map((sub) => (
													<button
														type="button"
														key={sub.id}
														className="context-menu__item"
														onClick={() => {
															sub.onSelect();
															closeMenu();
														}}
													>
														{sub.colorDot ? (
															<span
																className="context-menu__color-dot"
																style={{
																	width: 12,
																	height: 12,
																	borderRadius: '50%',
																	backgroundColor: sub.colorDot,
																	border: '1px solid rgba(0, 0, 0, 0.25)',
																	display: 'inline-block',
																	flexShrink: 0,
																	marginRight: 8,
																}}
															/>
														) : sub.icon ? (
															<FontAwesomeIcon
																icon={sub.icon}
																style={{ width: 14 }}
															/>
														) : null}
														<span>{sub.label}</span>
													</button>
												))}
											</div>
										)}
									</div>
								))}
							</div>
						))}
					</div>
				</>
			)}
		</section>
	);
});
