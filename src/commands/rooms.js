import * as Cmd from '/os/core/commands';
import { Log } from '/os/core/Log';

const CMD_CATEGORY = 'Rooms';

/**
 * @param {*} roomName 
 * @param {*} fn 
 */
function wroom(roomName, fn = () => true, allowScouts = true) {			// with room
	const recon = startService('recon');
	if (!recon)
		return Log.warn(`No recon process running`);
	const future = recon.request(roomName, undefined, allowScouts);
	return future.complete((room, err) => fn(room, err));
};

/**
 *
 */
function releaseRoom(roomName, confirm = false) {
	if (confirm !== true)
		return "Confirmation required";
	_(Game.flags).filter('pos.roomName', roomName).invoke('remove').commit();
	_(Game.structures).filter('pos.roomName', roomName).invoke('destroy').commit();
	_(Game.creeps).filter('pos.roomName', roomName).invoke('suicide').commit();
};

/**
 * @param {*} roomName 
 */
function resetRoom(roomName) {
	var room = Game.rooms[roomName];
	room.find(FIND_FLAGS).forEach(f => f.remove());
	room.find(FIND_STRUCTURES).forEach(s => s.destroy());
	room.find(FIND_MY_CREEPS).forEach(c => c.suicide());
	Memory.rooms[roomName] = undefined;
};

Cmd.register('releaseRoom', releaseRoom, 'Immediately unclaim a room', [], CMD_CATEGORY);
Cmd.register('resetRoom', resetRoom, 'Immediately remove all assets in room', [], CMD_CATEGORY)
Cmd.register('wroom', wroom, 'Request vision on a room and fire a callback', [], CMD_CATEGORY);