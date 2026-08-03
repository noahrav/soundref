import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { formatShortcut } from '@core/utils/shortcutUtils';
import {
	faCog,
	faFolderOpen,
	faFolderTree,
	faPlus,
	faPowerOff,
	faRotateLeft,
	faRotateRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ProjectService } from '@services/ProjectService';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Props for PageTabsMenu component.
 */
interface PageTabsMenuProps {
	/** Callback to close the menu */
	onClose: () => void;
	/** Callback function to return to project list screen */
	onBackToProjects?: () => void;
	/** Callback function to open project creation modal */
	onOpenCreateProjectModal?: () => void;
	/** Callback function to open settings modal */
	onOpenSettingsModal?: () => void;
}

/**
 * Dropdown menu displayed from the hamburger button in the page tabs bar.
 * Contains project navigation, undo/redo, folder access, and quit actions.
 */
export function PageTabsMenu({
	onClose,
	onBackToProjects,
	onOpenCreateProjectModal,
	onOpenSettingsModal,
}: PageTabsMenuProps) {
	const { t } = useTranslation();
	const service = ProjectService.instance();

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

	return (
		<div className="page-tabs__menu-dropdown">
			<button
				type="button"
				className="page-tabs__menu-item"
				onClick={() => {
					onClose();
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
					onClose();
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
					onClose();
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
					onClose();
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
					onClose();
					onOpenSettingsModal?.();
				}}
			>
				<span className="item-label">
					<FontAwesomeIcon icon={faCog} />
					<span>{t('settings.title')}</span>
				</span>
			</button>

			<div className="page-tabs__menu-divider" />

			<button
				type="button"
				className="page-tabs__menu-item"
				onClick={() => {
					onClose();
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
					onClose();
					handleExitApp();
				}}
			>
				<span className="item-label">
					<FontAwesomeIcon icon={faPowerOff} />
					<span>{t('board.quitApp')}</span>
				</span>
			</button>
		</div>
	);
}
