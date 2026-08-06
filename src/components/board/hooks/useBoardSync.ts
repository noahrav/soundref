import {
	fetchCoverArt,
	parseStreamUrl,
} from '@components/board/utils/embedUtils';
import { toRichText } from '@components/board/utils/richText';
import {
	createShapeFromDomainItem,
	extractNoteContent,
	shapeToDomainPayload,
} from '@components/board/utils/shapeMapper';
import { ImageItem } from '@core/model/item/ImageItem';
import { SectionItem } from '@core/model/item/SectionItem';
import { StickyNoteItem } from '@core/model/item/StickyNoteItem';
import { TextItem } from '@core/model/item/TextItem';
import { TrackItem } from '@core/model/item/TrackItem';
import { ProjectService } from '@services/ProjectService';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
	createShapeId,
	type Editor,
	PageRecordType,
	type TLShapeId,
} from 'tldraw';

/**
 * Custom hook encapsulating tldraw editor initialization, auto-sync with persistent storage,
 * and domain refresh following undo/redo actions.
 */
export function useBoardSync(
	editorRef: React.MutableRefObject<Editor | null>,
	initialProjectId: string | undefined,
	activeProjectId: string | undefined,
	setActiveProjectId: (id: string) => void,
) {
	const { t } = useTranslation();
	const service = ProjectService.instance();

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
										createShapeFromDomainItem(editor, item, shapeId);
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
									const payload = shapeToDomainPayload(shape);
									if (payload) {
										itemsToSync.push(payload);
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
		[editorRef, initialProjectId, setActiveProjectId, service, t],
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
					createShapeFromDomainItem(editor, item, shapeId);
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
	}, [activeProjectId, editorRef, service]);

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

	return { handleMount, refreshEditorFromDomain };
}
