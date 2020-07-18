/**
 * ext/structure.terminal.js - Terminal economics logic, the backbone of any industrious empire
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
 * @todo: Price reduction should stop high enough we can still make back the fee
 * @todo: Fix for placing sell orders below standing buy orders
 * @todo: Account for price of energy
 * @todo: Prefer selling to allies
 * @todo: Allow minimum price for sell/buy operations
 */
'use strict';

import { CLAMP, CM_AVG } from '/os/core/math';
import { isHostileRoom } from '/Intel';
import { DATETIME_FORMATTER } from '/lib/time';
import { in_lowest_increment_of, in_highest_increment_of, to_precision, calc_average, to_fixed } from '/lib/util';
import { ICON_HIGH_VOLTAGE, ICON_HEART } from '/lib/icons';
import { Log, LOG_LEVEL } from '/os/core/Log';

/* global DEFINE_CACHED_GETTER, Log */
/* global TERMINAL_MINIMUM_ENERGY, TERMINAL_RESOURCE_LIMIT, RESOURCE_THIS_TICK */

export const MINIMUM_LEVEL_FOR_TERMINAL = _.findKey(CONTROLLER_STRUCTURES[STRUCTURE_TERMINAL]);

export const ENABLE_ORDER_MANAGEMENT = true;				// Allow terminals to create orders

export const MODERATE_ENERGY_FREQUENCY = 15;
export const MODERATE_ORDERS_FREQUENCY = 2000;
export const UPDATE_ENERGY_COST_FREQUENCY = 60;

export const TERMINAL_DEFAULT_ENERGY_PRICE = 0.05;
export const TERMINAL_AUTOSELL_THRESHOLD = 7000;			// At what point do we sell overflow?
export const TERMINAL_MINIMUM_AUTOSELL = 1000;				// Maximum amount we can sell in a single action.
export const TERMINAL_MAXIMUM_AUTOSELL = 5000;				// Maximum amount we can sell in a single action.
export const TERMINAL_MINIMUM_SELL_PRICE = 0.001;

export const TERMINAL_MAXIMUM_BUY_PRICE = 20.00;			// Hard cap on price
export const TERMINAL_PURCHASE_MARGIN = 0;

/* globally registered constants */
/* eslint-disable no-magic-numbers */
// @todo make these enviroment variables
export const TERMINAL_TAX = 0.01;							// Tax terminal income so the empire always nets a profit.
export const TERMINAL_MINIMUM_ENERGY = 10000;				// We want to keep _at least_ this much energy in the terminal at all times.
export const TERMINAL_RESOURCE_LIMIT = 70000; 			// Above this we stop spawning mineral harvesters
export const TERMINAL_MAINTAIN_RESERVE = 25 * LAB_BOOST_MINERAL;				// Amount of compounds to keep on hand
export const TERMINAL_COMMODITY_LIMIT = 25000;
/* eslint-enable no-magic-numbers */

StructureTerminal.prototype.NUMBER_FORMATTER = new Intl.NumberFormat();

DEFINE_CACHED_GETTER(StructureTerminal.prototype, 'orders', ({ pos }) => _.filter(Game.market.orders, 'roomName', pos.roomName));
DEFINE_CACHED_GETTER(StructureTerminal.prototype, 'creditsAvailable', (t) => Math.min(Game.market.credits, t.credits));
DEFINE_CACHED_GETTER(StructureTerminal.prototype, 'network', ({ id }) => _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL && s.id !== id && s.isActive()));
DEFINE_CACHED_GETTER(StructureTerminal.prototype, 'creditsReservedForEnergy', (t) => TERMINAL_MINIMUM_ENERGY * (t.memory.energyPrice || TERMINAL_DEFAULT_ENERGY_PRICE) * (1.0 + MARKET_FEE));

export const MINIMUM_RESOURCE_SELL_PRICE = {
	[RESOURCE_SILICON]: 2.0
}

/**
 * Terminal run method.
 *
 * Currently runs every tick, rotating through resource types each tick.
 * Desired behavior: If out of stuff to adjust, go to sleep for a few ticks.
 *
 * @todo stick store in memory so we can track change over ticks.
 */
StructureTerminal.prototype.run = function () {
	if (this.cooldown || this.isDeferred() || this.busy || !this.room.my)
		return;
	try {
		if (!(Game.time % MODERATE_ENERGY_FREQUENCY))
			this.moderateEnergy();

		if (this.memory.decomission) {
			const ress = _.keys(_.pick(this.store, (amt, key) => key !== RESOURCE_ENERGY));
			const res = _.sample(ress);
			if (res)
				this.sell(res, Infinity);
			return;
		}

		if (!(Game.time % UPDATE_ENERGY_COST_FREQUENCY)) {
			const competition = this.getAllOrders({ type: ORDER_BUY, resourceType: RESOURCE_ENERGY });
			const highest = _.isEmpty(competition) ? TERMINAL_DEFAULT_ENERGY_PRICE : (_.max(competition, 'price').price);
			this.memory.energyPrice = highest + 0.01;
		}

		if (ENABLE_ORDER_MANAGEMENT && !(Game.time % MODERATE_ORDERS_FREQUENCY))
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
		Log.error(e.stack, 'Terminal');
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
 * @todo don't just flat decrease.. 
 * @todo what's the cost of lost fee?
 */
const TERMINAL_ORDER_PRICE_REDUCTION = 0.01;	// How much to change the order by
const TERMINAL_MINIMUM_ORDER_AGE = 10000;				// How old the order to be before we start messing with it.
StructureTerminal.prototype.updateOrders = function () {
	const orders = _.filter(this.orders, o => o.type === ORDER_SELL && Game.time - o.created > TERMINAL_MINIMUM_ORDER_AGE && o.price > 0.45); // find old orders first.
	for (const order of orders) {
		const newPrice = order.price - TERMINAL_ORDER_PRICE_REDUCTION;
		if (newPrice < 0.25)
			continue;
		const status = this.changeOrderPrice(order.id, newPrice);
		const date = new Date(order.createdTimestamp);
		Log.warn(`${order.roomName} reducing price on old order ${order.id} created on ${DATETIME_FORMATTER.format(date)} from ${order.price} to ${newPrice} status ${status}`, 'Terminal');
	}
};

/**
 * @todo: min(pctCapacityUsed * distance)
 */
StructureTerminal.prototype.moderateEnergy = function () {
	// If we're not exceeding energy limits, return early.
	const energy = this.store[RESOURCE_ENERGY] || 0;
	if (energy < TERMINAL_MINIMUM_ENERGY && this.creditsAvailable > 0) {
		const order = _.find(this.orders, { type: ORDER_BUY, resourceType: RESOURCE_ENERGY });
		const total = TERMINAL_MINIMUM_ENERGY * 1.25;
		if (ENABLE_ORDER_MANAGEMENT && !order) {
			const competition = this.getAllOrders({ type: ORDER_BUY, resourceType: RESOURCE_ENERGY });
			const highest = _.isEmpty(competition) ? TERMINAL_DEFAULT_ENERGY_PRICE : (_.max(competition, 'price').price);
			const price = highest + 0.001;
			const amount = in_lowest_increment_of(Math.min(total, this.getMaximumBuyOrder(price)), 100);  // Because an even amount just looks better
			if (amount > total / 2) {	// Place order for at least half..
				const status = this.createBuyOrder(RESOURCE_ENERGY, price, amount);
				Log.notify(`Low energy in ${this.pos.roomName}, creating buy order for ${amount} at ${to_fixed(price, 3)}, status: ${status}`);
				if (status === OK)
					return true;
			} else if (amount > 0) {
				const cost = Math.ceil((price * total) + this.calcOrderFee(price, total));
				Log.warn(`${this.pos.roomName} can't create buy order for ${amount} energy, not enough credits (${to_precision(this.creditsAvailable, 3)}/${cost})`, 'Terminal');
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
		return this.sell(RESOURCE_ENERGY, Math.min(overage, TERMINAL_MAXIMUM_AUTOSELL), TERMINAL_MINIMUM_SELL_PRICE);
	}

	const best = _.max(terms, t => TERMINAL_RESOURCE_LIMIT - t.store[RESOURCE_ENERGY]);
	const amount = Math.min(TERMINAL_RESOURCE_LIMIT - (best.store[RESOURCE_ENERGY] || 0) - 1, overage); // Amount we can accept vs amount we're over.
	Log.info(`Terminal ${this.pos.roomName} reaching capacity. Shipping ${amount} energy to ${best.pos.roomName}`, 'Terminal');
	if (this.send(RESOURCE_ENERGY, amount, best.pos.roomName, 'Overflow prevention') === OK) {
		this.store[RESOURCE_ENERGY] -= amount;
		best.store[RESOURCE_ENERGY] += amount;
	}
	return true;
};

StructureTerminal.prototype.shareResource = function (resource, available) {
	const dest = _.find(Game.rooms, r => r.my && r.controller.level >= 6 && r.terminal && r.terminal.store[resource] < TERMINAL_MAINTAIN_RESERVE && !r.terminal.memory.decommision);
	Log.debug(`${this.pos.roomName} wants to share ${resource} -- found: ${dest}`, 'Terminal');
	if (!dest)
		return false;
	const need = TERMINAL_MAINTAIN_RESERVE - dest.terminal.store[resource];
	const amount = Math.min(need, available);
	if (amount <= 0)
		return false;
	Log.info(`${this.pos.roomName} sending ${amount} excess ${resource} to ${dest.name}`, 'Terminal');
	return this.send(resource, amount, dest.name, 'Supporting the empire') === OK;
}

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
	// If it's a resource other rooms could want, share!
	if (resource === RESOURCE_GHODIUM && this.shareResource(RESOURCE_GHODIUM, over))
		return true;
	if (resource === RESOURCE_OPS && this.shareResource(RESOURCE_OPS, over))
		return true;
	if (over < TERMINAL_MINIMUM_AUTOSELL)
		return false;
	if (Math.random() > (over / TERMINAL_MAXIMUM_AUTOSELL))
		return Log.info(`${this.pos.roomName} Skipping sell operation on ${over} ${resource}`, 'Terminal');

	/**
	 * On first overage sell, place a sell order
	 * 
	 * If there's a standing buy order, we shouldn't place a sell order for less than that or we're losing out on money.
	 */
	if (ENABLE_ORDER_MANAGEMENT && this.creditsAvailable > 0 && !_.any(this.orders, o => o.type === ORDER_SELL && o.resourceType === resource && o.remainingAmount > 1)) {
		// Place order first
		const price = this.get_sell_order_price(resource);
		// @todo why do we add 10% extra here?
		const amount = CLAMP(0, in_lowest_increment_of(1.10 * over, 100), this.store[resource]);
		const status = this.createSellOrder(resource, price, amount);
		if (status === OK)
			return true;
	}

	const moving = CLAMP(TERMINAL_MIN_SEND, over, TERMINAL_MAXIMUM_AUTOSELL);
	const minprice = MINIMUM_RESOURCE_SELL_PRICE[resource] || TERMINAL_MINIMUM_SELL_PRICE;
	return this.sell(resource, moving, minprice) === OK;
};

const DEFAULT_SELL_PRICE = 0.25;
StructureTerminal.prototype.get_sell_order_price = function (resource) {
	const history = Game.market.getHistory(resource);
	const orders = this.getAllOrders({ resourceType: resource });
	const [buy, sell] = _.partition(orders, o => o.type === ORDER_BUY)
	// @todo get the highest price from history or standing buy order
	// @todo if we have an additional minimum price (perhaps it's part of a chain) then account for that
	// @todo std_dev
	const best_historical_price = _.isEmpty(history) ? null : _.max(history, h => h.avgPrice).avgPrice;
	const best_current_buy_price = _.isEmpty(buy) ? null : _.max(buy, 'price').price;
	const minimum_sell_value = MINIMUM_RESOURCE_SELL_PRICE[resource] || 0; // Not a constant because this is per resource
	const best_price = Math.max(best_historical_price, best_current_buy_price, minimum_sell_value);
	if (best_price != null && best_price > 0)
		return best_price;
	/** Otherwise need a fallback pricing model */
	if (!_.isEmpty(sell)) {
		const best_sell_price = _.min(sell, 'price').price; // Presuming the order is still listed because it's too expensive.
		return Math.max(minimum_sell_value, best_sell_price);
	}
	// @todo find a better strategy for this					
	return 0.25;
}

/**
 * Auto purchase compounds we're missing.
 */
StructureTerminal.prototype.runAutoBuy = function (resource = RESOURCE_THIS_TICK) {
	if (this.creditsAvailable <= 0 || this.store[RESOURCE_ENERGY] < TERMINAL_MINIMUM_ENERGY)
		return;
	if (resource !== RESOURCE_ENERGY && this.creditsAvailable <= this.creditsReservedForEnergy)
		return;
	if (resource.length <= 1 && resource !== 'G')
		return;
	if (['ZK', 'UL', 'OH', RESOURCE_OPS].includes(resource))
		return;
	if (resource === RESOURCE_POWER && this.room.controller.level < 8)
		return;
	if (TERMINAL_MAINTAIN_RESERVE - this.store[resource] <= TERMINAL_PURCHASE_MARGIN)
		return;
	// Skip commodites for now
	if (resource !== 'G' && resource !== RESOURCE_ENERGY && resource !== RESOURCE_POWER && !BOOSTS_ALL.includes(resource))
		return;
	this.buyUpTo(resource, TERMINAL_MAINTAIN_RESERVE);
};

StructureTerminal.prototype.getOverageAmount = function (res) {
	if (!this.store[res])
		return 0;
	const amt = this.store[res] || 0;
	if (res === RESOURCE_ENERGY)
		return in_lowest_increment_of(amt - TERMINAL_RESOURCE_LIMIT, 100);
	const over = Math.max(amt - TERMINAL_AUTOSELL_THRESHOLD, 0);
	return in_lowest_increment_of(over, 100);
};

/** Active check hotwire for safety - Don't need to load terminal if it's inactive due to downgrade */
StructureTerminal.prototype.isActive = function () {
	return (this.room.controller.level >= MINIMUM_LEVEL_FOR_TERMINAL);
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
StructureTerminal.prototype.sell = function (resource, amt = Infinity, limit = TERMINAL_MINIMUM_SELL_PRICE, energySaver = false) {
	var orders = this.getAllOrders({ type: ORDER_BUY, resourceType: resource });
	orders = _.filter(orders, o => o.price >= limit && o.remainingAmount > 1 && o.amount > 1 && !isHostileRoom(o.roomName));
	if (orders == null || !orders.length) {
		Log.info(`${this.pos.roomName}: No available orders to fill for ${resource} at or above limit ${limit}`, 'Terminal');
		return ERR_NOT_FOUND;
	}
	const maxAmount = Math.min(amt, this.store[resource]);
	let order;
	if (energySaver || resource === RESOURCE_ENERGY)
		order = _.max(orders, o => o.price / this.calcTransactionCost(Math.min(maxAmount, o.amount), o.roomName));	// Maximize energy savings
	else
		order = _.max(orders, o => this.scoreOrderForSell(o, maxAmount));		// Maximize profit

	if (Game.rooms[order.roomName] && Game.rooms[order.roomName].my)
		Log.notify(`Yeah, we are selling to ourselves.. ${maxAmount} ${resource} from ${this.pos.roomName} to ${order.roomName}`);
	const dealAmount = Math.min(maxAmount, order.amount);
	const status = this.deal(order.id, dealAmount, order);
	if (status === OK) {
		this.say(ICON_HEART);
		order.amount -= dealAmount; // Adjust so next terminal can choose a different order
		order.remainingAmount -= dealAmount;
	} else if (status === ERR_INVALID_ARGS)
		Log.error(`${this.pos.roomName}#sell deal invalid: ${order.id}, amt ${dealAmount}`, 'Terminal');
	else
		Log.info(`${this.pos.roomName}#sell status: ${status}, resource: ${resource}, order id: ${order.id}, amount: ${dealAmount}`, 'Terminal');
	return status;
};

// Aim for higher energy price,just to be safe
StructureTerminal.prototype.scoreOrderForSell = function (o, amount = 1000, energyPrice = this.memory.energyPrice || TERMINAL_DEFAULT_ENERGY_PRICE) {
	o.amt = Math.min(o.amount, amount);
	o.dist = Game.map.getRoomLinearDistance(this.pos.roomName, o.roomName, true);
	o.energyUsage = Game.market.calcTransactionCost(o.amt, o.roomName, this.pos.roomName);
	o.energyCost = energyPrice * o.energyUsage;
	o.grossProfit = o.amt * o.price;
	o.netProfit = o.grossProfit - o.energyCost;
	return o.netProfit;
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
	var orders = this.getAllOrders({ type: ORDER_SELL, resourceType: res });
	orders = _.reject(orders, o => (Game.rooms[o.roomName] && Game.rooms[o.roomName].my) || o.price > TERMINAL_MAXIMUM_BUY_PRICE || o.amount <= 1 || isHostileRoom(o.roomName));
	if (maxRange !== Infinity)
		orders = _.filter(orders, o => Game.map.getRoomLinearDistance(o.roomName, this.pos.roomName, true) < maxRange);
	if (res === RESOURCE_ENERGY)
		orders = _.filter(orders, o => this.calcTransactionCost(amount, o.roomName) < amount);
	if (orders == null || !orders.length)
		return ERR_NOT_FOUND;
	// const order = _.min(orders, o => o.price * this.calcTransactionCost(Math.min(amount, o.amount), o.roomName));
	const order = _.min(orders, o => this.scoreOrderForBuy(o, amount));
	const creditsUsable = (res === RESOURCE_ENERGY) ? this.creditsAvailable : (this.creditsAvailable - this.creditsReservedForEnergy);
	if (creditsUsable <= 0)
		return ERR_NOT_ENOUGH_RESOURCES;
	const afford = Math.min(amount, order.amount, this.getPayloadWeCanAfford(order.roomName), Math.floor(creditsUsable / order.price));
	if (afford <= 0)
		return ERR_NOT_ENOUGH_RESOURCES;
	const status = this.deal(order.id, afford, order);
	if (status === OK) {
		this.say(ICON_HIGH_VOLTAGE);
		order.amount -= afford;
		order.remainingAmount -= afford;
	} else
		Log.warn(`${this.pos.roomName} buy failure on ${afford} ${order.resourceType} [${order.id}], status ${status}`, 'Terminal');
	return status;
};

StructureTerminal.prototype.scoreOrderForBuy = function (o, amount = 1000, energyPrice = this.memory.energyPrice || TERMINAL_DEFAULT_ENERGY_PRICE) {
	o.amt = Math.min(o.amount, amount);
	o.dist = Game.map.getRoomLinearDistance(this.pos.roomName, o.roomName, true);
	o.energyUsage = Game.market.calcTransactionCost(o.amt, o.roomName, this.pos.roomName);
	o.energyCost = energyPrice * o.energyUsage;
	o.grossExpense = (o.amt * o.price) + (o.energyCost);
	return o.grossExpense;
};

StructureTerminal.prototype.buyUpTo = function (res, goal) {
	const amt = this.store[res] || 0;
	return this.buy(res, goal - amt);
};

StructureTerminal.prototype.isFull = function () {
	return _.sum(this.store) >= this.storeCapacity;
};

/**
 * @param Object base - Base filter ({ type: ORDER_SELL, resourceType: res })
 * @param Function filter - Secondary filter to pass through
 */
StructureTerminal.prototype.getAllOrders = function (base, opts = {}) {
	try {
		var orders = Game.market.getAllOrders(base);
		if (opts.stdDev) {
			var avg = _.sum(orders, 'price') / (orders.length - 1);
			_.each(orders, o => {
				o.diff = o.price - avg;
				o.sqdiff = o.diff ** 2;
			});
			var variance = _.sum(orders, 'sqdiff') / (orders.length - 1);
			var stddev = Math.sqrt(variance);
			Log.debug(`${this.pos.roomName}: Avg ${avg} Variance ${variance} StdDev ${stddev}`, 'Terminal');
		}
		return orders;
	} catch (e) {
		Log.error(`${this.pos.roomName}: ${e.message}`, 'Terminal');
		return [];
	}
};

/**
 *
 */
StructureTerminal.prototype.deal = function (id, amount, order = {}) {
	const amt = Math.floor(amount);
	if (amt <= 0)
		return ERR_INVALID_ARGS;
	const status = Game.market.deal(id, amt, this.pos.roomName);
	Log.debug(`${this.pos.roomName} dealing on ${amt} ${order.resourceType}, order ${id}, status ${status}`, 'Terminal');
	if (status === OK && order) {
		// Don't change credits here, we're using transactions to track that.
		const dist = Game.map.getRoomLinearDistance(order.roomName, this.pos.roomName, true);
		const cost = this.calcTransactionCost(amount, order.roomName);
		this.memory.avgCost = CM_AVG(cost, this.memory.avgCost || 0, 100);
		this.memory.avgDist = CM_AVG(dist, this.memory.avgDist || 0, 100);
		this.memory.avgFee = CM_AVG(this.getFee(order.roomName), this.memory.avgFee || 0, 100);
		this.memory.avgAmt = CM_AVG(amt, this.memory.avgAmt || 0, 100);
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
	if (status === OK) {
		this.busy = true;
		const room = Game.rooms[destination];
		if (room && room.my && room.terminal)
			room.terminal.store[resourceType] += amount;
	}
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
 * @todo: Probably requres a run state?
 */
const TERMINAL_MIN_ARBITRAGE_PROFIT = 0.04;
StructureTerminal.prototype.findArbitrageOrders = function (resource = RESOURCE_ENERGY, minProfit = TERMINAL_MIN_ARBITRAGE_PROFIT) {
	const orders = _.reject(this.getAllOrders({ resourceType: resource }), o => o.amount < 10 || _.get(Game.rooms[o.roomName], 'controller.my', false));
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
	Log.debug(`${this.pos.roomName} creating ${orderType} order for ${amt} ${resource} at price ${price}, status ${status}`, 'Terminal');
	if (status === OK)
		this.credits -= this.calcOrderFee(price, amt);
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
	const status = this.createOrder(ORDER_BUY, resource, price, total);
	if (status !== OK)
		Log.warn(`${this.pos.roomName} creating buy order of ${total} ${resource} at ${price} for ${cost} total, status ${status}`, 'Terminal');
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
	const status = this.createOrder(ORDER_SELL, resource, price, total);
	if (status !== OK)
		Log.warn(`Terminal ${this.pos.roomName} creating sell order for ${total} ${resource} at ${price}, status: ${status}`, 'Terminal');
	return status;
};

StructureTerminal.prototype.calcOrderFee = function (price, amt) {
	return price * amt * MARKET_FEE;
};

StructureTerminal.prototype.getMaximumBuyOrder = function (price) {
	return Math.floor(this.creditsAvailable / (price * (MARKET_FEE + 1)));
};

/**
 * 
 */
StructureTerminal.prototype.import = function (res, amount, note = 'Resource request') {
	if (!res || !amount || amount < TERMINAL_MIN_SEND)
		throw new Error("Invalid operation");
	var busy = false;
	for (const t of this.network) {
		if (t.store[res] < TERMINAL_MIN_SEND || t.store[res] <= amount)
			continue;
		const status = t.send(res, amount, this.pos.roomName, note);
		if (status === OK)
			return status;
		if (status === ERR_BUSY)
			busy = true;
	}
	return (busy) ? ERR_BUSY : ERR_NOT_FOUND;
};