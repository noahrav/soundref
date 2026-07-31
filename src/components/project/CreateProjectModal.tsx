import { faFolderOpen, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectService } from '../../api/ProjectService';
import type { Project } from '../../core/model/Project';
import { DesktopBridge } from '../../core/persistence/DesktopBridge';
import './CreateProjectModal.scss';

interface CreateProjectModalProps {
	isOpen: boolean;
	onClose: () => void;
	onProjectCreated: (project: Project) => void;
}

function combinePathAndName(baseDir: string, name: string): string {
	const cleanBase = baseDir.trim().replace(/[/\\]+$/, '');
	const cleanName = name.trim();
	if (!cleanBase) return cleanName ? `./${cleanName}` : './';
	if (!cleanName) return cleanBase;
	return `${cleanBase}/${cleanName}`;
}

export function CreateProjectModal({
	isOpen,
	onClose,
	onProjectCreated,
}: CreateProjectModalProps) {
	const { t } = useTranslation();
	const service = ProjectService.instance();

	const [newProjectName, setNewProjectName] = useState('');
	const [baseParentPath, setBaseParentPath] = useState('./');
	const [newProjectPath, setNewProjectPath] = useState('./');
	const [isCreating, setIsCreating] = useState(false);

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

	const handleCreateProject = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!newProjectName.trim()) return;

			try {
				setIsCreating(true);
				const project = await service.createProject(
					newProjectName.trim(),
					newProjectPath.trim(),
				);
				onProjectCreated(project);
				onClose();
				setNewProjectName('');
			} catch (err) {
				console.error('[CreateProjectModal] Error creating project:', err);
			} finally {
				setIsCreating(false);
			}
		},
		[newProjectName, newProjectPath, service, onProjectCreated, onClose],
	);

	if (!isOpen) return null;

	return (
		<div className="modal-overlay">
			<button
				type="button"
				className="modal-backdrop-btn"
				aria-label="Close"
				onClick={onClose}
			/>
			<div className="modal-card">
				<div className="modal-header">
					<h2>{t('projectSelector.modalTitle')}</h2>
					<button type="button" onClick={onClose}>
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
							onClick={onClose}
							disabled={isCreating}
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
	);
}
