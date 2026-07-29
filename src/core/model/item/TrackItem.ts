import { Position } from '../Position';
import { BoardItem } from './BoardItem';

export interface LoopRegion {
	start: number;
	end: number;
}

export class TrackItem extends BoardItem {
	public readonly type: string = 'TrackItem';

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
