/**
 * 
 */
const DEFAULT_AVG_SAMPLES = 100;
export const CM_AVG = (n, p = n, s = DEFAULT_AVG_SAMPLES) => p + (n - p) / s; // Cumulutive moving average.
export const MM_AVG = (n, p = n, s = DEFAULT_AVG_SAMPLES) => ((s - 1) * p + n) / s; // Modified moving average.
export const M_AVG = (n, p = n, s = DEFAULT_AVG_SAMPLES, w = 1) => p + (n / s / w) - (p / s);

export const CLAMP = function (low, value, high = Infinity) {
	return Math.max(low, Math.min(value, high));
};