/** visual.hud.js - Show on screen stats */
'use strict';

/* global BUCKET_MAX */

exports.drawEmpireVisuals = function () {
	const visual = new RoomVisual();
	visual.pie(Game.cpu.bucket, BUCKET_MAX, 'Bucket', 'red', 0);
	visual.pie(Game.gcl.progress, Game.gcl.progressTotal, 'GCL', 'green', 1);
};

exports.drawConstructionProgress = function () {
	if (_.isEmpty(Game.constructionSites))
		return;
	const visual = new RoomVisual();
	const buildProgress = _.sum(Game.constructionSites, 'progress');
	const buildProgressTotal = _.sum(Game.constructionSites, 'progressTotal');
	visual.pie(buildProgress, buildProgressTotal, 'Build', 'green', 2);
};

exports.drawConstructionSites = function () {
	_.invoke(Game.constructionSites, 'draw');
};

exports.drawRoomVisuals = function () {
	var { energyAvailable, energyCapacityAvailable } = this;
	this.visual.pie(energyAvailable, energyCapacityAvailable, "Energy", "#FFDF2E", 3);

	var { level, progress, progressTotal } = this.controller;
	if (level < MAX_ROOM_LEVEL)
		this.visual.pie(progress, progressTotal, 'RCL', 'green', 4);
};