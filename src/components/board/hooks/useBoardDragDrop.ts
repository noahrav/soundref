import type { TrackFormData } from '@components/board/components/TrackFormModal';
import { compressImageToDataUrl } from '@components/board/utils/imageCompressor';
import { sendShapeToBackAboveSections } from '@components/board/utils/shapeMapper';
import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { getImageDimensions } from '@core/utils/mediaUtils';
import { ProjectService } from '@services/ProjectService';
import { SettingsService } from '@services/SettingsService';
import { useCallback } from 'react';
import { createShapeId, type Editor } from 'tldraw';

/**
 * Custom hook returning Drag & Drop handlers for the board canvas.
 * Handles dragover and drop of image and audio files onto the whiteboard canvas.
 * @param editorRef Ref to tldraw Editor instance.
 * @param handleOpenTrackModal Callback to open track form modal.
 */
export function useBoardDragDrop(
	editorRef: React.RefObject<Editor | null>,
	handleOpenTrackModal: (
		pos?: { x: number; y: number },
		shapeToEdit?: any,
		defaultData?: Partial<TrackFormData>,
	) => void,
) {
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
		[editorRef, handleOpenTrackModal],
	);

	return { handleDragOver, handleDrop };
}
