/**
 * role.builder.js
 *
 * Creep role dedicated to building construction sites.
 */
'use strict';

import Body from '/ds/Body';
import { ICON_SHIELD, ICON_BUILD } from '/lib/icons';
import { Log, LOG_LEVEL } from '/os/core/Log';
import { PLAYER_STATUS } from '/Player';

var ignoreCreeps = false;

/* global UNIT_COST, Arr */

/**
 * Average cpu
 * @todo do we want to do a max carry / dist deal?
 */
const MINIMUM_DECAY_CYCLES = 20;
const BUILDER_MAX_FORTIFY_HITS = RAMPART_DECAY_AMOUNT * MINIMUM_DECAY_CYCLES;

const STATE_UNLOAD = 'u';
const STATE_FORTIFY = 'f';
const STATE_DEFAULT = STATE_UNLOAD;

/* eslint-disable consistent-return */
export default {
	boosts: ['LH', 'LH2O', 'XLH2O'],
	have: function (census) {
		return (census.creeps[`${census.roomName}_builder`] || []).length;
	},
	want: function (census) {
		const sites = census.room.find(FIND_MY_CONSTRUCTION_SITES);
		if (!sites || !sites.length)
			return 0;
		return 2;
	},
	oldbody: function (census) {
		const { spawn } = census;
		const partLimit = Math.floor(elimit / BUILD_POWER);
		const avail = Math.max(SPAWN_ENERGY_START, spawn.room.energyCapacityAvailable * 0.80);
		const pattern = [MOVE, MOVE, MOVE, WORK, WORK, CARRY];
		const cost = UNIT_COST(pattern);
		const al = Math.min(Math.floor(cost * (partLimit / 2)), avail);
		let body = Body.repeat(pattern, al); // 400 energy gets me 2 work parts.
		if (_.isEmpty(body)) {
			body = [WORK, CARRY, MOVE, MOVE];
		}
		return body;
	},
	body: function ({ room }, opts = {}) {
		const { elimit = 20 } = opts;
		Log.debug(`Builder from ${room.name}`, 'Unit');
		const partLimit = Math.floor(elimit / BUILD_POWER);
		Log.debug(`Work part limit: ${partLimit}`, 'Unit');
		const avail = Math.max(SPAWN_ENERGY_START, room.energyCapacityAvailable);
		const [w, c, m] = [Math.floor(0.25 * avail), Math.floor(0.25 * avail), Math.floor(0.50 * avail)];
		const [lw, lc, lm] = [0.20 * MAX_CREEP_SIZE, 0.30 * MAX_CREEP_SIZE, 0.50 * MAX_CREEP_SIZE];
		const [aw, ac, am] = [Math.floor(w / BODYPART_COST[WORK]), Math.floor(c / BODYPART_COST[CARRY]), Math.floor(m / BODYPART_COST[MOVE])];
		Log.debug(`Build energy available: ${avail} = ${w} + ${c} + ${m}`, 'Unit');
		Log.debug(`Build part limits: ${lw} ${lc} ${lm}`, 'Unit');
		Log.debug(`Build avail parts: ${aw} ${ac} ${am}`, 'Unit');
		const pw = Math.max(1, Math.min(lw, aw, partLimit));
		const pc = Math.max(1, Math.min(lc, ac));
		const pm = Math.max(1, Math.min(lm, am, pc + pw));
		const rw = w - pw * BODYPART_COST[WORK];
		const rm = m - pm * BODYPART_COST[MOVE];
		const rc = c - pc * BODYPART_COST[CARRY];
		const rem = rw + rc + rm;
		// const pc = CLAMP(1, Math.floor((c + rem) / BODYPART_COST[CARRY]), Math.min(lc, pw + pm));
		// const pw = CLAMP(1, Math.floor( (w+rem) / BODYPART_COST[WORK]), Math.min(lw, partLimit));
		Log.debug(`Build energy remaining: ${rw} ${rc} ${rm} = ${rem}`, 'Unit');
		Log.debug(`Build parts available: ${pw} ${pc} ${pm}`, 'Unit');
		return RLD([pw, WORK, pc, CARRY, pm, MOVE]);
	},
	init: function () {
		this.memory.ignoreRoads = (this.plainSpeed === this.roadSpeed);
	},
	run: function () {
		var status;
		if (this.carry[RESOURCE_ENERGY] <= 0)
			return this.pushState('AcquireEnergy', { allowMove: true, allowHarvest: true });
		const state = this.getState(STATE_DEFAULT);
		if (state === STATE_UNLOAD) {
			if (this.pos.hasConstructionSite()) {
				return this.move(_.random(1, 8));
			}
			const site = this.getTarget(
				({ room }) => room.find(FIND_CONSTRUCTION_SITES),
				(s) => s instanceof ConstructionSite && (s.my || s.owner && Player.status(s.owner.username) >= PLAYER_STATUS.TRUSTED),
				(sites) => _.max(sites, s => ((s.progressPct || STRUCTURE_BUILD_PRIORITY[s.structureType] || DEFAULT_BUILD_JOB_PRIORITY) ** 2) / this.pos.getRangeTo(s))
			);
			if (site) {
				if ((status = this.build(site)) === ERR_NOT_IN_RANGE)
					this.moveTo(site, {
						reusePath: 5,
						ignoreRoads: this.memory.ignoreRoads || true,
						ignoreCreeps: ((this.memory.stuck < 3) ? ignoreCreeps : false),
						range: CREEP_BUILD_RANGE,
						maxRooms: 1
						// ignoreCreeps: false
					});
				else if (status !== OK) {
					if (Math.random() < 0.10)
						this.say(ICON_BUILD, true);
					// Clear obstacles out of the way
					if (OBSTACLE_OBJECT_TYPES.includes(site.structureType)) {
						const obstruction = site.pos.getLivingEntity();
						if (obstruction)
							return obstruction.scatter();
					}
					Log.warn(`${this.name}/${this.pos} build failed with status ${status}`, 'Creep');
					this.defer(15);
				} else if (site.structureType === STRUCTURE_RAMPART || site.structureType === STRUCTURE_WALL) {
					this.say(ICON_SHIELD, true);
					this.setState(STATE_FORTIFY, { pos: site.pos });
				}
			} else if (this.room.isBuildQueueEmpty()) {
				this.setRole('recycle');
			}
		} else if (state === STATE_FORTIFY) {
			const statePos = this.getStateParams().pos;
			const pos = new RoomPosition(statePos.x, statePos.y, statePos.roomName);
			const target = pos.getStructure(STRUCTURE_RAMPART) || pos.getStructure(STRUCTURE_WALL);
			if (!target || target.hits > BUILDER_MAX_FORTIFY_HITS)
				return this.setState(STATE_UNLOAD);
			status = this.repair(target);
			Log.debug(`${this.name}/${this.pos} builder fortifying ${target} with status ${status}`, 'Creep');
			if (status === ERR_NOT_IN_RANGE)
				this.pushState("MoveTo", { pos, range: CREEP_REPAIR_RANGE });
			else if (status !== OK)
				Log.warn(`${this.name}/${this.pos} builder failed to fortify ${target} with status ${status}`, 'Creep');
		}
	}
};