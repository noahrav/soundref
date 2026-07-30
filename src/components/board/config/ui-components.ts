import type { TLComponents } from 'tldraw';
import { CustomContextMenu } from '../components/ContextMenu';
import { DotGrid } from '../components/DotGrid';

/**
 * Custom UI component overrides object for tldraw canvas configuration.
 * Disables standard toolbars and supplies SoundRef context menus and dot grid background.
 */
export const uiComponents: TLComponents = {
	Background: DotGrid,
	Grid: null,
	ContextMenu: CustomContextMenu,
	Toolbar: null,
	MainMenu: null,
	StylePanel: null,
	ActionsMenu: null,
	HelpMenu: null,
	PageMenu: null,
	RichTextToolbar: null,
	ImageToolbar: null,
	VideoToolbar: null,
	MenuPanel: null,
	SharePanel: null,
	KeyboardShortcutsDialog: null,
	QuickActions: null,
	HelperButtons: null,
};
