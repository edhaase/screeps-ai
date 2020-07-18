/**
 * 
 */
'use strict';

import FixedObstacleMatrix from './FixedObstacleMatrix';

export default class ConstructionSiteMatrix extends FixedObstacleMatrix {
	constructor(roomName) {
		super(roomName);
		this.addConstructionPlan();
	}
}