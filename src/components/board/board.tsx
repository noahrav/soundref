import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	createShapeId,
	type Editor,
	PageRecordType,
	type TLShapeId,
	Tldraw,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { ImageItem } from '@core/model/item/ImageItem';
import { SectionItem } from '@core/model/item/SectionItem';
import { StickyNoteItem } from '@core/model/item/StickyNoteItem';
import { TextItem } from '@core/model/item/TextItem';
import { TrackItem } from '@core/model/item/TrackItem';
import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { clearBlobUrlCache, getImageDimensions } from '@core/utils/mediaUtils';
import { ProjectService } from '@services/ProjectService';
import { SettingsService } from '@services/SettingsService';
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
import {
	fetchCoverArt,
	parseStreamUrl,
} from '@components/board/utils/embedUtils';
import { compressImageToDataUrl } from '@components/board/utils/imageCompressor';
import { fromRichText, toRichText } from '@components/board/utils/richText';
import { CreateProjectModal } from '@components/project/CreateProjectModal';

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
 * Extracts plain text string content from note/text shape properties.
 * @param props Raw shape props object.
 * @returns Plain text content string.
 */
function extractNoteContent(props: any): string {
	if (!props) return '';
	if (typeof props.text === 'string' && props.text) return props.text;
	if (props.richText) {
		const rich = fromRichText(props.richText);
		if (rich) return rich;
	}
	return props.text || '';
}

function sendShapeToBackAboveSections(editor: Editor, shapeId: TLShapeId) {
	editor.sendToBack([shapeId]);
	const sectionIds = editor
		.getCurrentPageShapes()
		.filter((s) => s.type === 'section')
		.map((s) => s.id);
	if (sectionIds.length > 0) {
		editor.sendToBack(sectionIds);
	}
}

/**
 * Main Board component rendering the tldraw canvas instance, toolbar, tabs, mini player,
 * and track edit modal. Manages auto-sync of shapes and camera to persistent storage.
 */
export default function Board({
	projectId: initialProjectId,
	onBackToProjects,
	onSelectProject,
}: BoardProps) {
	const { i18n, t } = useTranslation();
	const [activeProjectId, setActiveProjectId] = useState<string | undefined>(
		initialProjectId,
	);
	const service = ProjectService.instance();
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

	/**
	 * Handler executed when tldraw editor mounts. Registers event listeners,
	 * loads project workspace items, and syncs changes to persistent storage.
	 */
	const handleMount = useCallback(
		(editor: Editor) => {
			editorRef.current = editor;
			editor.user.updateUserPreferences({ inputMode: 'mouse' });
			editor.updateInstanceState({ isGridMode: true });
			editor.setCameraOptions({ wheelBehavior: 'zoom' });
			editor.setCurrentTool('select');

			editor.sideEffects.registerBeforeChangeHandler('shape', (_prev, next) => {
				if (
					(next.type === 'note' || next.type === 'track') &&
					next.rotation !== 0
				) {
					return { ...next, rotation: 0 };
				}
				return next;
			});

			const handleAudioOrStreamUrl = async (urlStr: string, point?: any) => {
				const clean = urlStr.trim();
				const streamInfo = parseStreamUrl(clean);
				const isAudioFile = clean.match(
					/\.(mp3|wav|ogg|flac|m4a|aac)(\?.*)?$/i,
				);
				if (streamInfo.isStream || isAudioFile) {
					const targetPoint = point || editor.inputs.getCurrentPagePoint();
					const newId = createShapeId();
					const coverUrl = await fetchCoverArt(clean);
					const titleFromUrl = clean.split('/').pop()?.split('?')[0] || 'Track';
					editor.createShape({
						id: newId,
						type: 'track',
						x: targetPoint.x - 100,
						y: targetPoint.y - 100,
						props: {
							title: titleFromUrl,
							imageUrl: coverUrl,
							audioSource: clean,
							sourceType: streamInfo.isStream ? 'stream' : 'local',
							playMode: 'oneshot',
							loopRegion: { start: 0, end: 0 },
							w: 200,
							h: 200,
						},
					});
					editor.select(newId);
					return true;
				}
				return false;
			};

			editor.registerExternalContentHandler('url', async ({ url, point }) => {
				const handled = await handleAudioOrStreamUrl(url, point);
				if (handled) return;
				const targetPoint = point || editor.inputs.getCurrentPagePoint();
				const newId = createShapeId();
				editor.createShape({
					id: newId,
					type: 'text',
					x: targetPoint.x - 100,
					y: targetPoint.y - 20,
					props: {
						richText: toRichText(url),
						autoSize: true,
					},
				});
				editor.select(newId);
			});

			editor.registerExternalContentHandler('text', async ({ text, point }) => {
				const handled = await handleAudioOrStreamUrl(text, point);
				if (handled) return;
				const targetPoint = point || editor.inputs.getCurrentPagePoint();
				const newId = createShapeId();
				editor.createShape({
					id: newId,
					type: 'text',
					x: targetPoint.x - 100,
					y: targetPoint.y - 20,
					props: {
						richText: toRichText(text),
						autoSize: true,
					},
				});
				editor.select(newId);
			});

			void (async () => {
				try {
					let targetProjectId = initialProjectId;
					if (!targetProjectId) {
						const projects = await service.getProjects();
						if (projects.length > 0) {
							targetProjectId = projects[0].id;
						} else {
							const newProj = await service.createProject(
								t('board.defaultProjectName'),
								'./',
							);
							targetProjectId = newProj.id;
						}
						setActiveProjectId(targetProjectId);
					}

					if (targetProjectId) {
						let workspaces = await service.getWorkspaces(targetProjectId);
						if (workspaces.length === 0) {
							const created = await service.createWorkspace(
								targetProjectId,
								t('board.defaultWorkspaceName', { number: 1 }),
							);
							workspaces = [created];
						}

						const existingPages = editor.getPages();

						for (const ws of workspaces) {
							const pageId = PageRecordType.createId(ws.id);
							const existing = editor.getPage(pageId);
							if (!existing) {
								editor.createPage({ id: pageId, name: ws.name });
							} else {
								editor.renamePage(pageId, ws.name);
							}

							editor.setCurrentPage(pageId);

							try {
								const items = await service.getItems(targetProjectId, ws.id);
								items.forEach((item) => {
									const shapeId = `shape:${item.id}` as TLShapeId;
									if (!editor.getShape(shapeId)) {
										if (
											item instanceof TextItem ||
											(item as any).type === 'TextItem'
										) {
											const textItem = item as TextItem;
											editor.createShape({
												id: shapeId,
												type: 'text',
												x: item.position.x,
												y: item.position.y,
												props: {
													richText: toRichText(textItem.content || ''),
													scale: textItem.scale || 1,
													w: textItem.width || 200,
													autoSize: !textItem.width,
												},
											});
										} else if (
											item instanceof TrackItem ||
											(item as any).type === 'TrackItem'
										) {
											const trackItem = item as TrackItem;
											editor.createShape({
												id: shapeId,
												type: 'track',
												x: item.position.x,
												y: item.position.y,
												props: {
													title: trackItem.title || 'Track',
													imageUrl: trackItem.imageUrl || '',
													audioSource: trackItem.audioSource || '',
													sourceType: trackItem.sourceType || 'local',
													playMode: trackItem.playMode || 'oneshot',
													loopRegion: trackItem.loopRegion || {
														start: 0,
														end: 0,
													},
													w: trackItem.width || 200,
													h: trackItem.width || 200,
												},
											});
										} else if (
											item instanceof ImageItem ||
											(item as any).type === 'ImageItem'
										) {
											const imageItem = item as ImageItem;
											editor.createShape({
												id: shapeId,
												type: 'image_item',
												x: item.position.x,
												y: item.position.y,
												props: {
													imageUrl: imageItem.imageUrl || '',
													scale: imageItem.scale || 1,
													w: imageItem.width || 300,
													h: imageItem.height || 300,
												},
											});
											sendShapeToBackAboveSections(editor, shapeId);
										} else if (
											item instanceof SectionItem ||
											(item as any).type === 'SectionItem'
										) {
											const sectionItem = item as SectionItem;
											editor.createShape({
												id: shapeId,
												type: 'section',
												x: item.position.x,
												y: item.position.y,
												props: {
													title: sectionItem.title || 'Section',
													color: (sectionItem.color || 'blue') as any,
													w: sectionItem.width || 400,
													h: sectionItem.height || 300,
												},
											});
											editor.sendToBack([shapeId]);
										} else if (
											item instanceof StickyNoteItem ||
											(item as any).type === 'StickyNoteItem' ||
											(item as any).type === 'note'
										) {
											const stickyItem = item as StickyNoteItem;
											const noteContent = stickyItem.content || '';
											editor.createShape({
												id: shapeId,
												type: 'note',
												x: item.position.x,
												y: item.position.y,
												props: {
													color: (stickyItem.color || 'yellow') as any,
													richText: toRichText(noteContent),
													scale: stickyItem.scale || 1,
												},
											});
										}
									}
								});
							} catch (e) {
								console.warn(
									`[Board] Failed to load items for workspace ${ws.id}:`,
									e,
								);
							}
						}

						const firstWs = workspaces[0];
						const firstPageId = PageRecordType.createId(firstWs.id);
						editor.setCurrentPage(firstPageId);

						const zoom = firstWs.viewportState.zoom;
						const initialZoom = zoom > 10 ? zoom / 100 : zoom || 1.0;
						editor.setCamera({
							x: firstWs.viewportState.offset.x || 0,
							y: firstWs.viewportState.offset.y || 0,
							z: initialZoom,
						});

						existingPages.forEach((p) => {
							const isKnownWs = workspaces.some(
								(ws) => PageRecordType.createId(ws.id) === p.id,
							);
							if (!isKnownWs && editor.getPages().length > 1) {
								editor.deletePage(p.id);
							}
						});

						let cameraDebounceTimer: ReturnType<typeof setTimeout> | null =
							null;
						let shapeSyncDebounceTimer: ReturnType<typeof setTimeout> | null =
							null;
						let lastSyncedCamera = { ...editor.getCamera() };
						let lastPageId = editor.getCurrentPageId();
						let lastEditingShapeId: TLShapeId | null =
							editor.getEditingShapeId();

						const syncCurrentPageItemsToDisk = () => {
							if (shapeSyncDebounceTimer) clearTimeout(shapeSyncDebounceTimer);
							shapeSyncDebounceTimer = setTimeout(() => {
								const currentPageId = editor.getCurrentPageId();
								const cleanWsId = currentPageId.replace(/^page:/, '');
								const pageShapes = editor.getCurrentPageShapes();

								const itemsToSync: Array<any> = [];
								pageShapes.forEach((shape) => {
									if (shape.type === 'note') {
										const cleanId = shape.id.replace(/^shape:/, '');
										const content = extractNoteContent(shape.props);
										itemsToSync.push({
											id: cleanId,
											type: 'StickyNoteItem',
											x: shape.x,
											y: shape.y,
											content,
											scale: (shape.props as any)?.scale || 1,
											color: (shape.props as any)?.color || 'yellow',
										});
									} else if (shape.type === 'text') {
										const cleanId = shape.id.replace(/^shape:/, '');
										const content = extractNoteContent(shape.props);
										itemsToSync.push({
											id: cleanId,
											type: 'TextItem',
											x: shape.x,
											y: shape.y,
											content,
											scale: (shape.props as any)?.scale || 1,
											width: (shape.props as any)?.w,
										});
									} else if (shape.type === 'track') {
										const cleanId = shape.id.replace(/^shape:/, '');
										const p = shape.props as any;
										itemsToSync.push({
											id: cleanId,
											type: 'TrackItem',
											x: shape.x,
											y: shape.y,
											title: p.title || 'Track',
											imageUrl: p.imageUrl || '',
											audioSource: p.audioSource || '',
											sourceType: p.sourceType || 'local',
											playMode: p.playMode || 'oneshot',
											loopRegion: p.loopRegion || { start: 0, end: 0 },
											scale: p.scale || 1,
											width: p.w || 200,
										});
									} else if (shape.type === 'image_item') {
										const cleanId = shape.id.replace(/^shape:/, '');
										const p = shape.props as any;
										itemsToSync.push({
											id: cleanId,
											type: 'ImageItem',
											x: shape.x,
											y: shape.y,
											imageUrl: p.imageUrl || '',
											scale: p.scale || 1,
											width: p.w || 300,
											height: p.h || 300,
										});
									} else if (shape.type === 'section') {
										const cleanId = shape.id.replace(/^shape:/, '');
										const p = shape.props as any;
										itemsToSync.push({
											id: cleanId,
											type: 'SectionItem',
											x: shape.x,
											y: shape.y,
											title: p.title || 'Section',
											color: p.color || 'blue',
											width: p.w || 400,
											height: p.h || 300,
										});
									}
								});

								service
									.syncWorkspaceItems(targetProjectId, cleanWsId, itemsToSync)
									.catch((err) =>
										console.warn('[Board] Could not sync items:', err),
									);
							}, 300);
						};

						editor.store.listen((entry) => {
							const currentEditingShapeId = editor.getEditingShapeId();
							if (
								lastEditingShapeId &&
								lastEditingShapeId !== currentEditingShapeId
							) {
								const shapeToCheck = lastEditingShapeId;
								setTimeout(() => {
									const prevShape = editor.getShape(shapeToCheck);
									if (prevShape && prevShape.type === 'text') {
										const content = extractNoteContent(prevShape.props);
										if (!content || content.trim() === '') {
											editor.deleteShape(shapeToCheck);
										}
									}
								}, 0);
							}
							lastEditingShapeId = currentEditingShapeId;

							const currentPageId = editor.getCurrentPageId();
							const cleanWsId = currentPageId.replace(/^page:/, '');

							if (currentPageId !== lastPageId) {
								lastPageId = currentPageId;
								if (cameraDebounceTimer) clearTimeout(cameraDebounceTimer);

								service
									.getWorkspace(targetProjectId, cleanWsId)
									.then((ws) => {
										if (ws?.viewportState) {
											const z =
												ws.viewportState.zoom > 10
													? ws.viewportState.zoom / 100
													: ws.viewportState.zoom || 1.0;
											editor.setCamera({
												x: ws.viewportState.offset.x || 0,
												y: ws.viewportState.offset.y || 0,
												z,
											});
											lastSyncedCamera = { ...editor.getCamera() };
										}
									})
									.catch((err) =>
										console.warn(
											'[Board] Could not load workspace camera:',
											err,
										),
									);
								return;
							}

							const currentCam = editor.getCamera();
							if (
								currentCam.x !== lastSyncedCamera.x ||
								currentCam.y !== lastSyncedCamera.y ||
								currentCam.z !== lastSyncedCamera.z
							) {
								lastSyncedCamera = { ...currentCam };
								if (cameraDebounceTimer) clearTimeout(cameraDebounceTimer);
								cameraDebounceTimer = setTimeout(() => {
									service
										.updateWorkspace(targetProjectId, cleanWsId, {
											zoom: currentCam.z,
											offsetX: currentCam.x,
											offsetY: currentCam.y,
										})
										.catch((err) =>
											console.warn('[Board] Could not sync viewport:', err),
										);
								}, 500);
							}

							for (const recordId in entry.changes.updated) {
								if (recordId.startsWith('page:')) {
									const [_, updatedPage] = entry.changes.updated[
										recordId as keyof typeof entry.changes.updated
									] as any;
									if (updatedPage?.name) {
										const wsIdToUpdate = updatedPage.id.replace(/^page:/, '');
										service
											.updateWorkspace(targetProjectId, wsIdToUpdate, {
												name: updatedPage.name,
											})
											.catch((err) =>
												console.warn('[Board] Could not sync page name:', err),
											);
									}
								}
							}

							let hasShapeChanges = false;
							for (const recordId in entry.changes.added) {
								if (recordId.startsWith('shape:')) {
									hasShapeChanges = true;
									break;
								}
							}
							if (!hasShapeChanges) {
								for (const recordId in entry.changes.updated) {
									if (recordId.startsWith('shape:')) {
										hasShapeChanges = true;
										break;
									}
								}
							}
							if (!hasShapeChanges) {
								for (const recordId in entry.changes.removed) {
									if (recordId.startsWith('shape:')) {
										hasShapeChanges = true;
										break;
									}
								}
							}
							if (hasShapeChanges) {
								syncCurrentPageItemsToDisk();
							}
						});
					}
				} catch (err) {
					console.warn('[Board] Could not sync with storage:', err);
				}
			})();
		},
		[initialProjectId, service, t],
	);

	/**
	 * Refreshes tldraw pages and shape objects to reflect updated domain workspace state following undo/redo.
	 */
	const refreshEditorFromDomain = useCallback(async () => {
		const editor = editorRef.current;
		if (!editor || !activeProjectId) return;

		try {
			const workspaces = await service.getWorkspaces(activeProjectId);
			const domainWsMap = new Map(workspaces.map((ws) => [ws.id, ws]));
			const existingPages = editor.getPages();

			workspaces.forEach((ws) => {
				const pageId = PageRecordType.createId(ws.id);
				const existingPage = existingPages.find((p) => p.id === pageId);
				if (!existingPage) {
					editor.createPage({ id: pageId, name: ws.name });
				} else if (existingPage.name !== ws.name) {
					editor.renamePage(pageId, ws.name);
				}
			});

			existingPages.forEach((p) => {
				const cleanId = p.id.replace(/^page:/, '');
				if (!domainWsMap.has(cleanId) && editor.getPages().length > 1) {
					editor.deletePage(p.id);
				}
			});

			const currentPageId = editor.getCurrentPageId();
			const cleanWsId = currentPageId.replace(/^page:/, '');
			const ws = domainWsMap.get(cleanWsId);
			if (!ws) return;

			const currentShapes = editor.getCurrentPageShapes();
			const domainItems = ws.items;
			const domainItemIds = new Set(Array.from(domainItems.keys()));

			currentShapes.forEach((shape) => {
				const cleanId = shape.id.replace(/^shape:/, '');
				if (!domainItemIds.has(cleanId)) {
					editor.deleteShape(shape.id);
				}
			});

			domainItems.forEach((item, id) => {
				const shapeId = createShapeId(id);
				const existingShape = editor.getShape(shapeId);

				if (!existingShape) {
					if (item instanceof TextItem || (item as any).type === 'TextItem') {
						const textItem = item as TextItem;
						editor.createShape({
							id: shapeId,
							type: 'text',
							x: textItem.position.x,
							y: textItem.position.y,
							props: {
								richText: toRichText(textItem.content || ''),
								scale: textItem.scale || 1,
								w: textItem.width || 200,
								autoSize: !textItem.width,
							},
						});
					} else if (
						item instanceof TrackItem ||
						(item as any).type === 'TrackItem'
					) {
						const trackItem = item as TrackItem;
						editor.createShape({
							id: shapeId,
							type: 'track',
							x: trackItem.position.x,
							y: trackItem.position.y,
							props: {
								title: trackItem.title || 'Track',
								imageUrl: trackItem.imageUrl || '',
								audioSource: trackItem.audioSource || '',
								sourceType: trackItem.sourceType || 'local',
								playMode: trackItem.playMode || 'oneshot',
								loopRegion: trackItem.loopRegion || { start: 0, end: 0 },
								w: trackItem.width || 200,
								h: trackItem.width || 200,
							},
						});
					} else if (
						item instanceof ImageItem ||
						(item as any).type === 'ImageItem'
					) {
						const imageItem = item as ImageItem;
						editor.createShape({
							id: shapeId,
							type: 'image_item',
							x: imageItem.position.x,
							y: imageItem.position.y,
							props: {
								imageUrl: imageItem.imageUrl || '',
								scale: imageItem.scale || 1,
								w: imageItem.width || 300,
								h: imageItem.height || 300,
							},
						});
						sendShapeToBackAboveSections(editor, shapeId);
					} else if (
						item instanceof SectionItem ||
						(item as any).type === 'SectionItem'
					) {
						const sectionItem = item as SectionItem;
						editor.createShape({
							id: shapeId,
							type: 'section',
							x: sectionItem.position.x,
							y: sectionItem.position.y,
							props: {
								title: sectionItem.title || 'Section',
								color: (sectionItem.color || 'blue') as any,
								w: sectionItem.width || 400,
								h: sectionItem.height || 300,
							},
						});
						editor.sendToBack([shapeId]);
					} else if (
						item instanceof StickyNoteItem ||
						(item as any).type === 'StickyNoteItem' ||
						(item as any).type === 'note'
					) {
						const stickyItem = item as StickyNoteItem;
						editor.createShape({
							id: shapeId,
							type: 'note',
							x: stickyItem.position.x,
							y: stickyItem.position.y,
							props: {
								color: (stickyItem.color || 'yellow') as any,
								richText: toRichText(stickyItem.content || ''),
								scale: stickyItem.scale || 1,
							},
						});
					}
				} else {
					const updateProps: any = {};
					let needsUpdate = false;

					if (
						existingShape.x !== item.position.x ||
						existingShape.y !== item.position.y
					) {
						needsUpdate = true;
					}

					const shapeProps = existingShape.props as any;

					if (
						item instanceof StickyNoteItem ||
						(item as any).type === 'StickyNoteItem'
					) {
						const stickyItem = item as StickyNoteItem;
						const content = extractNoteContent(shapeProps);
						if (content !== stickyItem.content) {
							updateProps.richText = toRichText(stickyItem.content || '');
							needsUpdate = true;
						}
						if (shapeProps.color !== stickyItem.color) {
							updateProps.color = stickyItem.color;
							needsUpdate = true;
						}
						if (shapeProps.scale !== stickyItem.scale) {
							updateProps.scale = stickyItem.scale;
							needsUpdate = true;
						}
					} else if (
						item instanceof TextItem ||
						(item as any).type === 'TextItem'
					) {
						const textItem = item as TextItem;
						const content = extractNoteContent(shapeProps);
						if (content !== textItem.content) {
							updateProps.richText = toRichText(textItem.content || '');
							needsUpdate = true;
						}
						if (shapeProps.w !== textItem.width) {
							updateProps.w = textItem.width;
							needsUpdate = true;
						}
						if (shapeProps.scale !== textItem.scale) {
							updateProps.scale = textItem.scale;
							needsUpdate = true;
						}
					} else if (
						item instanceof TrackItem ||
						(item as any).type === 'TrackItem'
					) {
						const trackItem = item as TrackItem;
						if (shapeProps.title !== trackItem.title) {
							updateProps.title = trackItem.title;
							needsUpdate = true;
						}
						if (shapeProps.imageUrl !== trackItem.imageUrl) {
							updateProps.imageUrl = trackItem.imageUrl;
							needsUpdate = true;
						}
						if (shapeProps.audioSource !== trackItem.audioSource) {
							updateProps.audioSource = trackItem.audioSource;
							needsUpdate = true;
						}
						if (shapeProps.sourceType !== trackItem.sourceType) {
							updateProps.sourceType = trackItem.sourceType;
							needsUpdate = true;
						}
						if (shapeProps.playMode !== trackItem.playMode) {
							updateProps.playMode = trackItem.playMode;
							needsUpdate = true;
						}
						if (shapeProps.w !== trackItem.width) {
							updateProps.w = trackItem.width;
							updateProps.h = trackItem.width;
							needsUpdate = true;
						}
						if (
							shapeProps.loopRegion?.start !== trackItem.loopRegion?.start ||
							shapeProps.loopRegion?.end !== trackItem.loopRegion?.end
						) {
							updateProps.loopRegion = trackItem.loopRegion;
							needsUpdate = true;
						}
					} else if (
						item instanceof ImageItem ||
						(item as any).type === 'ImageItem'
					) {
						const imageItem = item as ImageItem;
						if (shapeProps.imageUrl !== imageItem.imageUrl) {
							updateProps.imageUrl = imageItem.imageUrl;
							needsUpdate = true;
						}
						if (
							shapeProps.w !== imageItem.width ||
							shapeProps.h !== imageItem.height
						) {
							updateProps.w = imageItem.width;
							updateProps.h = imageItem.height;
							needsUpdate = true;
						}
						if (shapeProps.scale !== imageItem.scale) {
							updateProps.scale = imageItem.scale;
							needsUpdate = true;
						}
					} else if (
						item instanceof SectionItem ||
						(item as any).type === 'SectionItem'
					) {
						const sectionItem = item as SectionItem;
						if (shapeProps.title !== sectionItem.title) {
							updateProps.title = sectionItem.title;
							needsUpdate = true;
						}
						if (shapeProps.color !== sectionItem.color) {
							updateProps.color = sectionItem.color;
							needsUpdate = true;
						}
						if (
							shapeProps.w !== sectionItem.width ||
							shapeProps.h !== sectionItem.height
						) {
							updateProps.w = sectionItem.width;
							updateProps.h = sectionItem.height;
							needsUpdate = true;
						}
					}

					if (needsUpdate) {
						editor.updateShape({
							id: shapeId,
							type: existingShape.type,
							x: item.position.x,
							y: item.position.y,
							props: { ...existingShape.props, ...updateProps },
						});
					}
				}
			});

			const sectionIds = editor
				.getCurrentPageShapes()
				.filter((s) => s.type === 'section')
				.map((s) => s.id);
			if (sectionIds.length > 0) {
				editor.sendToBack(sectionIds);
			}
		} catch (e) {
			console.warn('[Board] Error refreshing editor from domain:', e);
		}
	}, [activeProjectId, service]);

	useEffect(() => {
		const handleHistoryChange = () => {
			refreshEditorFromDomain();
		};

		window.addEventListener('soundref:history-change', handleHistoryChange);
		return () =>
			window.removeEventListener(
				'soundref:history-change',
				handleHistoryChange,
			);
	}, [refreshEditorFromDomain]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === 'INPUT' ||
					target.tagName === 'TEXTAREA' ||
					target.isContentEditable)
			) {
				return;
			}

			if (editorRef.current && editorRef.current.getEditingShapeId() !== null) {
				return;
			}

			const isCtrlOrCmd = e.ctrlKey || e.metaKey;
			const key = e.key.toLowerCase();

			if (isCtrlOrCmd && key === 'z' && !e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				service.undo();
			} else if (isCtrlOrCmd && (key === 'y' || (key === 'z' && e.shiftKey))) {
				e.preventDefault();
				e.stopPropagation();
				service.redo();
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [service]);

	useEffect(() => {
		const handleGlobalPaste = async (e: ClipboardEvent) => {
			const target = e.target as HTMLElement;
			if (
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable
			) {
				return;
			}
			const text = e.clipboardData?.getData('text/plain')?.trim() || '';
			const files = Array.from(e.clipboardData?.files || []);
			const imageFile = files.find(
				(f) =>
					f.type.startsWith('image/') ||
					f.name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i),
			);
			const isImageUrl =
				text.startsWith('data:image/') ||
				/\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i.test(text);

			if (imageFile || isImageUrl) {
				e.preventDefault();
				e.stopPropagation();
				const editor = editorRef.current;
				if (!editor) return;
				const point = editor.inputs.getCurrentPagePoint();
				const mode = SettingsService.instance().getAudioStorageMode();
				const activeProj = ProjectService.instance().getActiveProject();

				let finalUrl = text;
				if (imageFile) {
					const rawPath = (imageFile as any).path;
					if (
						rawPath &&
						mode === 'assets' &&
						activeProj?.path &&
						DesktopBridge.isTauri()
					) {
						const fileName = imageFile.name || 'image.png';
						const assetsDir = `${activeProj.path.replace(/[/\\]+$/, '')}/assets`;
						const targetPath = `${assetsDir}/${fileName}`;
						await DesktopBridge.createDir(assetsDir);
						const copied = await DesktopBridge.copyFile(rawPath, targetPath);
						finalUrl = copied ? `assets/${fileName}` : rawPath;
					} else if (rawPath) {
						finalUrl = rawPath;
					} else {
						const reader = new FileReader();
						reader.onload = async (evt) => {
							if (evt.target?.result) {
								const src = evt.target.result as string;
								const compressed = await compressImageToDataUrl(
									src,
									1920,
									1920,
									0.85,
								);
								const dims = await getImageDimensions(compressed);
								const newId = createShapeId();
								editor.createShape({
									id: newId,
									type: 'image_item',
									x: point.x - dims.w / 2,
									y: point.y - dims.h / 2,
									props: {
										imageUrl: compressed,
										scale: 1,
										w: dims.w,
										h: dims.h,
									},
								});
								sendShapeToBackAboveSections(editor, newId);
								editor.select(newId);
							}
						};
						reader.readAsDataURL(imageFile);
						return;
					}
				}

				let processUrl = finalUrl;
				if (processUrl.startsWith('data:image/')) {
					processUrl = await compressImageToDataUrl(
						processUrl,
						1920,
						1920,
						0.85,
					);
				}
				const dims = await getImageDimensions(processUrl);
				const newId = createShapeId();
				editor.createShape({
					id: newId,
					type: 'image_item',
					x: point.x - dims.w / 2,
					y: point.y - dims.h / 2,
					props: { imageUrl: processUrl, scale: 1, w: dims.w, h: dims.h },
				});
				sendShapeToBackAboveSections(editor, newId);
				editor.select(newId);
				return;
			}

			if (!text || !editorRef.current) return;

			const streamInfo = parseStreamUrl(text);
			const isAudioFile = text.match(/\.(mp3|wav|ogg|flac|m4a|aac)(\?.*)?$/i);

			if (streamInfo.isStream || isAudioFile) {
				e.preventDefault();
				e.stopPropagation();

				const editor = editorRef.current;
				const point = editor.inputs.getCurrentPagePoint();
				const newId = createShapeId();
				const coverUrl = await fetchCoverArt(text);
				const titleFromUrl = text.split('/').pop()?.split('?')[0] || 'Track';

				editor.createShape({
					id: newId,
					type: 'track',
					x: point.x - 100,
					y: point.y - 100,
					props: {
						title: titleFromUrl,
						imageUrl: coverUrl,
						audioSource: text,
						sourceType: streamInfo.isStream ? 'stream' : 'local',
						playMode: 'oneshot',
						loopRegion: { start: 0, end: 0 },
						w: 200,
						h: 200,
					},
				});
				editor.select(newId);
			}
		};

		window.addEventListener('paste', handleGlobalPaste, true);
		return () => window.removeEventListener('paste', handleGlobalPaste, true);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			const files = Array.from(e.dataTransfer.files);
			const imageFile = files.find(
				(f) =>
					f.type.startsWith('image/') ||
					f.name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i),
			);

			if (imageFile && editorRef.current) {
				const editor = editorRef.current;
				const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
				const rawPath = (imageFile as any).path;
				const mode = SettingsService.instance().getAudioStorageMode();
				const activeProj = ProjectService.instance().getActiveProject();

				if (
					rawPath &&
					mode === 'assets' &&
					activeProj?.path &&
					DesktopBridge.isTauri()
				) {
					const fileName = imageFile.name || 'image.png';
					const assetsDir = `${activeProj.path.replace(/[/\\]+$/, '')}/assets`;
					const targetPath = `${assetsDir}/${fileName}`;
					void DesktopBridge.createDir(assetsDir).then(() => {
						void DesktopBridge.copyFile(rawPath, targetPath).then(
							async (copied: boolean) => {
								const finalUrl = copied ? `assets/${fileName}` : rawPath;
								const dims = await getImageDimensions(finalUrl);
								const newId = createShapeId();
								editor.createShape({
									id: newId,
									type: 'image_item',
									x: point.x - dims.w / 2,
									y: point.y - dims.h / 2,
									props: { imageUrl: finalUrl, scale: 1, w: dims.w, h: dims.h },
								});
								sendShapeToBackAboveSections(editor, newId);
								editor.select(newId);
							},
						);
					});
				} else if (rawPath) {
					void getImageDimensions(rawPath).then((dims) => {
						const newId = createShapeId();
						editor.createShape({
							id: newId,
							type: 'image_item',
							x: point.x - dims.w / 2,
							y: point.y - dims.h / 2,
							props: { imageUrl: rawPath, scale: 1, w: dims.w, h: dims.h },
						});
						sendShapeToBackAboveSections(editor, newId);
						editor.select(newId);
					});
				} else {
					const reader = new FileReader();
					reader.onload = async (event) => {
						if (event.target?.result) {
							const src = event.target.result as string;
							const compressed = await compressImageToDataUrl(
								src,
								1920,
								1920,
								0.85,
							);
							const dims = await getImageDimensions(compressed);
							const newId = createShapeId();
							editor.createShape({
								id: newId,
								type: 'image_item',
								x: point.x - dims.w / 2,
								y: point.y - dims.h / 2,
								props: {
									imageUrl: compressed,
									scale: 1,
									w: dims.w,
									h: dims.h,
								},
							});
							sendShapeToBackAboveSections(editor, newId);
							editor.select(newId);
						}
					};
					reader.readAsDataURL(imageFile);
				}
				return;
			}

			const audioFile = files.find(
				(f) =>
					f.type.startsWith('audio/') ||
					f.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i),
			);
			if (audioFile && editorRef.current) {
				const point = editorRef.current.screenToPage({
					x: e.clientX,
					y: e.clientY,
				});
				const rawPath = (audioFile as any).path;
				const fileName = audioFile.name.replace(/\.[^/.]+$/, '');
				if (rawPath) {
					handleOpenTrackModal(
						{ x: point.x - 100, y: point.y - 100 },
						undefined,
						{
							title: fileName,
							audioSource: rawPath,
							sourceType: 'local',
						},
					);
				} else {
					const reader = new FileReader();
					reader.onload = (event) => {
						if (event.target?.result) {
							handleOpenTrackModal(
								{ x: point.x - 100, y: point.y - 100 },
								undefined,
								{
									title: fileName,
									audioSource: event.target.result as string,
									sourceType: 'local',
								},
							);
						}
					};
					reader.readAsDataURL(audioFile);
				}
			}
		},
		[handleOpenTrackModal],
	);

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
