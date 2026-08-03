import { TrackItem } from '@core/model/item/TrackItem';
import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { ProjectStorage } from '@core/persistence/ProjectStorage';
import { faCheck, faCog, faSync, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ProjectService } from '@services/ProjectService';
import {
	type AudioStorageMode,
	SettingsService,
} from '@services/SettingsService';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@components/board/components/SettingsModal.scss';
import '/node_modules/flag-icons/css/flag-icons.min.css';

/**
 * Available languages with their display metadata.
 */
const LANGUAGES = [
	{ code: 'fr', flag: 'fr', label: 'Français' },
	{ code: 'en', flag: 'gb', label: 'English' },
] as const;

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
	const { t, i18n } = useTranslation();
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
					let trackUpdated = false;

					if (targetMode === 'assets' && DesktopBridge.isTauri() && projectDir) {
						if (
							track.sourceType === 'local' &&
							track.audioSource &&
							!track.audioSource.includes('/assets/')
						) {
							const fileName =
								track.audioSource.split(/[/\\]/).pop() || `${track.id}.mp3`;
							const targetPath = `${assetsDir}/${fileName}`;
							const copied = await DesktopBridge.copyFile(
								track.audioSource,
								targetPath,
							);
							if (copied) {
								track.audioSource = `assets/${fileName}`;
								trackUpdated = true;
							}
						}

						if (
							track.imageUrl &&
							!track.imageUrl.startsWith('http://') &&
							!track.imageUrl.startsWith('https://') &&
							!track.imageUrl.startsWith('data:') &&
							!track.imageUrl.includes('/assets/')
						) {
							const fileName =
								track.imageUrl.split(/[/\\]/).pop() || `${track.id}_cover.png`;
							const targetPath = `${assetsDir}/${fileName}`;
							const copied = await DesktopBridge.copyFile(
								track.imageUrl,
								targetPath,
							);
							if (copied) {
								track.imageUrl = `assets/${fileName}`;
								trackUpdated = true;
							}
						}
					}

					if (trackUpdated) {
						count++;
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
							{t('board.changeLanguage')}
						</h3>
						<div className="settings-modal__language-list">
							{LANGUAGES.map((lang) => {
								const isActive = i18n.language === lang.code;
								return (
									<button
										key={lang.code}
										type="button"
										className={`settings-modal__language-option${isActive ? ' settings-modal__language-option--active' : ''}`}
										onClick={() => {
											if (lang.code !== i18n.language) {
												void i18n.changeLanguage(lang.code);
											}
										}}
									>
										<span className={`language-flag fi fi-${lang.flag}`}></span>
										<span className="language-name">{lang.label}</span>
										<span className="language-check">
											<FontAwesomeIcon icon={faCheck} />
										</span>
									</button>
								);
							})}
						</div>
					</div>

					<div className="settings-modal__divider" />

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
