import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import '@components/board/components/ChangeLanguageModal.scss';
import '/node_modules/flag-icons/css/flag-icons.min.css';

/**
 * Available languages with their display metadata.
 */
const LANGUAGES = [
	{ code: 'fr', flag: 'fr', label: 'Français' },
	{ code: 'en', flag: 'gb', label: 'English' },
] as const;

interface ChangeLanguageModalProps {
	isOpen: boolean;
	onClose: () => void;
}

/**
 * Modal allowing the user to switch the application language.
 * Displays available languages as selectable buttons with the current one highlighted.
 */
export function ChangeLanguageModal({
	isOpen,
	onClose,
}: ChangeLanguageModalProps) {
	const { t, i18n } = useTranslation();

	const handleSelect = (langCode: string) => {
		if (langCode !== i18n.language) {
			void i18n.changeLanguage(langCode);
		}
		onClose();
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
			<div className="modal-card change-language-modal">
				<div className="modal-header">
					<h2>{t('board.changeLanguage')}</h2>
					<button type="button" onClick={onClose}>
						<FontAwesomeIcon icon={faXmark} />
					</button>
				</div>
				<div className="language-list">
					{LANGUAGES.map((lang) => {
						const isActive = i18n.language === lang.code;
						return (
							<button
								key={lang.code}
								type="button"
								className={`language-option${isActive ? ' language-option--active' : ''}`}
								onClick={() => handleSelect(lang.code)}
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
		</div>
	);
}
