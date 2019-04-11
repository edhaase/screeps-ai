/**
 * Event.js
 */
'use strict';

// TODO hook any event, any room
// TODO hook specific event, any room
// TODO hook specific room event

class Event {
	static fire(ev) {
		const { event, objectId, data } = ev;
		if (data && data.targetId) {
			const target = Game.getObjectById(data.targetId);
			if (target && target.my)
				target.onEvent(ev);
		}
		// TODO dispatch other handlers
	}
}

RoomObject.prototype.onEvent = function (ev) {
	// Placeholder event
};

Creep.prototype.onEvent = function (ev) {
	if (!this.my)
		return;
	if (this.module && this.module.onEvent)
		this.module.onEvent.call(this, ev);
};

module.exports = Event;