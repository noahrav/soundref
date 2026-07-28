import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Editor, PageRecordType, type TLShapeId, Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { ProjectService } from '../../api/ProjectService';
import type { StickyNoteItem } from '../../core/model/item/StickyNoteItem';
import './board.scss';
import { BoardToolbar } from './components/BoardToolbar';
import { PageTabs } from './components/PageTabs';
import { uiComponents } from './config/ui-components';
import { uiOverrides } from './config/ui-overrides';
import { fromRichText, toRichText } from './utils/richText';

interface BoardProps {
	projectId?: string;
	onBackToProjects?: () => void;
}

function extractNoteContent(props: any): string {
	if (!props) return '';
	if (typeof props.text === 'string' && props.text) return props.text;
	if (props.richText) {
		const rich = fromRichText(props.richText);
		if (rich) return rich;
	}
	return props.text || '';
}

export default function Board({
	projectId: initialProjectId,
	onBackToProjects,
}: BoardProps) {
	const { i18n, t } = useTranslation();
	const [activeProjectId, setActiveProjectId] = useState<string | undefined>(
		initialProjectId,
	);
	const service = ProjectService.instance();

	const handleMount = useCallback(
		(editor: Editor) => {
			editor.user.updateUserPreferences({ inputMode: 'mouse' });
			editor.updateInstanceState({ isGridMode: true });
			editor.setCameraOptions({ wheelBehavior: 'zoom' });
			editor.setCurrentTool('select');

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
										const stickyItem = item as StickyNoteItem;
										const noteContent = stickyItem.content || '';
										editor.createShape({
											id: shapeId,
											type: 'note',
											x: item.position.x,
											y: item.position.y,
											props: {
												color: 'yellow',
												richText: toRichText(noteContent),
											},
										});
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

						const syncCurrentPageItemsToDisk = () => {
							if (shapeSyncDebounceTimer) clearTimeout(shapeSyncDebounceTimer);
							shapeSyncDebounceTimer = setTimeout(() => {
								const currentPageId = editor.getCurrentPageId();
								const cleanWsId = currentPageId.replace(/^page:/, '');
								const pageShapes = editor.getCurrentPageShapes();

								const itemsToSync: Array<{
									id: string;
									x: number;
									y: number;
									content: string;
								}> = [];
								pageShapes.forEach((shape) => {
									if (shape.type === 'note') {
										const cleanId = shape.id.replace(/^shape:/, '');
										const content = extractNoteContent(shape.props);
										itemsToSync.push({
											id: cleanId,
											x: shape.x,
											y: shape.y,
											content,
										});
									}
								});

								service
									.syncWorkspaceItems(targetProjectId, cleanWsId, itemsToSync)
									.catch((err) =>
										console.warn('[Board] Could not sync items:', err),
									);
							}, 200);
						};

						editor.store.listen((entry) => {
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
								}, 200);
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

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				autoFocus
				colorScheme="system"
				locale={i18n.language}
				components={uiComponents}
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
				/>
				<BoardToolbar />
			</Tldraw>
		</div>
	);
}
