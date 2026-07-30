import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import type { TLDefaultColorStyle } from 'tldraw';
import { type ColorOption, NOTE_COLOR_PALETTE } from '../config/colorPalette';
import './ColorPicker.scss';

/**
 * Props for ColorPicker component.
 */
export interface ColorPickerProps {
	/** Active color key */
	selectedColor?: string;
	/** Callback function triggered when a color option is selected */
	onSelectColor: (colorKey: TLDefaultColorStyle) => void;
	/** Optional custom array of color options (defaults to NOTE_COLOR_PALETTE) */
	colors?: ColorOption[];
	/** Render mode: 'inline' for color swatches row, 'menu' for list menu items */
	mode?: 'inline' | 'menu';
	/** Size in pixels for inline swatches (default: 22) */
	size?: number;
	/** Optional additional CSS class name */
	className?: string;
}

/**
 * Reusable ColorPicker component for selecting colors on board shapes,
 * sticky notes, and UI controls. Supports inline swatch row or dropdown/context menu list modes.
 */
export function ColorPicker({
	selectedColor,
	onSelectColor,
	colors = NOTE_COLOR_PALETTE,
	mode = 'inline',
	size = 22,
	className = '',
}: ColorPickerProps) {
	const { t } = useTranslation();

	if (mode === 'menu') {
		return (
			<div className={`color-picker color-picker--menu ${className}`}>
				{colors.map((c) => {
					const isActive = selectedColor === c.key;
					const label = t(`contextMenu.color_${c.key}`);
					return (
						<button
							key={c.key}
							type="button"
							className={`color-picker__menu-item ${isActive ? 'color-picker__menu-item--active' : ''}`}
							onClick={() => onSelectColor(c.key)}
						>
							<span
								className="color-picker__menu-item-dot"
								style={{ backgroundColor: c.hex }}
							/>
							<span>{label}</span>
						</button>
					);
				})}
			</div>
		);
	}

	return (
		<div className={`color-picker color-picker--inline ${className}`}>
			{colors.map((c) => {
				const isActive = selectedColor === c.key;
				const label = t(`contextMenu.color_${c.key}`);
				return (
					<button
						key={c.key}
						type="button"
						className={`color-picker__swatch ${isActive ? 'color-picker__swatch--active' : ''}`}
						onClick={() => onSelectColor(c.key)}
						title={label}
						aria-label={label}
						style={{ width: size + 4, height: size + 4 }}
					>
						<span
							className="color-picker__swatch-dot"
							style={{
								width: size,
								height: size,
								backgroundColor: c.hex,
							}}
						/>
						{isActive && (
							<FontAwesomeIcon
								icon={faCheck}
								style={{
									position: 'absolute',
									fontSize: size * 0.5,
									color: c.key === 'yellow' ? '#111111' : '#ffffff',
								}}
							/>
						)}
					</button>
				);
			})}
		</div>
	);
}
