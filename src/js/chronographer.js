'use strict';

var WorldMap = require('./WorldMap');
var ChronoData = require('./ChronoData');


var Chronographer = function(container, data, mapData) {
    this.worldMap = new WorldMap(container, mapData);
    this.chronoData = new ChronoData(container, data, this.worldMap.projection);
};


Chronographer.prototype.update = function() {
    this.chronoData.update();
};


module.exports = Chronographer;
