import type { PlayingTrackData } from '@core/audio/audioPlayerStore';
import { audioPlayer } from '@core/audio/audioPlayerStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@core/persistence/DesktopBridge', () => ({
	DesktopBridge: {
		isTauri: vi.fn(() => false),
	},
}));

vi.mock('@core/utils/mediaUtils', () => ({
	getLocalMediaUrl: vi.fn((path: string) => path),
	getBlobUrlForFile: vi.fn(async () => null),
}));

vi.mock('@core/utils/WaveformService', () => ({
	getOrExtractWaveformPeaks: vi.fn(async () => [0.1, 0.5, 0.8, 0.2]),
}));

describe('AudioPlayerStore (P6)', () => {
	beforeEach(() => {
		audioPlayer.stop();
		vi.clearAllMocks();
	});

	it('should return default initial state when stopped', () => {
		const state = audioPlayer.getState();
		expect(state.currentTrack).toBeNull();
		expect(state.isPlaying).toBe(false);
		expect(state.currentTime).toBe(0);
		expect(state.duration).toBe(0);
	});

	it('should play a track and update state', async () => {
		const track: PlayingTrackData = {
			id: 'track-1',
			title: 'Test Song',
			imageUrl: 'cover.jpg',
			audioSource: 'test.mp3',
			sourceType: 'local',
			playMode: 'oneshot',
		};

		await audioPlayer.playTrack(track);

		const state = audioPlayer.getState();
		expect(state.currentTrack).toEqual(track);
		expect(state.isPlaying).toBe(true);
	});

	it('should toggle play and pause on the current track', async () => {
		const track: PlayingTrackData = {
			id: 'track-1',
			title: 'Test Song',
			imageUrl: 'cover.jpg',
			audioSource: 'test.mp3',
			sourceType: 'local',
			playMode: 'oneshot',
		};

		await audioPlayer.playTrack(track);
		expect(audioPlayer.getState().isPlaying).toBe(true);

		audioPlayer.togglePlayPause();
		expect(audioPlayer.getState().isPlaying).toBe(false);

		audioPlayer.togglePlayPause();
		expect(audioPlayer.getState().isPlaying).toBe(true);
	});

	it('should stop playback and reset track state', async () => {
		const track: PlayingTrackData = {
			id: 'track-1',
			title: 'Test Song',
			imageUrl: 'cover.jpg',
			audioSource: 'test.mp3',
			sourceType: 'local',
			playMode: 'oneshot',
		};

		await audioPlayer.playTrack(track);
		audioPlayer.stop();

		const state = audioPlayer.getState();
		expect(state.currentTrack).toBeNull();
		expect(state.isPlaying).toBe(false);
		expect(state.currentTime).toBe(0);
		expect(state.duration).toBe(0);
	});

	it('should seek to specified timestamp', async () => {
		const track: PlayingTrackData = {
			id: 'track-1',
			title: 'Test Song',
			imageUrl: 'cover.jpg',
			audioSource: 'test.mp3',
			sourceType: 'local',
			playMode: 'oneshot',
		};

		await audioPlayer.playTrack(track);
		audioPlayer.seekTo(42);

		expect(audioPlayer.getState().currentTime).toBe(42);
	});

	it('should notify subscribers on state change', async () => {
		const listener = vi.fn();
		const unsubscribe = audioPlayer.subscribe(listener);

		const track: PlayingTrackData = {
			id: 'track-1',
			title: 'Test Song',
			imageUrl: 'cover.jpg',
			audioSource: 'test.mp3',
			sourceType: 'local',
			playMode: 'oneshot',
		};

		await audioPlayer.playTrack(track);
		expect(listener).toHaveBeenCalled();

		unsubscribe();
		listener.mockReset();

		audioPlayer.stop();
		expect(listener).not.toHaveBeenCalled();
	});

	it('should force playMode to oneshot when sourceType is stream', async () => {
		const track: PlayingTrackData = {
			id: 'stream-1',
			title: 'Stream Song',
			imageUrl: 'cover.jpg',
			audioSource: 'https://stream.url',
			sourceType: 'stream',
			playMode: 'loop',
		};

		await audioPlayer.playTrack(track);

		const state = audioPlayer.getState();
		expect(state.currentTrack?.playMode).toBe('oneshot');
	});

	it('should allow concurrent playback on different channels', async () => {
		const trackA: PlayingTrackData = {
			id: 'track-a',
			shapeId: 'shape-a',
			title: 'Track A',
			imageUrl: '',
			audioSource: 'songA.mp3',
			sourceType: 'local',
			playMode: 'oneshot',
			channelId: 'master',
		};

		const trackB: PlayingTrackData = {
			id: 'track-b',
			shapeId: 'shape-b',
			title: 'Track B',
			imageUrl: '',
			audioSource: 'songB.mp3',
			sourceType: 'local',
			playMode: 'oneshot',
			channelId: 'ch-1',
		};

		await audioPlayer.playTrack(trackA);
		await audioPlayer.playTrack(trackB);

		expect(audioPlayer.isTrackPlaying('shape-a')).toBe(true);
		expect(audioPlayer.isTrackPlaying('shape-b')).toBe(true);
		expect(audioPlayer.getState().playingTracks.length).toBe(2);
	});

	it('should stop playback on the same channel when a new track is played', async () => {
		const trackB: PlayingTrackData = {
			id: 'track-b',
			shapeId: 'shape-b',
			title: 'Track B',
			imageUrl: '',
			audioSource: 'songB.mp3',
			sourceType: 'local',
			playMode: 'oneshot',
			channelId: 'ch-1',
		};

		const trackC: PlayingTrackData = {
			id: 'track-c',
			shapeId: 'shape-c',
			title: 'Track C',
			imageUrl: '',
			audioSource: 'songC.mp3',
			sourceType: 'local',
			playMode: 'oneshot',
			channelId: 'ch-1',
		};

		await audioPlayer.playTrack(trackB);
		expect(audioPlayer.isTrackPlaying('shape-b')).toBe(true);

		await audioPlayer.playTrack(trackC);
		expect(audioPlayer.isTrackPlaying('shape-b')).toBe(false);
		expect(audioPlayer.isTrackPlaying('shape-c')).toBe(true);
	});
});
