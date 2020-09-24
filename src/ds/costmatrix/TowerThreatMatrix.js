/**
 * @module
 */
import RoomCostMatrix from './RoomCostMatrix';
import { CLAMP } from '/os/core/math';

/**
 * @class
 */
export default class TowerThreatMatrix extends RoomCostMatrix {
	constructor(room) {
		if (_.isString(room))
			if (Game.rooms[room])
				room = Game.rooms[room];
		super(room);
		const towers = room.find(FIND_STRUCTURES, { filter: t => t.structureType === STRUCTURE_TOWER });
		for (const tower of towers)
			this.addTower(tower);
	}

	addTower(target) {
		// Just trust that this works..
		this.apply((x, y) => this.add(x, y,
			CLAMP(TOWER_OPTIMAL_RANGE,
				TOWER_FALLOFF_RANGE - target.pos.getRangeTo(x, y),
				TOWER_FALLOFF_RANGE) - TOWER_OPTIMAL_RANGE
		));
	}
}