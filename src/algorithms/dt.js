/**
 * @module
 */

/**
 * Distance transform - An image procesing technique.
 * Rosenfeld and Pfaltz 1968 algorithm
 * @author bames
 * @see: http://homepages.inf.ed.ac.uk/rbf/HIPR2/distance.htm
 * 
 * Roughly 20-40 cpu without visuals
 * Scores are largest at center of clearance.
 * @param {string} roomName - Room name to perform transform of
 * @param {Function} [rejector] - Filter to mark positions as obstructed
 * 
 * @example:
 * 		Time.measure( () => distanceTransform('W5N2', (x,y,r) =>  Game.map.getTerrainAt(x, y,r) == 'wall' || new RoomPosition(x,y,r).hasObstacle() ))
 */
export default function distanceTransform(roomName, rejector = (x, y, roomName) => false) {
	var vis = new RoomVisual(roomName);
	var topDownPass = new PathFinder.CostMatrix();
	var x, y;
	const terrain = Game.map.getRoomTerrain(roomName);

	for (y = 0; y < 50; ++y) {
		for (x = 0; x < 50; ++x) {
			if ((terrain.get(x, y) & TERRAIN_MASK_WALL) || rejector(x, y, roomName)) {
				topDownPass.set(x, y, 0);
			}
			else {
				topDownPass.set(x, y,
					Math.min(topDownPass.get(x - 1, y - 1), topDownPass.get(x, y - 1),
						topDownPass.get(x + 1, y - 1), topDownPass.get(x - 1, y)) + 1);
			}
		}
	}

	var value;
	for (y = 49; y >= 0; --y) {
		for (x = 49; x >= 0; --x) {
			value = Math.min(topDownPass.get(x, y),
				topDownPass.get(x + 1, y + 1) + 1, topDownPass.get(x, y + 1) + 1,
				topDownPass.get(x - 1, y + 1) + 1, topDownPass.get(x + 1, y) + 1);
			topDownPass.set(x, y, value);
			// vis.circle(x, y, {radius:value/25});
			// if (value > 0)
			//	vis.text(value, x, y);
		}
	}

	return topDownPass;
};