import { TrackItem } from '@core/model/item/TrackItem';
import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { ProjectStorage } from '@core/persistence/ProjectStorage';
import { faCog, faSync, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ProjectService } from '@services/ProjectService';
import {
	type AudioStorageMode,
	SettingsService,
} from '@services/SettingsService';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@components/board/components/SettingsModal.scss';

interface SettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

/**
 * Modal component for managing application settings.
 * Controls audio storage mode (assets folder vs embedded base64 vs reference link)
 * and allows converting existing project tracks to the selected mode.
 */
export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
	const { t } = useTranslation();
	const [audioStorageMode, setAudioStorageMode] = useState<AudioStorageMode>(
		() => SettingsService.instance().getAudioStorageMode(),
	);
	const [isConverting, setIsConverting] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const handleModeChange = (mode: AudioStorageMode) => {
		setAudioStorageMode(mode);
		SettingsService.instance().setAudioStorageMode(mode);
		setStatusMessage(null);
	};

	const handleConvertExistingTracks = async () => {
		const activeProject = ProjectService.instance().getActiveProject();
		if (!activeProject) return;

		setIsConverting(true);
		setStatusMessage(null);

		let count = 0;
		const targetMode = SettingsService.instance().getAudioStorageMode();
		const projectDir = activeProject.path.replace(/[/\\]+$/, '');
		const assetsDir = `${projectDir}/assets`;

		if (targetMode === 'assets' && DesktopBridge.isTauri()) {
			await DesktopBridge.createDir(assetsDir);
		}

		for (const ws of activeProject.workspaces.values()) {
			for (const item of ws.items.values()) {
				if (item instanceof TrackItem || (item as any).type === 'TrackItem') {
					const track = item as TrackItem;
					if (track.sourceType !== 'local') {
						continue;
					}

					if (targetMode === 'assets') {
						if (track.audioSource && DesktopBridge.isTauri() && projectDir) {
							if (!track.audioSource.includes('/assets/')) {
								const fileName =
									track.audioSource.split(/[/\\]/).pop() || `${track.id}.mp3`;
								const targetPath = `${assetsDir}/${fileName}`;
								const copied = await DesktopBridge.copyFile(
									track.audioSource,
									targetPath,
								);
								if (copied) {
									track.audioSource = targetPath;
									count++;
								}
							}
						}
					}
				}
			}
		}

		await ProjectStorage.saveProjectData(activeProject);
		setIsConverting(false);
		setStatusMessage(t('settings.convertSuccess', { count }));
	};

	if (!isOpen) return null;

	return (
		<div className="modal-overlay">
			<button
				type="button"
				className="modal-backdrop-btn"
				aria-label="Close"
				onClick={onClose}
			/>
			<div className="modal-card settings-modal">
				<div className="modal-header">
					<h2>
						<FontAwesomeIcon icon={faCog} />
						<span>{t('settings.title')}</span>
					</h2>
					<button type="button" onClick={onClose}>
						<FontAwesomeIcon icon={faXmark} />
					</button>
				</div>
				<div className="settings-modal__content">
					<div className="settings-modal__section">
						<h3 className="settings-modal__section-title">
							{t('settings.audioStorageTitle')}
						</h3>
						<p className="settings-modal__section-desc">
							{t('settings.audioStorageDesc')}
						</p>

						<div className="settings-modal__options">
							<button
								type="button"
								className={`settings-modal__option${audioStorageMode === 'assets' ? ' settings-modal__option--active' : ''}`}
								onClick={() => handleModeChange('assets')}
							>
								<span className="settings-modal__option-title">
									{t('settings.assetsTitle')}
								</span>
								<span className="settings-modal__option-desc">
									{t('settings.assetsDesc')}
								</span>
							</button>

							<button
								type="button"
								className={`settings-modal__option${audioStorageMode === 'reference' ? ' settings-modal__option--active' : ''}`}
								onClick={() => handleModeChange('reference')}
							>
								<span className="settings-modal__option-title">
									{t('settings.referenceTitle')}
								</span>
								<span className="settings-modal__option-desc">
									{t('settings.referenceDesc')}
								</span>
							</button>
						</div>

						<div className="settings-modal__convert-box">
							<button
								type="button"
								className="settings-modal__convert-btn"
								disabled={isConverting}
								onClick={handleConvertExistingTracks}
							>
								<FontAwesomeIcon icon={faSync} spin={isConverting} />
								<span>
									{isConverting
										? t('settings.converting')
										: t('settings.convertBtn')}
								</span>
							</button>
							{statusMessage && (
								<p className="settings-modal__status-msg">{statusMessage}</p>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
