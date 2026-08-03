import type { TLImageShape } from '@components/board/config/ImageShapeUtil';
import { useMediaUrl } from '@core/utils/mediaUtils';
import { faImage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { HTMLContainer } from 'tldraw';

/**
 * Props for ImageCardComponent.
 */
interface ImageCardComponentProps {
	/** tldraw Image shape instance */
	shape: TLImageShape;
}

/**
 * Component rendering a clean image element on the board canvas.
 * Fits images responsively inside shape bounding box using objectFit: contain without drop shadows.
 */
export function ImageCardComponent({ shape }: ImageCardComponentProps) {
	const resolvedUrl = useMediaUrl(shape.props.imageUrl);

	return (
		<HTMLContainer
			style={{
				width: shape.props.w,
				height: shape.props.h,
				pointerEvents: 'all',
			}}
		>
			<div
				style={{
					width: '100%',
					height: '100%',
					boxSizing: 'border-box',
					borderRadius: '2px',
					overflow: 'hidden',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					userSelect: 'none',
				}}
			>
				{resolvedUrl ? (
					<img
						src={resolvedUrl}
						alt="Board item"
						draggable={false}
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'contain',
							display: 'block',
							pointerEvents: 'none',
						}}
						onError={(e) => {
							e.currentTarget.style.display = 'none';
						}}
					/>
				) : (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							gap: '8px',
							color: '#888888',
							fontSize: '0.8125rem',
							fontWeight: 500,
							backgroundColor: '#f5f5f5',
							width: '100%',
							height: '100%',
							justifyContent: 'center',
							border: '1px dashed #cccccc',
						}}
					>
						<FontAwesomeIcon icon={faImage} style={{ fontSize: '1.5rem' }} />
						<span>No Image</span>
					</div>
				)}
			</div>
		</HTMLContainer>
	);
}
