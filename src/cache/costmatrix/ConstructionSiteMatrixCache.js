/**
 * 
 */
import { Log } from '/os/core/Log';
import { VisibilityError } from '/os/core/errors';
import CostMatrixCache from '/cache/CostMatrixCache';
import ConstructionSiteMatrix from '/ds/costmatrix/ConstructionSiteMatrix';

export const CONSTRUCTION_MATRIX = new CostMatrixCache((roomName) => new ConstructionSiteMatrix(roomName), 'ConstructionMatrix');
CONSTRUCTION_MATRIX.freeze = false;
