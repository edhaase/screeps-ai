import { ENV } from '/os/core/macros';
import LazyLru from '/ds/LazyLru';
import CostMatrix from '/ds/CostMatrix';

const DEFAULT_EXIT_CACHE_EXPIRE = ENV('cache.exit_cache_expire', null);
const DEFAULT_EXIT_CACHE_SIZE = ENV('cache.exit_cache_size', 2000);

export default class ExitCache extends LazyLru {
	constructor(ttl = DEFAULT_EXIT_CACHE_EXPIRE, max = DEFAULT_EXIT_CACHE_SIZE) {
		super((roomName) => Object.values(Game.map.describeExits(roomName)), { name: 'ExitCache', ttl, max });
	}
}

export const EXIT_CACHE = new ExitCache();