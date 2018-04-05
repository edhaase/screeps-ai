/**
 * Intel.js
 */
'use strict';

class Intel {
	/**
	 * Update intel for a room
	 * @param {Room} room 
	 */
	static scanRoom(room) {
		if(Room.getType(room.name) !== 'Room')
			return;	
		const {controller={}} = room;				
		const intel = {
			tick: Game.time,
			sources: room.sources.map( ({id,pos}) => ({id,pos})),
			owner: controller.owner && controller.owner.username,
			reservation: controller.reservation && controller.reservation.username,
			controller: controller.pos,
			level: controller.level
		};
		room.memory.intel = intel;
		// Log.info(`New intel report for ${room.name}: ${ex(intel)}`,'Intel');
		Log.info(`New intel report for ${room.name}`,'Intel');
	}
}

module.exports = Intel;