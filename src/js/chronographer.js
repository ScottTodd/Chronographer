'use strict';

var WorldMap = require('./WorldMap');
var ChronoData = require('./ChronoData');


var Chronographer = function(container, data) {
    // this.worldMap = new WorldMap(container, mapData);
    this.chronoData = new ChronoData(container, data);
};


Chronographer.prototype.update = function() {
    this.chronoData.update();
};


Chronographer.prototype.setTime = function(visualizationTime) {
    this.chronoData.setTime(visualizationTime);
};


Chronographer.prototype.getMinTime = function() {
    return this.chronoData.getMinTime();
};


Chronographer.prototype.getMaxTime = function() {
    return this.chronoData.getMaxTime();
};

module.exports = Chronographer;
