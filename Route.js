/**
 * Route.js
 *
 * High level route planning and caching.
 * 
 * @TODO: Make scout unit mark RCL 3+ rooms I don't control as 'avoid'. Might screw up attack plan though.
 * @example JSON.stringify(Transport.newPlan('E57S47', 'E58S48'))
 *
 * @todo: room cost per type (block attacks against allies, but not against a 'trusted' player) 
 */
'use strict';
 
global.DEFAULT_ROUTE_EXPIRATION = 150; // 150 ticks before a route expires 

global.ROUTE_PLAN_GENERIC = 0;
global.ROUTE_PLAN_ATTACK = 1;
global.ROUTE_PLAN_LOGISTICS = 2;

// Memory.rooms[roomName].avoid
class AbstractRouteScore
{ 
	constructor() {
		
	}
	
	routeCallback(from, to) {
		 throw new Error("Abstract clas called")
	}	
}

class RouteScore extends AbstractRouteScore
{
	constructor(dest) {
		super();		
		if(!_.isString(dest))
			throw new TypeError("RouteScore constructor expected destination room name");
		this.dest = dest;
	}
	
	routeCallback(roomName, fromRoom) {			
		// if(Game.map.isRoomProtected(roomName))		
		let score = 2;
		let avoid = _.get(Memory, 'routing.avoid', []);
		
		if(_.contains(avoid, roomName)) {
			// console.log('room ' + roomName + ' blocked for routing');
			score = Infinity;
		} else if(!Game.map.isRoomAvailable(roomName) ) {
			return Infinity;
		} else {
			let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
			let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
			let isMyRoom = _.get(Game.rooms, roomName + '.controller.my', false);								
			// abs % 10 avoid room center?	
			if (isHighway || isMyRoom)
				score = 1;
		}
		
		// avoid rooms under threat?
		if(Game.rooms[roomName] && Game.rooms[roomName].isOnHighAlert())
			score += 3.0;
		
		// if room is under threat, raise cost to consider avoiding the room
		// consider average terrain type
		return score + Game.map.getRoomLinearDistance(this.dest, roomName);
	}
	
}

/**
 * Room conditions:
 *   Newbie walls - complete inaccessible
 *   Allied rooms - inaccessible, attack block, 
 */
class Route
{
	/**
	 * Used by walk state, high level route plan
	 * with checks for same-room
	 * findRoute('E57S47', 'E59S42')
	 * Route.findRoute('E57S47', 'E54S47')
	 * E58S47,E58S48,E59S48,E60S48,E60S47,E60S46,E60S45,E60S44,E60S43,E60S42,E59S42
	 */
	static findRoute(from, to, rs) {
		let avoid = _.get(Memory, 'routing.avoid', []);
		if(_.contains(avoid, to)) {
			Log.warn('Trying to route to unreachable room ' + from + ' ==> ' + to);
			return ERR_NO_PATH;
		}
		if(from === to) return [from];	 // if we're not leaving the room, return the same room.	
		if(!rs || !rs.routeCallback)
			rs = new RouteScore(to);		
		let route = Game.map.findRoute(from, to, { routeCallback: (a,b) => rs.routeCallback(a,b) } );
		return (route == ERR_NO_PATH)?ERR_NO_PATH:_.map(route, 'room');				
	}
	
	// Wrap pathfinder results in lodash chain for AWESOME STUFF.
	static findPath(from, to) {
		let p = ERR_NO_PATH;
		if(p === ERR_NO_PATH)
			return p;
		return _(p);
	}
	
	
	// adjustObstacleMatrix(roomPos, )
	
	/**
	 * Reduce PathFinder.search results into compact list of directions.
	 * @todo May be faster with UIntArray
	 */	 
	static compact(arr) {
		// Keep first room position		
		var list = [];
		var i = 1;
		for(i=1; i<arr.length; i++) {
			var a = arr[i-1];
			var b = arr[i];			
			var dir = a.getDirectionTo(b);			
			if(a.roomName === b.roomName) // no path on borders
				list.push(dir);			
		}
		return list.join("");
	}	
		
	static block(roomName) {
		let avoid = _.get(Memory, 'routing.avoid', []);		
		avoid.push(roomName);
		_.set(Memory, 'routing.avoid', avoid);
	}	
		
	/**
	 * Set a room cost
	 */
	static setCost(roomName, cost) {
		_.set(Memory, `rooms.${roomName}.rcost`, cost);	
	}
	
	static getCost(roomName) {
		return _.get(Memory, `rooms.${roomName}.rcost`, 2);	
	}
}

module.exports = Route;
 
/*
				
function moveByPath(path) {
        if (_.isArray(path) && path.length > 0 && path[0] instanceof globals.RoomPosition) {
            var idx = _.findIndex(path, i => i.isEqualTo(this.pos));
            if (idx === -1) {
                if (!path[0].isNearTo(this.pos)) {
                    return C.ERR_NOT_FOUND;
                }
            }
            idx++;
            if (idx >= path.length) {
                return C.ERR_NOT_FOUND;
            }

            return this.move(this.pos.getDirectionTo(path[idx]));
        }

        if (_.isString(path)) {
            path = utils.deserializePath(path);
        }
        if (!_.isArray(path)) {
            return C.ERR_INVALID_ARGS;
        }
        var cur = _.find(path, i => i.x - i.dx == this.pos.x && i.y - i.dy == this.pos.y);
        if (!cur) {
            return C.ERR_NOT_FOUND;
        }

        return this.move(cur.direction);
    }					
*/
// serialized path form is 4 bytes for position (or first move), then a list of directions
// but limtied to single room.
/**
 * Route plan: A <--> B
 * { A, B, route, expire }
 Origin room check
[1:04:25 AM] Blocked roomed: E58S47
[1:04:25 AM] Blocked roomed: E57S48
[1:04:25 AM] Blocked roomed: E56S46
[1:04:25 AM] Blocked roomed: E57S45
[1:04:25 AM] Blocked roomed: E58S46
 */
 
/**
 * @param {RouteCost}
 */
function routeCallbackFactory(routeCost) {
	if(!routeCost || !_.isObject(routeCost))
		throw new TypeError("RouteCallbackFactory expects RouteCost");
	
	/**
	 * @param String roomName
	 * @param String fromRoom
	 */	
	return function(roomName, fromRoom) {
		if(routeCost.isBlocked(roomName))
            return Infinity;
			        
	    let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
        let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
		let isMyRoom = _.get(Game.rooms, roomName + '.controller.my', false);			
			
        if (isHighway || isMyRoom || routeCost.shouldPrefer(roomName))
            return 1;

		if(routeCost.shouldAvoid(roomName))
            return 2.5;
                        
	    return 1;
	}
}
 
/**
 * High level room cost calculators.
 * Transport.findRoute('E57S47', 'E59S42')
 * E58S47,E59S47,E59S46,E59S45,E59S44,E59S43,E59S42
 */
 	/**
	 * Which room should we avoid?
	 * 	Might include SK rooms if we have work parts.
	 *  Might include friendly rooms if we have attack parts
	 */
/* class RouteCost
{	
	isBlocked(roomName) {
		return Radar.isRoomProtected(roomName)
			|| _.get(Memory, 'routing.blocked.' + roomName, false);
	}
	
	// allow room avoidance to expire!
	// consider avoiding SK rooms if we have work parts!

	shouldAvoid(roomName) {		
		return _.get(Memory, 'routing.avoid.' + roomName, false);
	}
	
	shouldPrefer(roomName) {
		return _.get(Memory, 'routing.prefer.' + roomName, false);
	}
} */

/**
 *
 */ 
module.exportsA = {
	/** cpu: high */
	// findRoute: (from,to) => _.map(Game.map.findRoute(from, to, routeCallbackFactory(new RouteCost())), 'room'),
	
	
	// A: A,
    /**
     * @todo: support array of positions?
     */
	// JSON.stringify(Transport.findPath(Game.spawns.Spawn1, new RoomPosition(23, 37, 'E57S46')))
    findPath: function(fromPos, toPos, opts = null) {
		if(fromPos.pos) fromPos = fromPos.pos;
		if(toPos.pos) toPos = toPos.pos;
		
		var plan, route;
		// if(fromPos.roomName != toPos.roomName) {			
		var plan = this.plan(fromPos.roomName, toPos.roomName);
		var route = plan.route;
		console.log(JSON.stringify(plan));
        var path = PathFinder.search(fromPos, toPos, {
            roomCallback: function(roomName) {
				if(plan.A == plan.B && plan.B == fromPos.roomName) {
					console.log("No room movement");
					return;
				}
				if(fromPos.roomName == roomName) {
					console.log("Origin room check");
					return;
				}
				
                if(plan.rooms[roomName] === undefined) {
					console.log("Blocked roomed: " + roomName);
                    return false;				
				}
            }
        });
		// we get back an array of RoomPositions.
		// getDirectionTo to convert to short of positions.
		// lzw or rle to cache?
		return path; // Room.serializePath(path.path);
    },
	
	/**
	 * [RoomPosition]
	 * JSON.stringify(Transport.serialize(Transport.findPath(Game.spawns.Spawn1, new RoomPosition(23, 37, 'E57S46')).path))
	 * "2222222222222222222223222223333322518888888887777776677888"
	 * '2222222222222222222223222223333322518888888887777776677888'.charAt(pathPos)
	 */
	serialize: function(arr) {
		// Keep first room position
		var list = [];
		for(i=1; i<arr.length; i++) {
			a = arr[i-1];
			b = arr[i];
			list.push(a.getDirectionTo(b));
		}
		return list.join("");
	},
		
	// _(Game.flags).filter({color: COLOR_BLUE, secondaryColor: COLOR_RED}).invoke('remove')
	invertPath: function(str) {
		// 1+(direction+3)%8
		return _.map(str, d => 1+(d+3)%8 ).join("");
	},
	// Doesn't with with Room.desearilizePath
	// We can either store it in creep memory and follow it,
	// or we can store it in Transport memory and creep needs reference path.
	// but then we can invalidate the entire path? except we still sort of can.
	// "18252222222222222222222223222223333322518888888887777776677888"
	// store path as 3 bits?
	
	/**
	 * Shorter path
	 */
	seek: function(fromPos, toPos, opts) {
		
	},
	/* seek: function(fromPos, toPos, opts) {
		var plan;
		if(fromPos.roomName != toPos.roomName)
			plan = this.plan(fromPos.roomName, toPos.roomName);
		}
		
		return fromPos.findPath(toPos, {
		
		});
	},	*/
     
	/**
	 * Plan and cache a high-level room to room plan.
	 */
	plan: function(fromRoom, toRoom, expires = DEFAULT_ROUTE_EXPIRATION) {
	    if(!Memory.routing)
	        this.reset();
	    
	    if(Game.time % 5) {
	        // Purge old routes periodcally
			// Don't do this here, do this as part of the game loop, otherwise
			// multiple creeps may trigger this at once.
	        _.remove(Memory.routing.routes, function(route) {
	            return (Game.time >= route.expire);
	        });
	    }
	        
		// First check if we have a plan to return.
		// No need to reverse, or call with reversed parameters.
		// We're just using this to check what rooms are accessible, and that
		// should be the same for either direction.
	    var route = this.getPlan(fromRoom, toRoom);
	    
		if(!route) {
			console.log("[TRANSIT] New route plan");
            route = this.newPlan(fromRoom, toRoom, expires);
            Memory.routing.routes.push(route);
		}
		return route;
	},
	
	/**
	 * 
	 */
	hasPlan: function(fromRoom, toRoom) {
	    return (this.getPlan(fromRoom, toRoom) !== null);
	},
	
	
	/**
	 * Returns true if we have a plan that matches source or destination
	 */
	getPlan: function(fromRoom, toRoom) {
	    return _.find(Memory.routing.routes, function(route) {
            return (route.A == fromRoom && route.B == toRoom)
                || (route.B == fromRoom && route.A == toRoom);
		});
	},
	
	/**
	 * High level routing.
	 */
	newPlan: function(fromRoom, toRoom, expires = DEFAULT_ROUTE_EXPIRATION) {
	    var route = Game.map.findRoute(fromRoom, toRoom, { routeCallback: module.exports.routeCallback});
        return {
            A: fromRoom,
            B: toRoom,
            expires: Game.time + expires,
            route: route,
            rooms: _.reduce(route, function(obj, part) {
                obj[part.room] = 1;
                return obj;
            }, {})
        };
	},
	
    routeCallback: function(roomName) {
		throw new Error('Old routeCallback call');
        if(Memory.routing.avoid[roomName] || Game.map.isRoomProtected(roomName))
            return Infinity;
			        
        // console.log("Callback: " + roomName);			        
	    let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
        let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
        let isMyRoom =  Game.rooms[roomName] && 
                        Game.rooms[roomName].controller && 
                        Game.rooms[roomName].controller.my;
        if (isHighway || isMyRoom || Memory.routing.prefer[roomName])
            return 1;
        else
            return 2.5;
                        
	    return 1;
    },
	
	/**
	 * Add room to avoidance, invalid pathing
	 */
	avoid: function(roomName) {
	   console.log("[ROUTING] Avoiding room " + roomName);
       // Memory.routing.avoid.push(roomName);
	   Memory.routing.avoid[roomName] = 1;
	   this.invalidate(roomName);
	},
	
	
	
	prefer: function(roomName) {
		
	},
	
	
	/**
	 * Invalidate all plans containing a given room.
	 */
	invalidate: function(roomName) {
	    if(!roomName) {
	        console.log("[ROUTING] Invalidating all cached routes");
	        Memory.routing.routes = [];
	    } else {
	        console.log("[ROUTING] Invaliding cached routes for room " + roomName);
	        var rem = _.remove(Memory.routes, function(route) {
			    if( (route.A == roomName || route.B == roomName) )
			        return true;
			    return _.find(route.route, 'room', roomName) !== null;
		    });
			console.log("[ROUTING] Removed " + rem.length + " cached routes!");
	    }
	},
	
	/**
	 * Clear routing
	 */
	clear: function() {
	    delete Memory.routing;
	},
	
	/**
	 * Reset routing
	 */
	reset: function() {
	    this.clear();
	    Memory.routing  = {
	            avoid: {},
	            prefer: {},
	            routes: []
	        };
	}
	
	
};;