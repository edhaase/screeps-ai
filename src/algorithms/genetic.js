/**
 * Coroutine for planning extensions
 * 
 * @param {*} terrain 
 */
export function* generateExtensions(terrain) {
	const cm = new PathFinder.CostMatrix();
	
	const mutations = 10;
	function mutate(state) {
		// must be valid
	}
	function fitness(state) {
		// Number of open faces
	}
	let solution = {};
	for (var i = 0; i < MAX_EXTENSIONS; i++) {
		const pop = [];
		for (j=0; j<mutations; j++)
			pop = mutate(solution);
		_.max(pop, )
		yield true;
	}
}
const MAX_EXTENSIONS = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][MAX_ROOM_LEVEL];
class GEExt
{
	constructor() {
		this.remaining = MAX_EXTENSIONS;
	}

	clone() {

	}

	*mutate() {
		const pop = this.clone();
		pop.remaining -= 1;
		// Create solutions
		return pop;
	}

	solved(pop) {
		return pop.remaining > 0;
	}
}

export function* ge_find(opt) {
	let pop = yield* opt.initial();
	while (!opt.solved(pop)) {
		const sel = yield* opt.select(pop);
		const recom = yield* opt.recombine(pop, sel);
		pop = yield* opt.mutate(pop,sel,recom);
		yield true;
	}
	return pop;
}