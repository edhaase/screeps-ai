/**
 * Arr.js
 * 
 * Because extending the built in Array.prototype is a dangerous proposition
 */
module.exports = {
    /**
     * 
     */
    cycle: function(orig,n) {
        var arr = [];
        for(var i=0; i<n; i++)
            arr.push(orig[i % orig.length]);
        return arr;
    },
    
    /**
     * 
     */
    repeat: function(arr, max) {
        var n = Math.min(MAX_CREEP_SIZE / arr.length, max / UNIT_COST(arr));
        n = Math.floor(n);
		return (n <= 0)?[]:this.cycle(arr, arr.length * n);
    }
}