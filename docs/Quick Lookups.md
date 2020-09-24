

List of all rooms with tunnels

`Log.info(_(Game.rooms).filter('my').filter(r => r.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_ROAD && s.pos.hasObstacle(true) }).length ).values())`