import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createShapeId, type Editor, Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import '@components/board/board.scss';
import { BoardToolbar } from '@components/board/components/BoardToolbar';
import { CustomContextMenu } from '@components/board/components/ContextMenu';
import { MiniPlayer } from '@components/board/components/MiniPlayer';
import { PageTabs } from '@components/board/components/PageTabs';
import { SettingsModal } from '@components/board/components/SettingsModal';
import {
	type TrackFormData,
	TrackFormModal,
} from '@components/board/components/TrackFormModal';
import { customShapeUtils } from '@components/board/config/customShapes';
import { uiComponents } from '@components/board/config/ui-components';
import { uiOverrides } from '@components/board/config/ui-overrides';
import { useBoardDragDrop } from '@components/board/hooks/useBoardDragDrop';
import { useBoardPaste } from '@components/board/hooks/useBoardPaste';
import { useBoardShortcuts } from '@components/board/hooks/useBoardShortcuts';
import { useBoardSync } from '@components/board/hooks/useBoardSync';
import { CreateProjectModal } from '@components/project/CreateProjectModal';
import { clearBlobUrlCache } from '@core/utils/mediaUtils';

/**
 * Props for Board component.
 */
interface BoardProps {
	/** Active project ID */
	projectId?: string;
	/** Callback to return to project list screen */
	onBackToProjects?: () => void;
	/** Callback when a project is selected/created */
	onSelectProject?: (projectId: string) => void;
}

/**
 * Main Board component rendering the tldraw canvas instance, toolbar, tabs, mini player,
 * toast container, and track edit modal. Manages auto-sync of shapes and camera to persistent storage.
 */
export default function Board({
	projectId: initialProjectId,
	onBackToProjects,
	onSelectProject,
}: BoardProps) {
	const { i18n } = useTranslation();
	const [activeProjectId, setActiveProjectId] = useState<string | undefined>(
		initialProjectId,
	);
	const editorRef = useRef<Editor | null>(null);

	const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
		useState(false);
	const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
	const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
	const [trackModalPos, setTrackModalPos] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [editingTrackShape, setEditingTrackShape] = useState<any>(null);
	const [initialTrackData, setInitialTrackData] = useState<
		Partial<TrackFormData>
	>({});

	useEffect(() => {
		return () => {
			clearBlobUrlCache();
		};
	}, []);

	/**
	 * Opens track modal with preset data or position coordinates.
	 */
	const handleOpenTrackModal = useCallback(
		(
			pos?: { x: number; y: number },
			shapeToEdit?: any,
			defaultData?: Partial<TrackFormData>,
		) => {
			setTrackModalPos(pos || null);
			setEditingTrackShape(shapeToEdit || null);
			if (shapeToEdit) {
				const p = shapeToEdit.props;
				setInitialTrackData({
					title: p.title || '',
					imageUrl: p.imageUrl || '',
					audioSource: p.audioSource || '',
					sourceType: p.sourceType || 'local',
					playMode: p.playMode || 'oneshot',
					loopRegion: p.loopRegion || { start: 0, end: 0 },
				});
			} else if (defaultData) {
				setInitialTrackData(defaultData);
			} else {
				setInitialTrackData({});
			}
			setIsTrackModalOpen(true);
		},
		[],
	);

	useEffect(() => {
		const handleEditTrackEvent = (e: CustomEvent) => {
			const shape = e.detail;
			if (shape && editorRef.current) {
				const bounds = editorRef.current.getShapePageBounds(shape.id);
				handleOpenTrackModal(
					bounds ? { x: bounds.x, y: bounds.y } : undefined,
					shape,
				);
			}
		};

		window.addEventListener(
			'soundref:edit-track',
			handleEditTrackEvent as EventListener,
		);
		return () =>
			window.removeEventListener(
				'soundref:edit-track',
				handleEditTrackEvent as EventListener,
			);
	}, [handleOpenTrackModal]);

	/**
	 * Saves track modal form data to new or existing track shape.
	 */
	const handleSaveTrackForm = useCallback(
		(data: TrackFormData) => {
			const editor = editorRef.current;
			if (!editor) return;

			if (editingTrackShape) {
				editor.updateShape({
					id: editingTrackShape.id,
					type: 'track',
					props: {
						title: data.title,
						imageUrl: data.imageUrl,
						audioSource: data.audioSource,
						sourceType: data.sourceType,
						playMode: data.playMode,
						loopRegion: data.loopRegion,
					},
				});
			} else {
				const point = trackModalPos || {
					x: editor.getViewportPageBounds().center.x - 100,
					y: editor.getViewportPageBounds().center.y - 100,
				};
				const newId = createShapeId();
				editor.createShape({
					id: newId,
					type: 'track',
					x: point.x,
					y: point.y,
					props: {
						title: data.title,
						imageUrl: data.imageUrl,
						audioSource: data.audioSource,
						sourceType: data.sourceType,
						playMode: data.playMode,
						loopRegion: data.loopRegion,
						w: 200,
						h: 200,
					},
				});
				editor.select(newId);
			}
		},
		[editingTrackShape, trackModalPos],
	);

	// Custom Hooks
	const { handleMount } = useBoardSync(
		editorRef,
		initialProjectId,
		activeProjectId,
		setActiveProjectId,
	);
	const { handleDragOver, handleDrop } = useBoardDragDrop(
		editorRef,
		handleOpenTrackModal,
	);
	useBoardPaste(editorRef);
	useBoardShortcuts(editorRef);

	const handleCanvasDoubleClickCapture = useCallback((e: React.MouseEvent) => {
		const target = e.target as HTMLElement;
		const isInsideUi = target.closest(
			'.page-tabs, .board-toolbar, .mini-player, .tl-ui-button, input, button',
		);
		if (isInsideUi) return;

		const isInsideShape = target.closest(
			'.tl-shape, .section-shape, .track-card, [data-shape-type]',
		);
		if (!isInsideShape) {
			e.stopPropagation();
			e.preventDefault();
		}
	}, []);

	const customContextMenuWithProps = useCallback(
		(props: any) => (
			<CustomContextMenu {...props} onOpenTrackModal={handleOpenTrackModal} />
		),
		[handleOpenTrackModal],
	);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: drag drop canvas container
		<div
			style={{ position: 'fixed', inset: 0 }}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			onDoubleClickCapture={handleCanvasDoubleClickCapture}
		>
			<Tldraw
				autoFocus
				colorScheme="system"
				locale={i18n.language}
				shapeUtils={customShapeUtils}
				components={{
					...uiComponents,
					ContextMenu: customContextMenuWithProps,
				}}
				overrides={uiOverrides}
				onMount={handleMount}
				options={{
					branding: 'SoundRef',
					rightClickPanning: true,
				}}
			>
				<PageTabs
					projectId={activeProjectId}
					onBackToProjects={onBackToProjects}
					onOpenCreateProjectModal={() => setIsCreateProjectModalOpen(true)}
					onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
				/>
				<MiniPlayer />
				<BoardToolbar onOpenTrackModal={handleOpenTrackModal} />
			</Tldraw>

			<TrackFormModal
				isOpen={isTrackModalOpen}
				initialData={initialTrackData}
				onSave={handleSaveTrackForm}
				onClose={() => setIsTrackModalOpen(false)}
			/>

			<CreateProjectModal
				isOpen={isCreateProjectModalOpen}
				onClose={() => setIsCreateProjectModalOpen(false)}
				onProjectCreated={(project) => {
					setActiveProjectId(project.id);
					onSelectProject?.(project.id);
				}}
			/>

			<SettingsModal
				isOpen={isSettingsModalOpen}
				onClose={() => setIsSettingsModalOpen(false)}
			/>
		</div>
	);
}
