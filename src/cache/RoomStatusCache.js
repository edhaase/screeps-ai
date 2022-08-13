import { ENV } from '/os/core/macros';
import LazyLru from '/ds/LazyLru';

const DEFAULT_ROOMSTATUS_CACHE_EXPIRE = ENV('cache.roomstatus_cache_expire', 1500);
const DEFAULT_ROOMSTATUS_CACHE_SIZE = ENV('cache.roomstatus_cache_size', 1000);

export default class RoomStatusCache extends LazyLru {
	constructor(ttl = DEFAULT_ROOMSTATUS_CACHE_EXPIRE, max = DEFAULT_ROOMSTATUS_CACHE_SIZE) {
		super((roomName) => Game.map.getRoomStatus(roomName), { name: 'RoomStatusCache', ttl, max });
	}
}

export const ROOMSTATUS_CACHE = new RoomStatusCache();