import {
	faBars,
	faFolderOpen,
	faFolderTree,
	faPlus,
	faPowerOff,
	faRotateLeft,
	faRotateRight,
	faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageRecordType, type TLPageId, track, useEditor } from 'tldraw';
import { ProjectService } from '../../../api/ProjectService';
import { DesktopBridge } from '../../../core/persistence/DesktopBridge';
import { formatShortcut } from '../../../core/utils/shortcutUtils';

/**
 * Props for PageTabs component.
 */
interface PageTabsProps {
	/** Optional active project ID */
	projectId?: string;
	/** Callback function to return to project list screen */
	onBackToProjects?: () => void;
	/** Callback function to open project creation modal */
	onOpenCreateProjectModal?: () => void;
}

/**
 * Navigation bar component displaying workspace page tabs, creation button, inline renaming,
 * and a Project dropdown menu replacing the plain project button.
 */
export const PageTabs = track(function PageTabs({
	projectId,
	onBackToProjects,
	onOpenCreateProjectModal,
}: PageTabsProps) {
	const { t } = useTranslation();
	const editor = useEditor();
	const pages = editor.getPages();
	const currentPageId = editor.getCurrentPageId();
	const service = ProjectService.instance();

	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const [renamingId, setRenamingId] = useState<TLPageId | null>(null);
	const [renameValue, setRenameValue] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!isMenuOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsMenuOpen(false);
			}
		};
		window.addEventListener('mousedown', handleClickOutside);
		return () => window.removeEventListener('mousedown', handleClickOutside);
	}, [isMenuOpen]);

	/**
	 * Opens current project folder on disk in file explorer.
	 */
	const handleOpenProjectFolder = useCallback(() => {
		const activeProject = service.getActiveProject();
		if (activeProject?.path) {
			void DesktopBridge.openFolder(activeProject.path);
		}
	}, [service]);

	/**
	 * Quits the desktop application window.
	 */
	const handleExitApp = useCallback(() => {
		void DesktopBridge.exitApp();
	}, []);

	/**
	 * Adds a new workspace page tab to the tldraw editor and project service.
	 */
	const handleAddPage = useCallback(async () => {
		const name = t('board.defaultWorkspaceName', { number: pages.length + 1 });

		if (projectId) {
			try {
				const ws = await service.createWorkspace(projectId, name);
				const pageId = PageRecordType.createId(ws.id);
				editor.createPage({ id: pageId, name: ws.name });
				editor.setCurrentPage(pageId);
			} catch (err) {
				console.warn('[PageTabs] Could not create workspace:', err);
				editor.createPage({ name });
			}
		} else {
			editor.createPage({ name });
		}
	}, [editor, pages.length, projectId, service, t]);

	/**
	 * Triggers inline page tab renaming mode.
	 */
	const startRename = useCallback((pageId: TLPageId, currentName: string) => {
		setRenamingId(pageId);
		setRenameValue(currentName);
	}, []);

	/**
	 * Commits inline rename changes to the page record and project storage.
	 */
	const commitRename = useCallback(async () => {
		if (renamingId && renameValue.trim()) {
			const newName = renameValue.trim();
			editor.renamePage(renamingId, newName);

			if (projectId) {
				try {
					await service.updateWorkspace(projectId, renamingId, {
						name: newName,
					});
				} catch (err) {
					console.warn('[PageTabs] Could not rename workspace:', err);
				}
			}
		}
		setRenamingId(null);
	}, [editor, renamingId, renameValue, projectId, service]);

	/**
	 * Deletes a workspace page tab.
	 */
	const handleDeletePage = useCallback(
		async (e: React.MouseEvent | React.KeyboardEvent, pageId: TLPageId) => {
			e.stopPropagation();
			if (pages.length <= 1) return;
			editor.deletePage(pageId);

			if (projectId) {
				try {
					await service.deleteWorkspace(projectId, pageId);
				} catch (err) {
					console.warn('[PageTabs] Could not delete workspace:', err);
				}
			}
		},
		[editor, pages.length, projectId, service],
	);

	useEffect(() => {
		if (renamingId && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [renamingId]);

	return (
		<div className="page-tabs">
			<div className="page-tabs__menu-container" ref={menuRef}>
				<button
					type="button"
					className="page-tabs__menu-btn"
					onClick={() => setIsMenuOpen(!isMenuOpen)}
					title={t('board.backToProjectsTitle')}
					aria-label={t('board.backToProjectsTitle')}
				>
					<FontAwesomeIcon icon={faBars} />
				</button>

				{isMenuOpen && (
					<div className="page-tabs__menu-dropdown">
						<button
							type="button"
							className="page-tabs__menu-item"
							onClick={() => {
								setIsMenuOpen(false);
								onBackToProjects?.();
							}}
						>
							<span className="item-label">
								<FontAwesomeIcon icon={faFolderOpen} />
								<span>{t('board.chooseOtherProject')}</span>
							</span>
						</button>

						<button
							type="button"
							className="page-tabs__menu-item"
							onClick={() => {
								setIsMenuOpen(false);
								onOpenCreateProjectModal?.();
							}}
						>
							<span className="item-label">
								<FontAwesomeIcon icon={faPlus} />
								<span>{t('board.createNewProject')}</span>
							</span>
						</button>

						<div className="page-tabs__menu-divider" />

						<button
							type="button"
							className="page-tabs__menu-item"
							onClick={() => {
								setIsMenuOpen(false);
								void service.undo();
							}}
						>
							<span className="item-label">
								<FontAwesomeIcon icon={faRotateLeft} />
								<span>{t('board.undo')}</span>
							</span>
							<span className="item-shortcut">{formatShortcut('Ctrl+Z')}</span>
						</button>

						<button
							type="button"
							className="page-tabs__menu-item"
							onClick={() => {
								setIsMenuOpen(false);
								void service.redo();
							}}
						>
							<span className="item-label">
								<FontAwesomeIcon icon={faRotateRight} />
								<span>{t('board.redo')}</span>
							</span>
							<span className="item-shortcut">{formatShortcut('Ctrl+Y')}</span>
						</button>

						<div className="page-tabs__menu-divider" />

						<button
							type="button"
							className="page-tabs__menu-item"
							onClick={() => {
								setIsMenuOpen(false);
								handleOpenProjectFolder();
							}}
						>
							<span className="item-label">
								<FontAwesomeIcon icon={faFolderTree} />
								<span>{t('board.openProjectFolder')}</span>
							</span>
						</button>

						<div className="page-tabs__menu-divider" />

						<button
							type="button"
							className="page-tabs__menu-item page-tabs__menu-item--danger"
							onClick={() => {
								setIsMenuOpen(false);
								handleExitApp();
							}}
						>
							<span className="item-label">
								<FontAwesomeIcon icon={faPowerOff} />
								<span>{t('board.quitApp')}</span>
							</span>
						</button>
					</div>
				)}
			</div>

			<div className="page-tabs__tabs-list">
				{pages.map((page) => {
					const isActive = page.id === currentPageId;
					const isRenaming = renamingId === page.id;

					return (
						// biome-ignore lint/a11y/noStaticElementInteractions: workspace tab click
						// biome-ignore lint/a11y/useKeyWithClickEvents: workspace tab keyboard
						<div
							key={page.id}
							className={`page-tabs__tab${isActive ? ' page-tabs__tab--active' : ''}`}
							onClick={() => {
								if (!isRenaming) editor.setCurrentPage(page.id);
							}}
							onDoubleClick={(e) => {
								e.stopPropagation();
								startRename(page.id, page.name);
							}}
						>
							{isRenaming ? (
								<input
									ref={inputRef}
									className="page-tabs__rename-input"
									value={renameValue}
									onChange={(e) => setRenameValue(e.target.value)}
									onBlur={commitRename}
									onKeyDown={(e) => {
										if (e.key === 'Enter') commitRename();
										if (e.key === 'Escape') setRenamingId(null);
									}}
									onClick={(e) => e.stopPropagation()}
									onDoubleClick={(e) => e.stopPropagation()}
								/>
							) : (
								<span title="Double-cliquer pour renommer">{page.name}</span>
							)}

							{pages.length > 1 && (
								<button
									type="button"
									className="page-tabs__tab__close"
									onClick={(e) => handleDeletePage(e, page.id)}
									title={t('board.closePage', { name: page.name })}
								>
									<FontAwesomeIcon icon={faXmark} />
								</button>
							)}
						</div>
					);
				})}

				<button
					type="button"
					className="page-tabs__add"
					onClick={handleAddPage}
					aria-label={t('board.addPage')}
				>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</div>
	);
});
