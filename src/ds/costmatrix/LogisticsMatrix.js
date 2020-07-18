/** /ds/costmatrix.logistics */
'use strict';

//  import RoomCostMatrix from './RoomCostMatrix';
import FixedObstacleMatrix from './FixedObstacleMatrix';
import { VisibilityError } from  '/os/core/errors';

const TILE_UNWALKABLE = 255;

/**
 * Logistics matrix roughly combines obstacle matrix with road matrix
 * to find optimal shipping lane.
 */
export default class LogisticsMatrix extends FixedObstacleMatrix {
	/**
	 * @param {string} roomName 
	 * @throws Error
	 */
	constructor(roomName) {
		super(roomName);
		const room = Game.rooms[roomName];
		if (!room)
			throw new VisibilityError(roomName);
		if (room.controller) // @todo if not a wall..
			this.applyInRoomRadius((x, y) => this.set(x, y, 1), room.controller.pos, 3);
		// Account for safe mode.
		// this.setCreeps(room, TILE_UNWALKABLE, () => true, FIND_HOSTILE_CREEPS);
		for (const c of room.hostiles) {
			this.set(c.pos.x, c.pos.y, TILE_UNWALKABLE);
			this.applyInRoomRadius((x, y) => this.set(x, y, 10), c.pos, CREEP_RANGED_ATTACK_RANGE);
		}
		this.setCreeps(room, TILE_UNWALKABLE, () => true, FIND_HOSTILE_CREEPS);
		this.setCreeps(room, TILE_UNWALKABLE, () => true, FIND_HOSTILE_POWER_CREEPS);
		this.setCreeps(room, TILE_UNWALKABLE, (c) => c.memory.stuck > 3, FIND_MY_CREEPS);
		this.setCreeps(room, TILE_UNWALKABLE, (c) => c.memory.stuck > 3, FIND_MY_POWER_CREEPS);
		this.setPortals(room, 254);
	}
}