/**
 * The fixed obstacle matrix stores a position of obstacles in the world
 * that don't change often. Walls, structures, etc.
 */
import RoomCostMatrix from './RoomCostMatrix';
import { VisibilityError } from  '/os/core/errors';

export default class FixedObstacleMatrix extends RoomCostMatrix {
	constructor(roomName) {
		super(roomName);
		if (!_.isString(roomName))
			throw new TypeError("FixedObstacleMatrix expects roomName string");
		const room = Game.rooms[roomName];
		if (!room)
			throw new VisibilityError(roomName);
		// don't forget enemy non-public ramparts!		
		this.setRoads(room);
		this.setStructureType(room, STRUCTURE_CONTAINER, 1);
		this.setFixedObstacles(room);
		this.setDynamicObstacles(room);
		this.setSKLairs(room);
		this.setExitTiles(room, 5);
		this.setPortals(room);
	}
}