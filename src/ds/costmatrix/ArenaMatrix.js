import LogisticObstacleMatrix from './LogisticObstacleMatrix';

export default class ArenaMatrix extends LogisticObstacleMatrix {
	constructor(roomName) {
		super(roomName);
		const room = Game.rooms[roomName];
		this.setExitTiles(room, 255);
	}
}