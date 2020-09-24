/**
 * 
 * @param {*} sortBy 
 * @param {*} order 
 */
export function events(sortBy = 'event', order = ['asc']) {
	const allEvents = _(Game.rooms).map(r => r.events).flatten().value();
	const lookup = _(global).pick((v, k) => k.startsWith('EVENT_') && !k.startsWith('EVENT_ATTACK_TYPE') && !k.startsWith('EVENT_HEAL_TYPE')).invert().value();
	const sorted = _.sortByOrder(allEvents, sortBy, order);
	for (const event of sorted) {
		event.eventName = lookup[event.event];
		event.object = Game.getObjectById(event.objectId);
		if (!event.data)
			continue;
		if (event.data.targetId) {
			event.target = Game.getObjectById(event.data.targetId);
			delete event.data.targetId;
		}

	}
	const head = `<th>Event</th><th>Object</th><th>Pos</t><th>Target</th><th>Data</th>`;
	const rows = _.map(sorted, r => `<tr><td>${r.eventName || r.event || '-'}</td><td>${r.object || '-'}</td><td>${(r.object && r.object.pos) || '-'}</td><td>${r.target || '-'}</td><td>${JSON.stringify(r.data)}</td></tr>`);
	return `<table style='width: 70vw'><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table`;
}