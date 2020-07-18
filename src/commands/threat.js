import * as Cmd from '/os/core/commands';

const CMD_CATEGORY = 'Threat Management';

function launchNuke(roomPos) {
	if (!roomPos)
		return `Invalid target`;
	const nuker = _.find(Game.structures, s => s.structureType === STRUCTURE_NUKER && s.ready && Game.map.getRoomLinearDistance(s.pos.roomName, roomPos.roomName, false) <= NUKE_RANGE && s.isActive());
	if (!nuker)
		return `No available nuker`;
	return nuker.launchNuke(roomPos);
}

function playerReport() {
	const intel = gpbn('intel')[0].intel.threats;
	const sorted = _.sortByOrder(Object.entries(intel), ([v, k]) => k, ['asc']);
	const head = `<th>Name</th><th>Score</th>`;
	const body = _.map(sorted, ([name, score]) => `<tr><td>${name}</td><td>${JSON.stringify(score)}</td></tr>`);
	return `<table style='width: 50vw'><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table`;
}

Cmd.register('launchNuke', launchNuke, 'Launch a nuke at a target room', [], CMD_CATEGORY);
Cmd.register('players', playerReport, 'Show players and their threat scores', [], CMD_CATEGORY);
// Cmd.register('influence', influenceReport, 'Reports on influence', [],  'Threat Management');