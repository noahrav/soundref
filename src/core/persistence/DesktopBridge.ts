import { invoke } from '@tauri-apps/api/core';

export interface KnownProjectEntry {
	id: string;
	name: string;
	path: string;
	createdAt: string;
	workspaceCount: number;
}

export class DesktopBridge {
	public static isTauri(): boolean {
		return (
			typeof window !== 'undefined' &&
			('__TAURI_INTERNALS__' in window ||
				'__TAURI__' in window ||
				'__TAURI_PATTERN__' in window)
		);
	}

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
}
