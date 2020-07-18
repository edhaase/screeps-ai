import { ENV } from '/os/core/macros';
import LazyLru from '/ds/LazyLru';
import CostMatrix from '/ds/CostMatrix';

const COST_MATRIX_EXPIRATION = ENV('cm.cache_expire', 5);
const COST_MATRIX_CACHE_SIZE = ENV('cm.cache_size', 300);

export default class CostMatrixCache extends LazyLru {
	constructor(factory, name) {
		super(factory, { name, ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE });
	}

	set(k, v) {
		if (v && v instanceof CostMatrix)
			v.freeze();
		return super.set(k, v);
	}
}