import {
	fetchCoverArt,
	parseStreamUrl,
} from '@components/board/utils/embedUtils';
import { compressImageToDataUrl } from '@components/board/utils/imageCompressor';
import { sendShapeToBackAboveSections } from '@components/board/utils/shapeMapper';
import { DesktopBridge } from '@core/persistence/DesktopBridge';
import { getImageDimensions } from '@core/utils/mediaUtils';
import { ProjectService } from '@services/ProjectService';
import { SettingsService } from '@services/SettingsService';
import { useEffect } from 'react';
import { createShapeId, type Editor } from 'tldraw';

/**
 * Custom hook handling global clipboard paste events for audio streams, audio files, and images.
 * @param editorRef Ref to tldraw Editor instance.
 */
export function useBoardPaste(editorRef: React.RefObject<Editor | null>): void {
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
	}, [editorRef]);
}
