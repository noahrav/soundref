/// <reference types="vitest/config" />
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
	plugins: [react()],
	resolve: {
		alias: {
			'@components': path.resolve(import.meta.dirname, './src/components'),
			'@core': path.resolve(import.meta.dirname, './src/core'),
			'@locales': path.resolve(import.meta.dirname, './src/locales'),
			'@services': path.resolve(import.meta.dirname, './src/services'),
		},
	},
	test: {
		globals: true,
		environment: 'node',
		setupFiles: './src/tests/setup.ts',
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
	},
	build: {
		chunkSizeWarningLimit: 2500,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('node_modules/tldraw')) {
						return 'tldraw';
					}
					if (id.includes('node_modules/@fortawesome')) {
						return 'fontawesome';
					}
					if (
						id.includes('node_modules/react') ||
						id.includes('node_modules/react-dom')
					) {
						return 'react-vendor';
					}
				},
			},
		},
	},

	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent Vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			// 3. tell Vite to ignore watching `src-tauri`
			ignored: ['**/src-tauri/**'],
		},
	},
}));
