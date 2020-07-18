import cron from './cron';
import empire from './empire';
import intershard from './intershard';
import legacy from './legacy';
import legacy_rooms from './legacy/rooms';
import overlay from './overlay';
import planner from './planner';
import stats from './stats';
import spawn from './spawn';

/** Intel */
import intel_alliances from './intel/alliances';
import intel from './intel/intel';
import recon from './intel/recon';
import fsrecon from './intel/fsrecon';

/** Economic */
import build from './economy/build';
import demolish from './economy/demolish';
import market from './economy/market';
import pixels from './economy/pixels';
import remotes from './economy/remotes';

/** Military */

const PROGRAMS = {
	'intel.alliances': intel_alliances,
	'legacy.rooms': legacy_rooms,
	fsrecon,
	build,
	cron,
	demolish,
	empire,
	intel,
	intershard,
	legacy,
	market,
	overlay,
	pixels,
	planner,
	recon,
	remotes,
	stats,
	spawn
};

global.PROGRAMS = PROGRAMS;

export default PROGRAMS;