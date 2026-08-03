import { BoardItem } from '@core/model/item/BoardItem';
import { Position } from '@core/model/Position';

/**
 * Interface defining loop boundary timestamps in seconds.
 */
export interface LoopRegion {
	/** Loop region start timestamp in seconds */
	start: number;
	/** Loop region end timestamp in seconds */
	end: number;
}

/**
 * Domain model representing an audio track card item on the canvas board.
 */
export class TrackItem extends BoardItem {
	/** Serialized type discriminant */
	public readonly type: string = 'TrackItem';

	/**
	 * Creates a TrackItem instance.
	 * @param position Canvas coordinates.
	 * @param title Track display title.
	 * @param imageUrl Cover artwork URL.
	 * @param audioSource Audio file path or streaming web URL.
	 * @param sourceType Audio source type ('local' file or 'stream' URL).
	 * @param playMode Playback mode ('oneshot' or 'loop').
	 * @param loopRegion Optional loop region start and end timestamps.
	 * @param id Optional explicit UUID.
	 * @param scale Visual scale factor.
	 * @param width Card width in pixels.
	 */
	constructor(
		position: Position = new Position(),
		public title: string = 'Track',
		public imageUrl: string = '',
		public audioSource: string = '',
		public sourceType: 'local' | 'stream' = 'local',
		public playMode: 'oneshot' | 'loop' = 'oneshot',
		public loopRegion: LoopRegion = { start: 0, end: 0 },
		id?: string,
		public scale: number = 1,
		public width: number = 200,
	) {
		super(position, id);
	}
}
