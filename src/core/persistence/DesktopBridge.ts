import { invoke } from '@tauri-apps/api/core';

/**
 * Interface representing a known project entry in the global desktop registry.
 */
export interface KnownProjectEntry {
	/** Unique project ID string */
	id: string;
	/** Display name of the project */
	name: string;
	/** File system folder path of the project */
	path: string;
	/** ISO timestamp string of project creation time */
	createdAt: string;
	/** Number of workspaces contained within the project */
	workspaceCount: number;
}

/**
 * Utility bridge encapsulating Tauri desktop IPC calls and fallback browser checks.
 */
export class DesktopBridge {
	/**
	 * Checks whether the current runtime environment is inside Tauri desktop app.
	 * @returns True if running in Tauri, false if in standard web browser.
	 */
	public static isTauri(): boolean {
		return (
			typeof window !== 'undefined' &&
			('__TAURI_INTERNALS__' in window ||
				'__TAURI__' in window ||
				'__TAURI_PATTERN__' in window)
		);
	}

	/**
	 * Invokes native desktop folder picker dialog.
	 * @returns Promise resolving to picked folder path string or null.
	 */
	public static async pickFolder(): Promise<string | null> {
		if (DesktopBridge.isTauri()) {
			try {
				const folder = await invoke<string | null>('pick_folder');
				return folder;
			} catch (err) {
				console.error('[DesktopBridge] pick_folder error:', err);
				return null;
			}
		}
		return null;
	}

	/**
	 * Invokes native audio file picker dialog.
	 * @returns Promise resolving to picked audio file path string or null.
	 */
	public static async pickAudioFile(): Promise<string | null> {
		if (DesktopBridge.isTauri()) {
			try {
				return await invoke<string | null>('pick_audio_file');
			} catch (err) {
				console.error('[DesktopBridge] pick_audio_file error:', err);
				return null;
			}
		}
		return null;
	}

	/**
	 * Invokes native image file picker dialog.
	 * @returns Promise resolving to picked image file path string or null.
	 */
	public static async pickImageFile(): Promise<string | null> {
		if (DesktopBridge.isTauri()) {
			try {
				return await invoke<string | null>('pick_image_file');
			} catch (err) {
				console.error('[DesktopBridge] pick_image_file error:', err);
				return null;
			}
		}
		return null;
	}

	/**
	 * Reads binary data from specified desktop file path.
	 * @param path File system path.
	 * @returns Promise resolving to ArrayBuffer or null on failure.
	 */
	public static async readFileBinary(
		path: string,
	): Promise<ArrayBuffer | null> {
		if (DesktopBridge.isTauri()) {
			try {
				const buffer = await invoke<ArrayBuffer>('read_file_binary', { path });
				return buffer;
			} catch (err) {
				console.warn(
					`[DesktopBridge] Failed to read binary file at ${path}:`,
					err,
				);
				return null;
			}
		}
		return null;
	}

	/**
	 * Reads text content from specified desktop file path.
	 * @param path File system path.
	 * @returns Promise resolving to text content string or null on failure.
	 */
	public static async readTextFile(path: string): Promise<string | null> {
		if (DesktopBridge.isTauri()) {
			try {
				const content = await invoke<string>('read_text_file', { path });
				return content;
			} catch (err) {
				console.warn(
					`[DesktopBridge] Failed to read text file at ${path}:`,
					err,
				);
				return null;
			}
		}
		return null;
	}

	/**
	 * Writes text content to specified desktop file path.
	 * @param path File system path.
	 * @param content Text content string to write.
	 * @returns Promise resolving to true on success, false on failure.
	 */
	public static async writeTextFile(
		path: string,
		content: string,
	): Promise<boolean> {
		if (DesktopBridge.isTauri()) {
			try {
				await invoke('write_text_file', { path, content });
				return true;
			} catch (err) {
				console.error(
					`[DesktopBridge] Failed to write text file at ${path}:`,
					err,
				);
				return false;
			}
		}
		return false;
	}

	/**
	 * Creates a directory at specified desktop path.
	 * @param path Folder directory path.
	 * @returns Promise resolving to true on success, false on failure.
	 */
	public static async createDir(path: string): Promise<boolean> {
		if (DesktopBridge.isTauri()) {
			try {
				await invoke('create_dir', { path });
				return true;
			} catch (err) {
				console.error(`[DesktopBridge] Failed to create dir at ${path}:`, err);
				return false;
			}
		}
		return false;
	}

	/**
	 * Copies a file from source path to destination path.
	 * @param from Source file path.
	 * @param to Destination file path.
	 * @returns Promise resolving to true on success, false on failure.
	 */
	public static async copyFile(from: string, to: string): Promise<boolean> {
		if (DesktopBridge.isTauri()) {
			try {
				await invoke('copy_file', { from, to });
				return true;
			} catch (err) {
				console.error(
					`[DesktopBridge] Failed to copy file from ${from} to ${to}:`,
					err,
				);
				return false;
			}
		}
		return false;
	}

	/**
	 * Checks if a file or directory exists at specified path.
	 * @param path File system path string.
	 * @returns Promise resolving to true if file exists, false otherwise.
	 */
	public static async fileExists(path: string): Promise<boolean> {
		if (DesktopBridge.isTauri()) {
			try {
				return await invoke<boolean>('file_exists', { path });
			} catch {
				return false;
			}
		}
		return false;
	}

	/**
	 * Gets the path to global projects registry file.
	 * @returns Promise resolving to file path string or null.
	 */
	public static async getRegistryFilePath(): Promise<string | null> {
		if (DesktopBridge.isTauri()) {
			try {
				return await invoke<string>('get_projects_registry_path');
			} catch (err) {
				console.error('[DesktopBridge] get_projects_registry_path error:', err);
				return null;
			}
		}
		return null;
	}

	/**
	 * Opens specified desktop folder in native file explorer.
	 * @param path Directory path to open.
	 */
	public static async openFolder(path: string): Promise<void> {
		if (DesktopBridge.isTauri()) {
			try {
				await invoke('open_folder', { path });
				return;
			} catch (err) {
				console.warn(
					'[DesktopBridge] open_folder invoke error, trying plugin-opener:',
					err,
				);
			}
			try {
				const { openPath } = await import('@tauri-apps/plugin-opener');
				await openPath(path);
			} catch (err) {
				console.error('[DesktopBridge] openPath error:', err);
			}
		}
	}

	/**
	 * Quits the desktop application window.
	 */
	public static async exitApp(): Promise<void> {
		if (DesktopBridge.isTauri()) {
			try {
				const { invoke } = await import('@tauri-apps/api/core');
				await invoke('exit_app');
			} catch (err) {
				console.error(
					'[DesktopBridge] exit_app invoke error, trying window close:',
					err,
				);
				try {
					const { getCurrentWindow } = await import('@tauri-apps/api/window');
					await getCurrentWindow().close();
				} catch (winErr) {
					console.error('[DesktopBridge] exitApp window close error:', winErr);
				}
			}
		} else {
			window.close();
		}
	}
}
