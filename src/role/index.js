import assault from './military/assault';
import attack from './military/attack';
import builder from './economy/builder';
import bulldozer from './economy/bulldozer';
import claimer from './economy/claimer';
import defender from './military/defender';
import disruptor from './military/disruptor';
import dualminer from './economy/dualminer';
import filler from './economy/filler';
import guard from './military/guard';
import harvester from './economy/harvester';
import hauler from './economy/hauler';
import healer from './military/healer';
import miner from './economy/miner';
import pilot from './economy/pilot';
import pioneer from './economy/pioneer';
import probe from './experimental/probe';
import provider from './economy/provider';
import reclaimer from './economy/reclaimer';
import recycle from './recycle';
import repair from './economy/repair';
import reserver from './economy/reserver';
import scav from './economy/scav';
import scientist from './economy/scientist';
import scout from './military/scout';
import signer from './military/signer';
import stomper from './experimental/stomper';
import tank from './military/tank';
import thief from './military/thief';
import upgrader from './economy/upgrader';
import charvest from './economy/charvest';

const ROLES = {
	attack, assault,
	builder, bulldozer,
	claimer, charvest,
	defender, disruptor, dualminer,
	filler, guard, harvester, hauler, healer, miner,
	pilot, pioneer, probe, provider, reclaimer, recycle, repair, reserver, scav, scientist,
	scout, signer, stomper, tank, thief, upgrader
};

export default ROLES;