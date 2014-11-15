'use strict';

var ChronoData = require('./ChronoData');
var ChronoControls = require('./ChronoControls');


var Chronographer = function(container, data) {
    this.chronoData = new ChronoData(container, data);
    this.chronoControls = new ChronoControls(container);

    var minTime = this.chronoData.getMinTime();
    var maxTime = this.chronoData.getMaxTime();
    this.chronoControls.setTimeRange(minTime, maxTime);

    this.clock = new THREE.Clock();
};


Chronographer.prototype.update = function() {
    var dt = this.clock.getDelta();

    this.chronoControls.update(dt);
    this.chronoData.setTime(this.chronoControls.getTime());

    this.chronoData.update(dt);
};


Chronographer.prototype.setTime = function(visualizationTime) {
    this.chronoData.setTime(visualizationTime);
};


module.exports = Chronographer;
