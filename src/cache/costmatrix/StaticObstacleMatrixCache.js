/**
 * 
 */
import { ENV } from '/os/core/macros';
import { Log } from '/os/core/Log';
import { VisibilityError } from '/os/core/errors';
import CostMatrixCache from '/cache/CostMatrixCache';
import StaticObstacleMatrix from '/ds/costmatrix/StaticObstacleMatrix';

export const STATIC_COST_MATRIX_EXPIRATION = ENV('cm.static_cache_expire', 7);
export const STATIC_COST_MATRIX_CACHE_SIZE = ENV('cm.static_cache_size', 300);

export const STATIC_OBSTACLE_MATRIX = new CostMatrixCache(
	(roomName) => {
		try {
			return new StaticObstacleMatrix(roomName);
		} catch (e) {
			if (e instanceof VisibilityError) {
				// @todo fix
				// Log.warn(e.stack);
			} else
				Log.error(e.stack);
		}
		return undefined;
	}, 'StaticObstacleMatrix', STATIC_COST_MATRIX_EXPIRATION, STATIC_COST_MATRIX_CACHE_SIZE
);
