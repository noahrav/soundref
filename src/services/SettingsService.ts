const SETTINGS_KEY = 'soundref_app_settings';

/**
 * Defines how imported local audio files are stored in the project.
 * - 'assets': Copies audio files to an assets/ subfolder within the project directory (Recommended).
 * - 'reference': Only the original file system path is stored as a reference link.
 */
export type AudioStorageMode = 'assets' | 'reference';

/**
 * Interface for all persisted application settings.
 */
export interface AppSettings {
	/** How local audio files are stored in the project */
	audioStorageMode: AudioStorageMode;
	/** Whether to automatically clear memory caches when switching projects */
	autoClearCacheOnProjectSwitch: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
	audioStorageMode: 'assets',
	autoClearCacheOnProjectSwitch: true,
};

/**
 * Singleton service managing application-wide settings with localStorage persistence.
 */
export class SettingsService {
	private static _instance: SettingsService;
	private settings: AppSettings;

	private constructor() {
		this.settings = this.loadSettings();
	}

	/**
	 * Gets the singleton instance of SettingsService.
	 * @returns SettingsService instance.
	 */
	public static instance(): SettingsService {
		if (!SettingsService._instance) {
			SettingsService._instance = new SettingsService();
		}
		return SettingsService._instance;
	}

	/**
	 * Loads settings from localStorage, merging with defaults for any missing keys.
	 * @returns Loaded AppSettings object.
	 */
	private loadSettings(): AppSettings {
		try {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				return { ...DEFAULT_SETTINGS, ...parsed };
			}
		} catch (e) {
			console.error('[SettingsService] Error loading settings:', e);
		}
		return { ...DEFAULT_SETTINGS };
	}

	/**
	 * Persists current settings to localStorage.
	 */
	private saveSettings(): void {
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
		} catch (e) {
			console.error('[SettingsService] Error saving settings:', e);
		}
	}

	/**
	 * Gets the current audio storage mode setting.
	 * @returns Current AudioStorageMode value.
	 */
	public getAudioStorageMode(): AudioStorageMode {
		return this.settings.audioStorageMode;
	}

	/**
	 * Sets the audio storage mode and persists it.
	 * @param mode New AudioStorageMode value.
	 */
	public setAudioStorageMode(mode: AudioStorageMode): void {
		this.settings.audioStorageMode = mode;
		this.saveSettings();
	}

	/**
	 * Gets whether to automatically clear memory cache on project switch.
	 * @returns boolean value.
	 */
	public getAutoClearCache(): boolean {
		return this.settings.autoClearCacheOnProjectSwitch ?? true;
	}

	/**
	 * Sets whether to automatically clear memory cache on project switch.
	 * @param enabled New boolean value.
	 */
	public setAutoClearCache(enabled: boolean): void {
		this.settings.autoClearCacheOnProjectSwitch = enabled;
		this.saveSettings();
	}

	/**
	 * Gets a copy of all current settings.
	 * @returns Copy of AppSettings.
	 */
	public getAll(): AppSettings {
		return { ...this.settings };
	}
}
