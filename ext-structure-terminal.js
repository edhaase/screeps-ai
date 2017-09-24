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

const ENABLE_ORDER_MANAGEMENT = true;		// Allow terminals to create orders

global.MARKET_ORDER_LIMIT = 50;

global.TERMINAL_TAX = 0.01;		// Tax terminal income so the empire always nets a profit.

global.TERMINAL_MIN_ENERGY = 10000;					// We want to keep _at least_ this much energy in the terminal at all times.
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
defineCachedGetter(StructureTerminal.prototype, 'creditsAvailable', (t) => Math.min(Game.market.credits, t.credits));
defineCachedGetter(StructureTerminal.prototype, 'network', ({ id }) => _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL && s.id !== id));

/**
 * Terminal run method.
 *
 * Currently runs every tick, rotating through resource types each tick.
 * Desired behavior: If out of stuff to adjust, go to sleep for a few ticks.
 *
 * @todo stick store in memory so we can track change over ticks.
 */
StructureTerminal.prototype.run = function () {
	if (BUCKET_LIMITER || this.cooldown || this.isDeferred() || this.busy)
		return;
	try {
		if (!(Game.time & 15))
			this.moderateEnergy();

		if (ENABLE_ORDER_MANAGEMENT && !(Game.time & 2047))
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
		Log.error(`Error in terminal ${this.pos.roomName}`, 'Terminal');
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
			this.memory[prop] = undefined;
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
		this.changeOrderPrice(order.id, newPrice);
	});
};

/**
 * @todo: min(pctCapacityUsed * distance)
 */
// _(Game.structures).filter(s => s.structureType === STRUCTURE_TERMINAL).invoke('moderateEnergy')
StructureTerminal.prototype.moderateEnergy = function () {
	// If we're not exceeding energy limits, return early.
	const energy = this.store[RESOURCE_ENERGY] || 0;
	if (energy < TERMINAL_MIN_ENERGY && this.creditsAvailable > 0) {
		const order = _.find(this.orders, { type: ORDER_BUY, resourceType: RESOURCE_ENERGY });
		const total = TERMINAL_MIN_ENERGY * 1.25;
		if (ENABLE_ORDER_MANAGEMENT && !order) {
			const competition = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: RESOURCE_ENERGY });
			const highest = _.isEmpty(competition) ? 1.0 : (_.max(competition, 'price').price);
			const price = highest + 0.01;
			const amount = Math.min(total, this.getMaximumBuyOrder(price));
			if (amount > total / 2) {	// Place order for at least half..
				const status = this.createBuyOrder(RESOURCE_ENERGY, price, amount);
				Log.notify(`Low energy in ${this.pos.roomName}, creating buy order for ${amount} at ${(highest + 0.01)}, status: ${status}`);
				if (status === OK)
					return true;
			} else {
				const cost = Math.ceil((price * total) + this.calcOrderFee(price, total));
				Log.warn(`Terminal ${this.pos.roomName} can't create buy order, not enough credits (${this.creditsAvailable}/${cost})`, 'Terminal');
			}
		}
		return this.buyUpTo(RESOURCE_ENERGY, total); // Fix the always-half-way issue/
	}

	const overage = energy - TERMINAL_RESOURCE_LIMIT;
	if (overage < 1000)
		return false;

	const terms = _.filter(this.network, s => s.store[RESOURCE_ENERGY] + 1000 < TERMINAL_RESOURCE_LIMIT);
	if (terms == null || !terms.length) {
		Log.warn(`${this.pos.roomName} No overflow terminal for ${overage} energy`, "Terminal");
		return this.sell(RESOURCE_ENERGY, Math.min(overage, TERMINAL_MAX_AUTOSELL), 0.01);
	}

	const best = _.max(terms, t => TERMINAL_RESOURCE_LIMIT - t.store[RESOURCE_ENERGY]);
	const amount = Math.min(TERMINAL_RESOURCE_LIMIT - (best.store[RESOURCE_ENERGY] || 0) - 1, overage); // Amount we can accept vs amount we're over.
	Log.warn(`Terminal ${this.pos.roomName} reaching capacity. Shipping ${amount} energy to ${best.pos.roomName}`);
	if (this.send(RESOURCE_ENERGY, amount, best.pos.roomName, 'Overflow prevention') === OK) {
		this.store[RESOURCE_ENERGY] -= amount;
		best.store[RESOURCE_ENERGY] += amount;
	}
	return true;
};

/**
 * Sells off resources over a threshold
 * 2016-11-6: Increase per-sale limit, and stop randomly skipping orders. Due to reduced NPC buyers.
 */
StructureTerminal.prototype.runAutoSell = function (resource = RESOURCE_THIS_TICK) {
	if (resource === RESOURCE_ENERGY)
		return false;
	const over = this.getOverageAmount(resource);
	if (over < TERMINAL_MIN_SEND)
		return false;
	if (Math.random() > (over / TERMINAL_MAX_AUTOSELL))
		return Log.info(`${this.pos.roomName} Skipping sell operation on ${over} ${resource}`, 'Terminal');

	// On first overage sell, place a sell order
	if (ENABLE_ORDER_MANAGEMENT && this.creditsAvailable > 0 && !_.any(this.orders, o => o.type === ORDER_SELL && o.resourceType === resource)) {
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
		const status = this.createSellOrder(resource, price, amount);
		Log.notify(`Creating sell order at ${roomName} for ${amount} ${resource} at ${price}, status: ${status}`);
		if (status === OK)
			return true;
	}

	const moving = Math.clamp(TERMINAL_MIN_SEND, over, TERMINAL_MAX_AUTOSELL);
	return this.sell(resource, moving) === OK;
};

/**
 * Auto purchase compounds we're missing.
 */
StructureTerminal.prototype.runAutoBuy = function (resource = RESOURCE_THIS_TICK) {
	if (this.creditsAvailable <= 0 || this.store[RESOURCE_ENERGY] < TERMINAL_MIN_ENERGY)
		return;
	if (resource.length <= 1 && resource !== 'G')
		return;
	if (['ZK', 'UL', 'OH'].includes(resource))
		return;
	if (resource === RESOURCE_POWER && this.room.controller.level < 8)
		return;
	if (TERMINAL_MAINTAIN_RESERVE - this.store[resource] <= TERMINAL_PURCHASE_MARGIN)
		return;
	this.buyUpTo(resource, TERMINAL_MAINTAIN_RESERVE);
};

StructureTerminal.prototype.getOverageAmount = function (res) {
	if (res === RESOURCE_ENERGY || !this.store[res])
		return 0;
	const amt = this.store[res] || 0;
	if (this.checkBit(BIT_TERMINAL_SELL_ALL))
		return amt;
	const over = Math.max(amt - TERMINAL_AUTOSELL_THRESHOLD, 0);
	return 100 * Math.floor(over / 100); // round to increments of 100
};

/** Active check hotwire for safety - Don't need to load terminal if it's inactive due to downgrade */
StructureTerminal.prototype.isActive = function() {
	return (this.room.controller.level >= 6);
};

/**
 * Immediate sale
 * 
 * @param {string} res - a RESOURCE_ constant
 * @param {number} amt - amount to buy
 * @param {number} limit - minimum price to consider
 * 
 * @todo: Avoid rooms in cache by opponent.
 */
StructureTerminal.prototype.sell = function (resource, amt = Infinity, limit = TERMINAL_MINIMUM_SELL_PRICE) {
	var orders = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: resource });
	orders = _.filter(orders, o => o.price >= limit && o.remainingAmount > 1 && o.amount > 1);
	if (orders == null || !orders.length) {
		Log.info(`${this.pos.roomName}: No orders to fill for ${resource}`, 'Terminal');
		return ERR_NOT_FOUND;
	}
	const amount = Math.min(amt, this.store[resource]);
	const order = _.max(orders, o => o.price / this.calcTransactionCost(Math.min(amount, o.amount), o.roomName));
	if (Game.rooms[order.roomName] && Game.rooms[order.roomName].my)
		Log.notify(`Yeah, we are selling to ourselves.. ${amount} ${resource} from ${this.pos.roomName} to ${order.roomName}`);
	const status = this.deal(order.id, amount, order);
	if (status === OK)
		this.say('\u2661');
	else if (status === ERR_INVALID_ARGS)
		Log.error(`Terminal ${this.pos.roomName} deal invalid: ${order.id}, amt ${amount}`, 'Terminal');
	else
		Log.info(`Terminal ${this.pos.roomName} deal status: ${status}`, 'Terminal');
	return status;
};

/**
 * Immediate purchase
 *
 * @param {string} res - a RESOURCE_ constant
 * @param {Number} amt - amount to buy
 * @param {Number} maxRange - maximum range of orders to consider
 *
 * @todo: Avoid rooms in cache by opponent.
 */
StructureTerminal.prototype.buy = function (res, amount = Infinity, maxRange = Infinity) {
	if (amount <= 0)
		return ERR_INVALID_ARGS;
	var orders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: res });
	orders = _.reject(orders, o => (Game.rooms[o.roomName] && Game.rooms[o.roomName].my) || o.price > TERMINAL_MAXIMUM_BUY_PRICE || o.amount <= 1);
	if (maxRange !== Infinity)
		orders = _.filter(orders, o => Game.map.getRoomLinearDistance(o.roomName, this.pos.roomName, true) < maxRange);
	if (res === RESOURCE_ENERGY)
		orders = _.filter(orders, o => this.calcTransactionCost(amount, o.roomName) < amount);
	if (orders == null || !orders.length)
		return ERR_NOT_FOUND;
	const order = _.min(orders, o => o.price * this.calcTransactionCost(Math.min(amount, o.amount), o.roomName));
	const afford = Math.min(amount, order.amount, this.getPayloadWeCanAfford(order.roomName), Math.floor(this.creditsAvailable / order.price));
	const status = this.deal(order.id, afford, order);
	if (status === OK)
		this.say('\u26A0');
	else
		Log.warn(`${this.pos.roomName} buy failure on ${afford} ${order.resourceType} [${order.id}], status ${status}`, 'Terminal');
	return status;
};

StructureTerminal.prototype.buyUpTo = function (res, goal) {
	const amt = this.store[res] || 0;
	return this.buy(res, goal - amt);
};

StructureTerminal.prototype.isFull = function () {
	return _.sum(this.store) >= this.storeCapacity;
};

/**
 *
 */
StructureTerminal.prototype.deal = function (id, amount, order = {}) {
	// track score, transaction cost averages
	if(amount <= 0)
		return ERR_INVALID_ARGS;
	const status = Game.market.deal(id, amount, this.pos.roomName);
	Log.debug(`${this.pos.roomName} dealing on ${amount} ${order.resourceType}, order ${id}, status ${status}`, 'Terminal');
	if (status === OK && order) {
		// Don't change credits here, we're using transactions to track that.
		const dist = Game.map.getRoomLinearDistance(order.roomName, this.pos.roomName, true);
		const cost = this.calcTransactionCost(amount, order.roomName);
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
 * 
 */
StructureTerminal.prototype.cancelOrder = function (id) {
	const order = Game.market.orders[id];
	if (!order)
		return ERR_NOT_FOUND;
	Log.debug(`${this.pos.roomName} canceling order ${id} with a loss of ${order.remainingAmount * order.price * MARKET_FEE} credit fee`, 'Terminal');
	return Game.market.cancelOrder(order.id);
};

/**
 * 
 */
StructureTerminal.prototype.changeOrderPrice = function (id, newPrice) {
	// account for buy order fee + total and creditsAvailable
	// note loss of fee if decreasing?
	return Game.market.changeOrderPrice(id, newPrice);
};

/**
 * Prevent multiple sends from overriding intended behavior or wasting cpu.
 */
const { send } = StructureTerminal.prototype;
StructureTerminal.prototype.send = function (resourceType, amount, destination, description) {
	if (this.busy)
		return ERR_BUSY;
	const status = send.apply(this, arguments);
	Log.debug(`${this.pos.roomName} sending ${amount} ${resourceType} to ${destination}, status ${status}`, 'Terminal');
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
	return Math.floor(this.store[RESOURCE_ENERGY] / (this.getFee(dest) + 1));
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

StructureTerminal.prototype.calcTransactionCost = function (amount, dest) {
	return Game.market.calcTransactionCost(amount, this.pos.roomName, dest);
};

// Literally move all the energy in this terminal somewhere.
StructureTerminal.prototype.sendAllEnergy = function (dest) {
	const amt = this.getPayloadWeCanAfford(dest);
	if (amt < TERMINAL_MIN_SEND)
		return ERR_NOT_ENOUGH_RESOURCES;
	return this.send(RESOURCE_ENERGY, amt, dest, 'Resource transfer');
};

/**
 * Arbitrage: Exploiting a price 
 */
const TERMINAL_MIN_ARBITRAGE_PROFIT = 0.04;
StructureTerminal.prototype.findArbitrageOrders = function (resource = RESOURCE_ENERGY, minProfit = TERMINAL_MIN_ARBITRAGE_PROFIT) {
	const orders = _.reject(Game.market.getAllOrders({ resourceType: resource }), o => o.amount < 10 || _.get(Game.rooms[o.roomName], 'controller.my', false));
	const ordersByType = _.groupBy(orders, 'type');
	// const inbound = _.reject(ordersByType[ORDER_SELL], o => o.remainingAmount > 10 && o.amount > 10 && );
	// const outbound = _.filter(ordersByType[ORDER_BUY], o => o.remainingAmount > 10 && o.amount > 10);
	const inbound = ordersByType[ORDER_SELL] || [];
	const outbound = ordersByType[ORDER_BUY] || [];
	if (!inbound.length || !outbound.length)
		return ERR_NOT_FOUND;
	const io = _.min(inbound, 'price');
	const oo = _.max(outbound, 'price');
	const profitPerUnit = oo.price - io.price;
	if (profitPerUnit < minProfit)
		return ERR_NOT_FOUND;
	const amount = Math.min(io.amount, oo.amount);
	const profitTotal = profitPerUnit * amount;
	const ic = this.calcTransactionCost(amount, io.roomName);
	const oc = this.calcTransactionCost(amount, oo.roomName);
	Log.debug(`Found arbitrage pair for ${amount} ${resource} for ${_.round(profitPerUnit, 5)} or ${_.round(profitTotal, 5)} total and ${Math.ceil(oc + ic)} energy cost`, 'Terminal');
	// Log.debug(`Arbitrage selection picked ${ex(io)} --> ${ex(oo)}`, 'Terminal');
	return OK;
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
			throw new TypeError(`Expected number, got ${value}`);
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
	if (price <= 0 || amt <= 0)
		return ERR_INVALID_ARGS;
	const status = Game.market.createOrder(orderType, resource, price, amt, this.pos.roomName);
	Log.debug(`Creating order ${orderType} for ${amt} ${resource} at price ${price}, status ${status}`, 'Terminal');
	if (status === OK)
		this.credits -= (price * amt * MARKET_FEE);
	return status;
};

/**
 * Wraps createOrder to provide a limit against purchases that exceed our credit allotment
 * 
 * @param {string} resource
 * @param {Number} price
 * @param {Number} total
 */
StructureTerminal.prototype.createBuyOrder = function (resource, price, total) {
	const order = _.find(this.orders, { type: ORDER_BUY, resourceType: resource });
	if (order)
		return ERR_FULL;
	const cost = Math.ceil((price * total) + this.calcOrderFee(price, total));
	if (this.creditsAvailable < cost)
		return ERR_NOT_ENOUGH_RESOURCES;
	const status = this.createOrder(ORDER_BUY, price, total);
	Log.debug(`Terminal ${this.pos.roomName} creating buy order of ${total} ${resource} at ${price} for ${cost} total, status ${status}`, 'Terminal');
	return status;
};

/**
 * Wraps createOrder to provide a limit against sales that exceed our credit allotment
 * 
 * @param {string} resource
 * @param {Number} price
 * @param {Number} total
 */
StructureTerminal.prototype.createSellOrder = function (resource, price, total) {
	if (this.creditsAvailable < this.calcOrderFee(price, total))
		return ERR_NOT_ENOUGH_RESOURCES;
	return this.createOrder(ORDER_SELL, resource, price, total);
};

StructureTerminal.prototype.calcOrderFee = function (price, amt) {
	return price * amt * MARKET_FEE;
};

StructureTerminal.prototype.getMaximumBuyOrder = function (price) {
	return Math.floor(this.creditsAvailable / (price * (MARKET_FEE + 1)));
};