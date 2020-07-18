/**
 * 
 */
'use strict';

import RoomCostMatrix from './RoomCostMatrix';
import { VisibilityError } from  '/os/core/errors';

export default class EnclosureTestingMatrix extends RoomCostMatrix {
	constructor(roomName) {
		super(roomName);
		const room = Game.rooms[roomName];
		if (!room)
			throw new VisibilityError(roomName);
		this.setRoads(room); // Need to include roads due to tunnels
		this.setStructureType(room, STRUCTURE_RAMPART, 255);
		this.setStructureType(room, STRUCTURE_WALL, 255);
	}
}