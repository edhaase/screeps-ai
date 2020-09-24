/**
 * @module
 */
import RoomCostMatrix from './RoomCostMatrix';
import { VisibilityError } from '/os/core/errors';

export const DEFAULT_CONTAINER_SCORE = 6;

/**
 * @classdesc The fixed obstacle matrix stores a position of obstacles in the world
 * that don't change often. Walls, structures, etc.
 */
export default class StaticObstacleMatrix extends RoomCostMatrix {
	constructor(roomName) {
		super(roomName);
		if (!_.isString(roomName))
			throw new TypeError("StaticObstacleMatrix expects roomName string");
		const room = Game.rooms[roomName];
		if (!room)
			throw new VisibilityError(roomName);
		// don't forget enemy non-public ramparts!		
		this.setRoads(room);
		this.setStructureType(room, STRUCTURE_CONTAINER, DEFAULT_CONTAINER_SCORE);
		this.setFixedObstacles(room);
		this.setDynamicObstacles(room);
		this.setSKLairs(room);
		this.setExitTiles(room, 5);
		this.setPortals(room);
		if (room.controller) // @todo if not a wall..
			this.applyInRoomRadius((x, y) => this.set(x, y, 1), room.controller.pos, 3);
	}
}