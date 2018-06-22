/** ext-structure-container.js */
'use strict';

/* global DEFINE_CACHED_GETTER, CREEP_UPGRADE_RANGE*/

DEFINE_CACHED_GETTER(StructureContainer.prototype, 'isControllerContainer', c => c.pos.inRangeTo(c.room.controller, CREEP_UPGRADE_RANGE));