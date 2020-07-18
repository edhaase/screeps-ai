/**
 * CostMatrix.js
 *
 * ES6 class support for cost matricies
 */
'use strict';



/* global ENV, Log, Player */
/* eslint-disable no-magic-numbers */

import CostMatrixCache from '/cache/CostMatrixCache';

import FixedObstacleMatrix from '/ds/costmatrix/FixedObstacleMatrix';
import LogisticsMatrix from '/ds/costmatrix/LogisticsMatrix';
import ConstructionSiteMatrix from '/ds/costmatrix/ConstructionSiteMatrix';
import { VisibilityError } from '/os/core/errors';

/**
 * 
 */
export const LOGISTICS_MATRIX = new CostMatrixCache((roomName) => {
	try {
		return (new LogisticsMatrix(roomName));
	} catch (e) {
		// @todo needs fixing
		// Log.error(e.stack);
	}
	return new PathFinder.CostMatrix;
}, 'LogisticsMatrix');
global.LOGISTICS_MATRIX = LOGISTICS_MATRIX;

export const FIXED_OBSTACLE_MATRIX = new CostMatrixCache(
	(roomName) => {
		try {
			return new FixedObstacleMatrix(roomName);
		} catch (e) {
			if (e instanceof VisibilityError) {
				// @todo fix
				// Log.warn(e.stack);
			} else
				Log.error(e.stack);
		}
		return new PathFinder.CostMatrix;
	}, 'FixedObstacleMatrix'
);

export const CONSTRUCTION_MATRIX = new CostMatrixCache((roomName) => new ConstructionSiteMatrix(roomName), 'ConstructionMatrix');