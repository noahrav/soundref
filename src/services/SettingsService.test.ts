import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from './SettingsService';

describe('SettingsService', () => {
	const SETTINGS_KEY = 'soundref_app_settings';

	beforeEach(() => {
		localStorage.clear();
		(SettingsService as unknown as { _instance: undefined })._instance =
			undefined;
	});

	it('should return default settings when localStorage is empty', () => {
		const service = SettingsService.instance();
		expect(service.getAll()).toEqual({ audioStorageMode: 'assets' });
	});

	it('should return audioStorageMode "assets" by default', () => {
		const service = SettingsService.instance();
		expect(service.getAudioStorageMode()).toBe('assets');
	});

	it('should allow setting audioStorageMode to "reference" and persist to localStorage', () => {
		const service = SettingsService.instance();
		service.setAudioStorageMode('reference');

		expect(service.getAudioStorageMode()).toBe('reference');
		const stored = localStorage.getItem(SETTINGS_KEY);
		expect(stored).toBeTruthy();
		expect(JSON.parse(stored || '{}')).toEqual({
			audioStorageMode: 'reference',
		});
	});

	it('should load persisted settings from localStorage on instance creation', () => {
		localStorage.setItem(
			SETTINGS_KEY,
			JSON.stringify({ audioStorageMode: 'reference' }),
		);
		const service = SettingsService.instance();
		expect(service.getAudioStorageMode()).toBe('reference');
	});

	it('should merge with default settings if localStorage JSON has missing keys', () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({}));
		const service = SettingsService.instance();
		expect(service.getAll()).toEqual({ audioStorageMode: 'assets' });
	});

	it('should return default settings gracefully if localStorage contains invalid JSON', () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		localStorage.setItem(SETTINGS_KEY, 'invalid-json');
		const service = SettingsService.instance();
		expect(service.getAll()).toEqual({ audioStorageMode: 'assets' });
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it('should return a copy of all settings with getAll()', () => {
		const service = SettingsService.instance();
		const settings = service.getAll();
		settings.audioStorageMode = 'reference';

		expect(service.getAudioStorageMode()).toBe('assets');
	});

	it('should return the same singleton instance', () => {
		const instance1 = SettingsService.instance();
		const instance2 = SettingsService.instance();
		expect(instance1).toBe(instance2);
	});
});
