/**
 * @module
 */

import StaticObstacleMatrix from './StaticObstacleMatrix';
import { VisibilityError } from '/os/core/errors';
import { TILE_UNWALKABLE } from '/ds/CostMatrix';

/**
 * @classdesc Logistics matrix roughly combines obstacle matrix with road matrix
 * to find optimal shipping lane.
 */
export default class LogisticsMatrix extends StaticObstacleMatrix {
	/**
	 * @param {string} roomName 
	 * @throws Error
	 */
	constructor(roomName) {
		super(roomName);
		const room = Game.rooms[roomName];
		if (!room)
			throw new VisibilityError(roomName);
		// if (room.controller) // @todo if not a wall..
		//	this.applyInRoomRadius((x, y) => this.set(x, y, 1), room.controller.pos, 3);
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

	/**
	 * Clone an existing matrix and apply our values
	 */
	static from(staticMatrix, roomName) {
		const room = Game.rooms[roomName];
		if (!room)
			throw new VisibilityError(roomName);
		const newMatrix = staticMatrix.clone();
		// Account for safe mode.
		// this.setCreeps(room, TILE_UNWALKABLE, () => true, FIND_HOSTILE_CREEPS);
		for (const c of room.hostiles) {
			newMatrix.set(c.pos.x, c.pos.y, TILE_UNWALKABLE);
			newMatrix.applyInRoomRadius((x, y) => newMatrix.set(x, y, 10), c.pos, CREEP_RANGED_ATTACK_RANGE);
		}
		newMatrix.setCreeps(room, TILE_UNWALKABLE, () => true, FIND_HOSTILE_CREEPS);
		newMatrix.setCreeps(room, TILE_UNWALKABLE, () => true, FIND_HOSTILE_POWER_CREEPS);
		newMatrix.setCreeps(room, TILE_UNWALKABLE, (c) => c.memory.stuck > 3, FIND_MY_CREEPS);
		newMatrix.setCreeps(room, TILE_UNWALKABLE, (c) => c.memory.stuck > 3, FIND_MY_POWER_CREEPS);
		newMatrix.setPortals(room, 254);
		return newMatrix;
	}
}