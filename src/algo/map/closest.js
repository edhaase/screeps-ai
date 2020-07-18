/**
 * 
 */
'use strict';

import RouteCache from '/cache/RouteCache';

export function findClosestRoomByRoute(start, candidates, opts) {
	// @todo fix and improve
	const filter = (opts && opts.filter) || ((x) => true);
	const filteredCandidates = _.reject(candidates, r => Game.map.getRoomLinearDistance(start, r, false) >= 7 || !filter(r));
	const routes = _.map(filteredCandidates, r => RouteCache.findRoute(start, r, opts));
	const filtered = _.reject(routes, r => r == ERR_NO_PATH || r == null);
	if (!filtered || !filtered.length)
		return [null, null];
	const result = _.min(filtered, r => r.length);
	if (result.length <= 0)
		return [start, 0];
	// console.log(`s ${start} c ${candidates} r ${result}  ${JSON.stringify(result)}`);
	const last = result[result.length - 1];
	return [last.room, result.length];
}