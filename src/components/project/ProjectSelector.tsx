import { CreateProjectModal } from '@components/project/CreateProjectModal';
import type { Project } from '@core/model/Project';
import type { KnownProjectEntry } from '@core/persistence/DesktopBridge';
import { DesktopBridge } from '@core/persistence/DesktopBridge';
import {
	faFolder,
	faFolderOpen,
	faMagnifyingGlass,
	faPlus,
	faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ProjectService } from '@services/ProjectService';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@components/project/ProjectSelector.scss';

/**
 * Props for ProjectSelector component.
 */
interface ProjectSelectorProps {
	/** Callback invoked when a project is selected or created */
	onSelectProject: (project: Project | KnownProjectEntry) => void;
}

/**
 * Helper function joining base parent directory and project name safely.
 * @param baseDir Parent folder path string.
 * @param name Project folder name string.
 * @returns Joined directory path string.
 */
export function ProjectSelector({ onSelectProject }: ProjectSelectorProps) {
	const { t } = useTranslation();
	const service = ProjectService.instance();
	const [projects, setProjects] = useState<KnownProjectEntry[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [showCreateModal, setShowCreateModal] = useState(false);

	/**
	 * Loads known projects from storage registry.
	 */
	const loadProjects = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await service.getProjects();
			setProjects(data);
		} catch (err) {
			console.error('[ProjectSelector] Failed to load projects:', err);
			setError(t('projectSelector.errorLoad'));
		} finally {
			setLoading(false);
		}
	}, [service, t]);

	useEffect(() => {
		void loadProjects();
	}, [loadProjects]);

	/**
	 * Opens existing project folder from desktop disk.
	 */
	const handleOpenFolder = async () => {
		const selectedFolder = await DesktopBridge.pickFolder();
		if (selectedFolder) {
			try {
				setLoading(true);
				const opened = await service.openExistingProjectFolder(selectedFolder);
				onSelectProject(opened);
			} catch (err) {
				console.error('[ProjectSelector] Failed to open folder:', err);
				alert(t('projectSelector.errorOpenFolder'));
			} finally {
				setLoading(false);
			}
		}
	};

	/**
	 * Handles project removal from history.
	 */
	const handleDeleteProject = async (
		e: React.MouseEvent | React.KeyboardEvent,
		project: KnownProjectEntry,
	) => {
		e.stopPropagation();
		if (
			window.confirm(t('projectSelector.deleteConfirm', { name: project.name }))
		) {
			try {
				await service.deleteProject(project.id);
				setProjects((prev) => prev.filter((p) => p.id !== project.id));
			} catch (err) {
				console.error('[ProjectSelector] Failed to delete project:', err);
				alert(t('projectSelector.errorDeleteProject'));
			}
		}
	};

	const filteredProjects = projects.filter(
		(p) =>
			p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			p.path.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<div className="project-selector">
			<header className="project-selector__header">
				<div>
					<div className="project-selector__brand">
						<h1>{t('projectSelector.title')}</h1>
					</div>
					<p className="project-selector__subtitle">
						{t('projectSelector.subtitle')}
					</p>
				</div>
			</header>

			<div className="project-selector__controls">
				<div className="project-selector__search">
					<FontAwesomeIcon icon={faMagnifyingGlass} />
					<input
						type="text"
						placeholder={t('projectSelector.searchPlaceholder')}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				<div className="project-selector__actions">
					<button
						type="button"
						className="project-selector__btn-open-folder"
						onClick={handleOpenFolder}
						title={t('projectSelector.openFolderTitle')}
					>
						<FontAwesomeIcon icon={faFolderOpen} />
						{t('projectSelector.openFolder')}
					</button>

					<button
						type="button"
						className="project-selector__btn-new"
						onClick={() => setShowCreateModal(true)}
					>
						<FontAwesomeIcon icon={faPlus} />
						{t('projectSelector.newProject')}
					</button>
				</div>
			</div>

			<main className="project-selector__content">
				{loading ? (
					<div className="project-selector__empty">
						<p>{t('projectSelector.loading')}</p>
					</div>
				) : error ? (
					<div className="project-selector__empty">
						<p style={{ color: '#f87171' }}>{error}</p>
						<button
							type="button"
							className="project-selector__btn-new"
							onClick={loadProjects}
							style={{ margin: '1rem auto 0' }}
						>
							{t('projectSelector.retry')}
						</button>
					</div>
				) : filteredProjects.length === 0 ? (
					<div className="project-selector__empty">
						<div className="empty-icon">
							<FontAwesomeIcon icon={faFolderOpen} size="2x" />
						</div>
						<h3>{t('projectSelector.emptyTitle')}</h3>
						<p>
							{searchQuery
								? t('projectSelector.emptySearchDesc')
								: t('projectSelector.emptyNoProjectsDesc')}
						</p>
						<div
							style={{
								display: 'flex',
								gap: '0.75rem',
								justifyContent: 'center',
							}}
						>
							<button
								type="button"
								className="project-selector__btn-open-folder"
								onClick={handleOpenFolder}
							>
								{t('projectSelector.openFolder')}
							</button>
							<button
								type="button"
								className="project-selector__btn-new"
								onClick={() => setShowCreateModal(true)}
							>
								{t('projectSelector.createFirstProject')}
							</button>
						</div>
					</div>
				) : (
					<div className="project-selector__grid">
						{filteredProjects.map((project) => (
							// biome-ignore lint/a11y/useSemanticElements: project list card
							<div
								key={project.id}
								className="project-selector__card"
								onClick={() => onSelectProject(project)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										onSelectProject(project);
									}
								}}
								role="button"
								tabIndex={0}
							>
								<div className="card-top">
									<div className="card-icon">
										<FontAwesomeIcon icon={faFolder} />
									</div>
									<div className="card-actions">
										{/* biome-ignore lint/a11y/noStaticElementInteractions: delete button */}
										{/* biome-ignore lint/a11y/useKeyWithClickEvents: delete button keyboard */}
										<span
											className="card-action-delete"
											title={t('projectSelector.deleteTitle')}
											onClick={(e) => handleDeleteProject(e, project)}
										>
											<FontAwesomeIcon icon={faXmark} />
										</span>
									</div>
								</div>

								<div className="card-info">
									<h3 className="card-title">{project.name}</h3>
									<p className="card-path" title={project.path}>
										{project.path}
									</p>
								</div>

								<div className="card-footer">
									<div className="card-stat">
										<span>
											{t('projectSelector.workspacesCount', {
												count: project.workspaceCount || 0,
											})}
										</span>
									</div>
									<span className="btn-open">{t('projectSelector.open')}</span>
								</div>
							</div>
						))}
					</div>
				)}
			</main>

			<CreateProjectModal
				isOpen={showCreateModal}
				onClose={() => setShowCreateModal(false)}
				onProjectCreated={(project) => onSelectProject(project)}
			/>
		</div>
	);
}
