import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import {
	faChevronRight,
	faNoteSticky,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
import { toRichText } from '../utils/richText';

interface MenuPosition {
	x: number;
	y: number;
}

interface SubmenuItemDef {
	id: string;
	label: string;
	icon?: IconDefinition;
	onSelect: () => void;
}

interface MenuItemDef {
	id: string;
	label: string;
	shortcut?: string;
	danger?: boolean;
	disabled?: boolean;
	onSelect: () => void;
	submenu?: SubmenuItemDef[];
}

interface MenuGroupDef {
	id: string;
	items: MenuItemDef[];
}

export const CustomContextMenu = track(function CustomContextMenu({
	children,
}: TLUiContextMenuProps) {
	const { t } = useTranslation();
	const editor = useEditor();
	const actions = useActions();
	const { Canvas } = useEditorComponents();
	const [menu, setMenu] = useState<MenuPosition | null>(null);

	const selectedIds = editor.getSelectedShapeIds();
	const hasSelection = selectedIds.length > 0;

	const selectionGroups: MenuGroupDef[] = hasSelection
		? [
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
							onSelect: () => actions.paste?.onSelect('context-menu'),
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
							],
						},
						{
							id: 'paste',
							label: t('contextMenu.paste'),
							shortcut: '⌘V',
							onSelect: () => actions.paste?.onSelect('context-menu'),
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

	const handlePointerUp = useCallback((e: React.PointerEvent) => {
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
				setMenu({ x: e.clientX, y: e.clientY });
			}
		}
	}, []);

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
													{item.shortcut}
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
														{sub.icon && (
															<FontAwesomeIcon
																icon={sub.icon}
																style={{ width: 14 }}
															/>
														)}
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
