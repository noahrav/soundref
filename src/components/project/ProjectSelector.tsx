import {
	faFolder,
	faFolderOpen,
	faMagnifyingGlass,
	faPlus,
	faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectService } from '../../api/ProjectService';
import type { Project } from '../../core/model/Project';
import type { KnownProjectEntry } from '../../core/persistence/DesktopBridge';
import { DesktopBridge } from '../../core/persistence/DesktopBridge';
import './ProjectSelector.scss';

interface ProjectSelectorProps {
	onSelectProject: (project: Project | KnownProjectEntry) => void;
}

function combinePathAndName(baseDir: string, name: string): string {
	const cleanBase = baseDir.trim().replace(/[/\\]+$/, '');
	const cleanName = name.trim();
	if (!cleanBase) return cleanName ? `./${cleanName}` : './';
	if (!cleanName) return cleanBase;
	return `${cleanBase}/${cleanName}`;
}

export function ProjectSelector({ onSelectProject }: ProjectSelectorProps) {
	const { t } = useTranslation();
	const service = ProjectService.instance();
	const [projects, setProjects] = useState<KnownProjectEntry[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newProjectName, setNewProjectName] = useState('');
	const [baseParentPath, setBaseParentPath] = useState('./');
	const [newProjectPath, setNewProjectPath] = useState('./');
	const [isCreating, setIsCreating] = useState(false);

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

	const handleNameChange = (name: string) => {
		setNewProjectName(name);
		setNewProjectPath(combinePathAndName(baseParentPath, name));
	};

	const handlePathChange = (path: string) => {
		setNewProjectPath(path);
	};

	const handlePickFolder = async () => {
		const selectedFolder = await DesktopBridge.pickFolder();
		if (selectedFolder) {
			setBaseParentPath(selectedFolder);
			setNewProjectPath(combinePathAndName(selectedFolder, newProjectName));
		}
	};

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

	const handleCreateProject = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newProjectName.trim()) return;

		const finalPath =
			newProjectPath.trim() ||
			combinePathAndName(baseParentPath, newProjectName);

		try {
			setIsCreating(true);
			const created = await service.createProject(
				newProjectName.trim(),
				finalPath,
			);
			setShowCreateModal(false);
			setNewProjectName('');
			setBaseParentPath('./');
			setNewProjectPath('./');
			onSelectProject(created);
		} catch (err) {
			console.error('[ProjectSelector] Failed to create project:', err);
			alert(t('projectSelector.errorCreateProject'));
		} finally {
			setIsCreating(false);
		}
	};

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
						onClick={() => {
							setShowCreateModal(true);
							setNewProjectPath(
								combinePathAndName(baseParentPath, newProjectName),
							);
						}}
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
								onClick={() => {
									setShowCreateModal(true);
									setNewProjectPath(
										combinePathAndName(baseParentPath, newProjectName),
									);
								}}
							>
								{t('projectSelector.createFirstProject')}
							</button>
						</div>
					</div>
				) : (
					<div className="project-selector__grid">
						{filteredProjects.map((project) => (
							// biome-ignore lint/a11y/noStaticElementInteractions: card selection container
							// biome-ignore lint/a11y/useKeyWithClickEvents: card selection keyboard
							<div
								key={project.id}
								className="project-selector__card"
								onClick={() => onSelectProject(project)}
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

			{showCreateModal && (
				<div className="modal-overlay">
					<button
						type="button"
						className="modal-backdrop-btn"
						aria-label="Close"
						onClick={() => setShowCreateModal(false)}
					/>
					<div className="modal-card">
						<div className="modal-header">
							<h2>{t('projectSelector.modalTitle')}</h2>
							<button type="button" onClick={() => setShowCreateModal(false)}>
								<FontAwesomeIcon icon={faXmark} />
							</button>
						</div>
						<form onSubmit={handleCreateProject}>
							<div className="form-group">
								<label htmlFor="projectName">
									{t('projectSelector.projectNameLabel')}
								</label>
								<input
									id="projectName"
									type="text"
									placeholder={t('projectSelector.projectNamePlaceholder')}
									value={newProjectName}
									onChange={(e) => handleNameChange(e.target.value)}
									required
								/>
							</div>
							<div className="form-group">
								<label htmlFor="projectPath">
									{t('projectSelector.projectPathLabel')}
								</label>
								<div className="path-input-group">
									<input
										id="projectPath"
										type="text"
										placeholder={t('projectSelector.projectPathPlaceholder')}
										value={newProjectPath}
										onChange={(e) => handlePathChange(e.target.value)}
										required
									/>
									<button
										type="button"
										className="btn-browse"
										onClick={handlePickFolder}
										title={t('projectSelector.browseTitle')}
									>
										<FontAwesomeIcon icon={faFolderOpen} />{' '}
										{t('projectSelector.browse')}
									</button>
								</div>
								<p
									style={{
										fontSize: '0.75rem',
										color: '#999',
										marginTop: '0.4rem',
									}}
								>
									{t('projectSelector.pathHelp')}
								</p>
							</div>
							<div className="modal-actions">
								<button
									type="button"
									className="btn-cancel"
									onClick={() => setShowCreateModal(false)}
								>
									{t('projectSelector.cancel')}
								</button>
								<button
									type="submit"
									className="btn-submit"
									disabled={isCreating || !newProjectName.trim()}
								>
									{isCreating
										? t('projectSelector.creating')
										: t('projectSelector.create')}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
