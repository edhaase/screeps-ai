/**
 * ext-structure-terminal.js - Terminal economics logic, the backbone of any industrious empire
 * 
 * ideas: 
 *	- maximum range, using structure memory, to limit range when looking for orders.
 *	- hard cap on lowest price
 *	- local market analysis (can really only be done per terminal)
 *	- if storage and terminal are out of energy request from elsewhere, or place buy order.
 *  - new terminal auto-acquire CONSTRUCTION_COST[STRUCTURE_TERMINAL] energy to replace cost.
 *  - track market orders by terminal (also incoming and outgoing transactions)
 *  - OFFENSE: trade 1 multiple times in attempt to overflow market data
 *  - DEFENSE: Blocked rooms
 *  - Place buy orders for Ghodium when refilling nuke
 * rAmt + fee(rAmt) <= capacity
 * Game.getObjectById('57ac9d174556ddcc49344c2c').getMaximumPayload('E53S43');
 *   Even storage is TERMINAL_CAPACITY / RESOURCES_ALL.length (or about 6900 of each)
 * https://www.mathway.com/Algebra
 * Terminal transfer costs equal the amount you're sending at 70 rooms linear distance, regardless of the amount you're sending?
 *
 * @todo: Auto purchase compounds only if we have labs (and credits).
 * 		  http://support.screeps.com/hc/en-us/articles/207891075-Minerals
 * @todo: Track credit income/expense at this terminal.
 * @todo: Intel gathering from orders.
 */
"use strict";

global.MARKET_ORDER_LIMIT = 50;

global.TERMINAL_TAX = 0.01;		// Tax terminal income so the empire always nets a profit.

global.TERMINAL_MIN_ENERGY = 5000;					// We want to keep _at least_ this much energy in the terminal at all times.
global.TERMINAL_AUTOSELL_THRESHOLD = 7000;			// At what point do we sell overflow?
global.TERMINAL_RESOURCE_LIMIT = 75000; 			// Above this we stop spawning mineral harvesters
global.TERMINAL_MAX_AUTOSELL = 5000;				// Maximum amount we can sell in a single action.
global.TERMINAL_MINIMUM_SELL_PRICE = 0.01;
global.TERMINAL_MAXIMUM_BUY_PRICE = 20.00;
global.TERMINAL_MAINTAIN_RESERVE = 500;
global.TERMINAL_PURCHASE_MARGIN = 10;
global.BIT_TERMINAL_SELL_ALL = (1 << 1);

StructureTerminal.prototype.NUMBER_FORMATTER = new Intl.NumberFormat();

// Magic properties
defineCachedGetter(StructureTerminal.prototype, 'orders', ({ pos }) => _.filter(Game.market.orders, 'roomName', pos.roomName));

/**
 * Terminal run method.
 *
 * Currently runs every tick, rotating through resource types each tick.
 * Desired behavior: If out of stuff to adjust, go to sleep for a few ticks.
 *
 * @todo stick store in memory so we can track change over ticks.
 */
StructureTerminal.prototype.run = function () {
	if (BUCKET_LIMITER || this.cooldown || this.isDeferred())
		return;
	try {
		// 
		// if(this.room.energyAvailable / this.room.energyCapacityAvailable < 0.25)
		//	return;
		if (!(Game.time & 15))
			this.moderateEnergy();
		// if(this.moderateEnergy())
		//	return; // Stuff happened. Try again next tick.

		if (!(Game.time & 2047))
			this.updateOrders();
		this.runAutoSell();
		this.runAutoBuy();
		// If terminal has no rampart, the room has no spawns, or the controller is in emergency mode SELL
		// If terminal is empty purchase energy up to TERMINAL_RESOURCE_LIMIT
		// if(!this.busy) // Regardless of how we got here, if the terminal acted this tick, don't go to sleep.
		//	return this.defer(_.random(10,25));

		/* if(!this.busy) {
			Log.warn('Terminal ' + this.pos.roomName + ' out of stuff to do. Wants to sleep.');
			this.defer(3);
		} */
	} catch (e) {
		Log.error('Error in terminal ' + this.pos.roomName);
		Log.error(e.stack);
	}
};

/**
 * Order locking, inspired by generalized target locking.
 *
 * ex: getOrder(
 *     	() => Game.market.getAllOrders({type: ORDER_BUY, resourceType: RESOURCE_ENERGY}),
 *     	(order) => order.amount > 10 && order.remainingAmount > 0,
 *     	(candidates) => _.max(candidates, o => o.price / Game.market.calcTransactionCost(amount, this.pos.roomName, o.roomName));
 *     )
 */
StructureTerminal.prototype.getOrder = function (selector, validator = _.identity, chooser = _.first, prop = 'oid') {
	var oid = this.memory[prop];
	var order = Game.market.getOrderById(oid);
	if (order == null || !validator(order)) {
		var candidates = _.filter(selector.call(this, this), validator);
		if (candidates && candidates.length)
			order = chooser(candidates, this);
		else
			order = null;
		if (order)
			this.memory[prop] = order.id;
		else
			delete this.memory[prop];
	}
	return order;
};

/**
 *
 */
StructureTerminal.prototype.updateOrders = function () {
	// let orders = this.orders; // get orders for this room.
	// do we care if they haven't sold?
	const orders = _.filter(this.orders, o => o.type === ORDER_SELL && Game.time - o.created > 10000 && o.price > 0.45); // find old orders first.
	_.each(orders, function (order) {
		const newPrice = order.price - 0.01;
		if (newPrice < 0.25)
			return;
		Log.notify(`[Terminal] ${order.roomName} Reducing order price on old order ${order.id} from ${order.price} to ${newPrice}`);
		Game.market.changeOrderPrice(order.id, newPrice);
	});
};

/**
 * @todo: min(pctCapacityUsed * distance)
 * @todo: limit range. sending energy 15+ rooms will use more than it delivers.
 * 2016-11-6: Refactored logic
 */
// _(Game.structures).filter(s => s.structureType === STRUCTURE_TERMINAL).invoke('moderateEnergy')
StructureTerminal.prototype.moderateEnergy = function () {
	// If we're not exceeding energy limits, return early.
	const energy = this.store[RESOURCE_ENERGY];
	if (energy !== undefined && energy < TERMINAL_RESOURCE_LIMIT && Math.min(Game.market.credits, this.credits) > 0) {
		// Place order instead	
		if (energy < 20000) {
			const order = _.find(this.orders, { type: ORDER_BUY, resourceType: RESOURCE_ENERGY });
			if (order && Game.time - order.created > 5000)
				return this.buyUpTo(RESOURCE_ENERGY, 20000 + 5000); // Fix the always-half-way issue/
			if (order)
				return false;
			const competition = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: RESOURCE_ENERGY });
			const highest = _.isEmpty(competition) ? 1.0 : (_.max(competition, 'price').price);
			Log.notify(`Low energy in ${this.pos.roomName}, creating buy order at ${(highest + 0.01)}`);
			// let status = Game.market.createOrder(ORDER_BUY, RESOURCE_ENERGY, (highest + 0.01), 30000, this.pos.roomName);
			const status = this.createOrder(ORDER_BUY, RESOURCE_ENERGY, (highest + 0.01), 30000);
			console.log('createOrder: ' + status);
			/* Log.warn('[Terminal] Low energy in room ' + this.pos.roomName + ', attempting to purchase energy');			
			return this.buy(RESOURCE_ENERGY, 5000); */
		}
		return false; // We acted, but we don't want to prevent other logic from running.	
	}

	/* if(_.find(this.orders, o => o.type === ORDER_BUY && o.resourceType === RESOURCE_ENERGY)) {
		Log.warn('[Terminal] ' + this.pos.roomName + ' Energy buy order in play. Skipping moderation');
		return;
	} */

	const overage = this.store.energy - TERMINAL_RESOURCE_LIMIT;
	if (overage < 1000)
		return false;

	/** temporary override - sell instead of transfer */
	/* if( this.sell(RESOURCE_ENERGY, Math.min(overage,TERMINAL_MAX_AUTOSELL), 0.01) === OK ) {
		Log.warn('[Terminal] Terminal ' + this.pos.roomName + ' selling ' + overage + ' energy');
		return;
	}	*/

	const terms = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL && s.id !== this.id && (s.store.energy + 1000 < TERMINAL_RESOURCE_LIMIT));
	if (_.isEmpty(terms)) {
		Log.warn(`Terminal ${this.pos.roomName} unable to offload ${overage} energy`, "Terminal");
		return this.sell(RESOURCE_ENERGY, Math.min(overage, TERMINAL_MAX_AUTOSELL), 0.01);
	}
	// let best = _.min(terms, 'total');
	const best = _.max(terms, t => TERMINAL_RESOURCE_LIMIT - t.store.energy);
	if (!(best instanceof StructureTerminal))
		return false;
	const amount = Math.min(TERMINAL_RESOURCE_LIMIT - best.store.energy - 1, // Amount we can accept
		this.store.energy - TERMINAL_RESOURCE_LIMIT);	// Amount we're over.
	if (amount < 1000)
		return false;
	Log.warn(`Terminal ${this.pos.roomName} reaching capacity. Shipping ${amount} energy to ${best.pos.roomName}`);
	if (this.send(RESOURCE_ENERGY, amount, best.pos.roomName, 'Overflow prevention') === OK) {
		this.store[RESOURCE_ENERGY] -= amount;
		best.store[RESOURCE_ENERGY] += amount;
	}
	return true;
};

/**
 * Checks
 */
StructureTerminal.prototype.isActive = function () {
	return (this.room.controller.level >= 6);
};

/**
 * Get all the incoming transactions that occured for this room in the last so many ticks.
 */
StructureTerminal.prototype.getIncomingTransactionsSince = function (ticks = 5) {
	return _(Game.market.incomingTransactions)
		.takeWhile(t => Game.time - t.time <= ticks)
		.filter(t => t.to === this.pos.roomName);
};

StructureTerminal.prototype.getOutgoingTransactionsSince = function (ticks = 5) {
	return _(Game.market.outgoingTransactions)
		.takeWhile(t => Game.time - t.time <= ticks)
		.filter(t => t.from === this.pos.roomName);
};

/**
 * Balance a resource to other terminals. Needs to be for ticks = #terminals to balance.
 */
StructureTerminal.prototype.balance = function (res) {
	const allTerminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL);
	const totalRes = _.sum(allTerminals, s => _.get(s, ['store', res], 0));
	const avgRes = totalRes / allTerminals.length;
	const local = _.get(this, ['store', res], 0);
	const threshold = 1000;
	console.log('terminals: ' + allTerminals);
	console.log('total: ' + totalRes + ', avg: ' + avgRes + ', local: ' + local);
	if (local - avgRes < threshold)
		return;

	let orders = [];
	let changes = _.map(allTerminals, s => ({ amt: Math.max(0, avgRes - _.get(s, ['store', res], 0)), term: s }));
	changes = _.filter(changes, c => c.amt > 0);
	_.each(changes, c => {
		let amt = Math.min(c.amt, TERMINAL_CAPACITY - c.term.total);
		let status = this.send(res, amt, c.term.pos.roomName);
		console.log('send status: ' + status + ', amt: ' + amt);
	});
	// console.log('Terminals under balance: ' + ex(changes));

};

/**
 * Pull resource from other terminals into this one.
 */
StructureTerminal.prototype.consolidate = function (res, limit = Infinity) {
	const terminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL && s.id != this.id && _.get(s.store, res, 0) > 0);
	let cap = Math.min(TERMINAL_CAPACITY - _.sum(this.store), limit);
	const room = this.pos.roomName;
	terminals.forEach(function (terminal) {
		if (cap > 0) {
			let amt = Math.min(cap, _.get(terminal.store, res, 0));
			if (terminal.send(res, amt, room) === OK)
				cap -= amt;
		}
	});
};

/**
 * Sells off resources over a threshold
 * 2016-11-6: Increase per-sale limit, and stop randomly skipping orders. Due to reduced NPC buyers.
 */
StructureTerminal.prototype.runAutoSell = function (resource = RESOURCE_THIS_TICK) {
	if (resource === RESOURCE_ENERGY || resource === RESOURCE_POWER)
		return false;
	// Always going to find the same overage until it's resolved.
	/* let resource = _.findKey(this.store, (type,amount) => type !== RESOURCE_ENERGY && type != RESOURCE_POWER && this.getOverageAmount(type) >= TERMINAL_MIN_SEND);
	if(!resource) {
		return false;
	} */

	const over = this.getOverageAmount(resource);
	if (over < TERMINAL_MIN_SEND)
		return false;
	if (Math.random() > (over / TERMINAL_MAX_AUTOSELL))
		return Log.info(`${this.pos.roomName} Skipping sell operation on ${over} ${resource}`, 'Terminal');

	// On first overage sell, place a sell order
	if (this.credits > 0 && !_.any(this.orders, o => o.type === ORDER_SELL && o.resourceType === resource)) {
		// Place order first
		const orders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: resource });
		let price = 0.25;
		const { roomName } = this.pos;
		if (!_.isEmpty(orders)) {
			// let lowest = _.min(orders, 'price');
			// price = lowest.price;
			price = _.min(orders, 'price').price;
		}
		const amount = Math.clamp(0, 100 * Math.floor(1.10 * over / 100), this.store[resource]);
		const status = this.createOrder(ORDER_SELL, resource, price, amount);
		Log.notify(`Creating sell order at ${roomName} for ${amount} ${resource} at ${price}, status: ${status}`);
		if (status === OK)
			return true;
	}

	// console.log(`over threshold on ${resource} (${over})`);
	const moving = Math.clamp(TERMINAL_MIN_SEND, over, TERMINAL_MAX_AUTOSELL);
	// throw a monkey wrench in for people with expecations :->
	/* if(over < 500 && _.random(1,3) === 1) {
		Log.warn(`[Terminal] ${this.pos.roomName} throwing a wrench on ${over} ${resource}!`);
		return;
	} */
	// sell as normal
	this.sell(resource, moving);
};

/**
 * Auto purchase compounds we're missing.
 */
StructureTerminal.prototype.runAutoBuy = function () {
	if (this.credits <= 0 || this.store[RESOURCE_ENERGY] < TERMINAL_MIN_ENERGY)
		return;
	if (RESOURCE_THIS_TICK.length <= 1 && RESOURCE_THIS_TICK !== 'G')
		return;
	if (['ZK', 'UL', 'OH'].includes(RESOURCE_THIS_TICK))
		return;
	if (RESOURCE_THIS_TICK === RESOURCE_POWER && this.room.controller.level < 8)
		return;
	if (TERMINAL_MAINTAIN_RESERVE - this.store[RESOURCE_THIS_TICK] <= TERMINAL_PURCHASE_MARGIN)
		return;
	this.buyUpTo(RESOURCE_THIS_TICK, TERMINAL_MAINTAIN_RESERVE);
};

StructureTerminal.prototype.getMaxResourceAmount = function (res) {
	if (res === RESOURCE_ENERGY || res === RESOURCE_POWER)
		return Infinity;
};

/**
 * How much of a resource do we want, and how badly?
 */
StructureTerminal.prototype.getDemand = function (resource) {
	var amount = 0;
	var priority = 0;
	return [amount, priority];
};

StructureTerminal.prototype.getOverageAmount = function (res) {
	if (res === RESOURCE_ENERGY || res === RESOURCE_POWER || !this.store[res])
		return 0;
	const amt = _.get(this.store, res, 0);
	if (this.checkBit(BIT_TERMINAL_SELL_ALL))
		return amt;
	const over = Math.max(amt - TERMINAL_AUTOSELL_THRESHOLD, 0);
	return 100 * Math.floor(over / 100); // round to increments of 100
};

/**
 * Sell a given resource and amount.
 * @todo: Avoid rooms in cache by opponent.
 * 2016-11-06: Reduced minimum price to 0.2 because of unscheduled change by devs
 * 2016-10-27: Raised minimum price to 0.65 
 */
StructureTerminal.prototype.sell = function (resource, amt = Infinity, limit = TERMINAL_MINIMUM_SELL_PRICE) {
	let orders = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: resource });
	orders = _.filter(orders, o => o.price >= limit && o.remainingAmount > 1 && o.amount > 1);
	if (_.isEmpty(orders)) {
		Log.info(`No orders to fill for ${resource}`, 'Terminal');
		return ERR_NOT_FOUND;
	}
	const amount = Math.min(amt, this.store[resource]);
	// let order = _.max(orders, o => o.price / Game.market.calcTransactionCost(amount, this.pos.roomName, o.roomName));
	const order = _.max(orders, o => o.price / Game.market.calcTransactionCost(Math.min(amount, o.amount), this.pos.roomName, o.roomName));
	if (!order || order === Infinity)
		return ERR_NOT_FOUND;
	const status = this.deal(order.id, amount);
	if (status === OK)
		this.say('\u2661');
	if (status !== OK)
		Log.info(`Terminal ${this.pos.roomName} deal status: ${status}`, 'Terminal');
	if (status === ERR_INVALID_ARGS)
		Log.error(`Terminal ${this.pos.roomName} deal invalid: ${order.id}, amt ${amount}`, 'Terminal');
	return status;
};

/**
 * Immediate purchase
 *
 * @param string res - a RESOURCE_ constant
 * @param number amt - amount to buy
 * @param number maxRange - maximum range of orders to consider
 *
 * @todo: Avoid rooms in cache by opponent.
 */
StructureTerminal.prototype.buy = function (res, amt = Infinity, maxRange = Infinity) { // , test=true) {	
	var orders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: res });
	orders = _.reject(orders, o => (Game.rooms[o.roomName] && Game.rooms[o.roomName].my) || o.price > TERMINAL_MAXIMUM_BUY_PRICE || o.amount <= 1);
	if (maxRange !== Infinity)
		orders = _.filter(orders, o => Game.map.getRoomLinearDistance(o.roomName, this.pos.roomName, true) < maxRange);
	if (res === RESOURCE_ENERGY)
		orders = _.filter(orders, o => Game.market.calcTransactionCost(amt, this.pos.roomName, o.roomName) < amt);
	const order = _.min(orders, o => o.price * Game.market.calcTransactionCost(Math.min(amt, o.amount), this.pos.roomName, o.roomName));
	if (!order || Math.abs(order) === Infinity)
		return ERR_NOT_FOUND;
	const afford = this.getPayloadWeCanAfford(order.roomName);
	const status = this.deal(order.id, Math.min(amt, order.amount, afford));
	if (status === OK)
		this.say('\u26A0');
	else
		Log.warn(`Terminal ${this.pos.roomName} buy failure on ${order.id}, status ${status}`, 'Terminal');
	return status;
};

StructureTerminal.prototype.buyUpTo = function (res, goal) {
	const amt = this.store[res] || 0;
	if (amt < goal)
		this.buy(res, goal - amt);
};

StructureTerminal.prototype.isFull = function () {
	return _.sum(this.store) >= this.storeCapacity;
};

/**
 *
 */
StructureTerminal.prototype.deal = function (id, amount) {
	// track score, transaction cost averages
	const status = Game.market.deal(id, amount, this.pos.roomName);
	Log.debug(`Terminal ${this.pos.roomName} dealing ${amount} on order ${id}, status ${status}`, 'Terminal');
	if (status === OK) {
		// Don't change credits here, we're using transactions to track that.
		const order = Game.market.getOrderById(id);
		const dist = Game.map.getRoomLinearDistance(order.roomName, this.pos.roomName, true);
		const cost = Game.market.calcTransactionCost(amount, order.roomName, this.pos.roomName);
		this.memory.avgCost = Math.cmAvg(cost, this.memory.avgCost || 0, 100);
		this.memory.avgDist = Math.cmAvg(dist, this.memory.avgDist || 0, 100);
		this.memory.avgFee = Math.cmAvg(this.getFee(order.roomName), this.memory.avgFee || 0, 100);
		this.memory.avgAmt = Math.cmAvg(amount, this.memory.avgAmt || 0, 100);
		this.busy = true; // Multiple deals can be run per tick, so let's not prevent that.
		this.store[RESOURCE_ENERGY] -= cost; // Adjust energy storage so further calls make smart decisions.
	}
	return status;
};

/**
 * Prevent multiple sends from overriding intended behavior or wasting cpu.
 */
const { send } = StructureTerminal.prototype;
StructureTerminal.prototype.send = function (resourceType, amount, destination, description) {
	if (this.busy)
		return ERR_BUSY;
	const status = send.apply(this, arguments);
	if (status === OK)
		this.busy = true;
	return status;
};

/**
 * How much can we send to a given room? Result would empty energy from terminal.
 */
StructureTerminal.prototype.getMaximumPayload = function (dest) {
	return Math.floor(TERMINAL_CAPACITY / (this.getFee(dest) + 1));
};

/**
 * How much can we afford to move right now?
 */
StructureTerminal.prototype.getPayloadWeCanAfford = function (dest) {
	return Math.floor(this.store.energy / (this.getFee(dest) + 1));
};

/**
 * Transaction fee independent of amount.
 */
StructureTerminal.prototype.getFee = function (dest) {
	const dist = Game.map.getRoomLinearDistance(this.room.name, dest, true);
	return 1 - Math.exp(-dist / 30);
};

/**
 * If you want to ensure energy cost remains lower than fee,
 * the following function will you the maximum room you can send too.
 */
StructureTerminal.prototype.getDistanceByFee = function (fee) {
	return -30 * Math.log(-fee + 1);
};

StructureTerminal.prototype.getCost = function (amt, dest) {
	return Game.market.calcTransactionCost(amt, this.room.name, dest);
};

StructureTerminal.prototype.getPayloadCalculation = function (dest) {
	const amount = Math.floor(this.store.energy / (this.getFee(dest) + 1));
	const cost = this.getCost(amount, dest);
	return { amount: amount, cost: cost };
};

// Literally move all the energy in this terminal somewhere.
StructureTerminal.prototype.sendAllEnergy = function (dest) {
	const amt = this.getPayloadWeCanAfford(dest);
	if (amt < TERMINAL_MIN_SEND)
		return ERR_NOT_ENOUGH_RESOURCES;
	return this.send(RESOURCE_ENERGY, amt, dest, 'Resource transfer');
};

// log(0.1 * dist + 0.9)
// c <= amt * fee?
StructureTerminal.prototype.getMaxDistance = function (amt) {

};

/**
 * Define credits as a persistent property on terminal.
 *
 * Alloted credits helps us tell how profitable each room is
 * and whether it can afford to purchase resources without hurting
 * the overall economy of the empire.
 */
Object.defineProperty(StructureTerminal.prototype, 'credits', {
	set: function (value) {
		if (!(typeof value === 'number'))
			throw new Error(`Expected number, got ${value}`);
		this.memory.c = value;
	},
	get: function () {
		if (this === StructureTerminal.prototype)
			return 0;
		if (this.memory.c == null)
			this.memory.c = 0;
		return this.memory.c;
	},
	configurable: true,
	enumerable: false
});

/**
 * Shortcut to create an order and adjust the terminal's allotted credits.
 */
StructureTerminal.prototype.createOrder = function (orderType, resource, price, amt) {
	const status = Game.market.createOrder(orderType, resource, price, amt, this.pos.roomName);
	if (status === OK)
		this.credits -= (price * amt * MARKET_FEE);
	return status;
};