/**
 * @module
 */
import StaticObstacleMatrix from './StaticObstacleMatrix';
import RoomCostMatrix from './RoomCostMatrix';

/**
 * @class
 */
export default class ConstructionSiteMatrix extends StaticObstacleMatrix {
	constructor(roomName) {
		super(roomName);
		if (!_.isString(roomName))
			throw new TypeError("ConstructionSiteMatrix expects roomName string");
		const room = Game.rooms[roomName];
		if (!room)
			throw new VisibilityError(roomName);
		// don't forget enemy non-public ramparts!		
		this.setRoads(room, 1);
		this.setStructureType(room, STRUCTURE_CONTAINER, 1);
		this.setFixedObstacles(room);
		this.setDynamicObstacles(room);
		this.setSKLairs(room);
		this.setExitTiles(room, 5);
		this.setPortals(room);
		if (room.controller) // @todo if not a wall..
			this.applyInRoomRadius((x, y) => this.set(x, y, 1), room.controller.pos, 3);
		this.addConstructionPlan();
	}
}