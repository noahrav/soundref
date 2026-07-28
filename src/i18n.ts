import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../public/locales/en/translation.json';
import frTranslation from '../public/locales/fr/translation.json';

i18n.use(initReactI18next).init({
	resources: {
		fr: { translation: frTranslation },
		en: { translation: enTranslation },
	},
	lng: 'fr',
	fallbackLng: 'fr',
	interpolation: {
		escapeValue: false,
	},
	react: {
		useSuspense: false,
	},
});

export default i18n;
