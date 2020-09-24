/**
 * 
 */
import { ENV } from '/os/core/macros';
import { Log } from '/os/core/Log';
import { VisibilityError } from '/os/core/errors';
import CostMatrixCache from '/cache/CostMatrixCache';
import LogisticsMatrix from '/ds/costmatrix/LogisticsMatrix';

import { STATIC_OBSTACLE_MATRIX } from './StaticObstacleMatrixCache';

export const LOGISTICS_COST_MATRIX_EXPIRATION = ENV('cm.logistics_cache_expire', 1);
export const LOGISTICS_COST_MATRIX_CACHE_SIZE = ENV('cm.logistics_cache_size', 300);

export const LOGISTICS_MATRIX = new CostMatrixCache((roomName) => {
	try {
		// Leverage additional caching from the static
		const staticMatrix = STATIC_OBSTACLE_MATRIX.get(roomName);
		if (staticMatrix)
			return LogisticsMatrix.from(staticMatrix, roomName);
		// return (new LogisticsMatrix(roomName));
	} catch (e) {
		if (e instanceof VisibilityError) {
			// @todo fix
			// Log.warn(e.stack);
		} else
			Log.error(e.stack);
	}
	return new PathFinder.CostMatrix;
}, 'LogisticsMatrix', LOGISTICS_COST_MATRIX_EXPIRATION, LOGISTICS_COST_MATRIX_CACHE_SIZE);
global.LOGISTICS_MATRIX = LOGISTICS_MATRIX;
