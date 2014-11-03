'use strict';

var WorldMap = require('./WorldMap');
var ChronoData = require('./ChronoData');

var Chronographer = function(container, data, mapData) {
    var worldMap = new WorldMap(container, mapData);
    var chronoData = new ChronoData(container, data);

    function animate(t) {
        requestAnimationFrame(animate);

        chronoData.update();
    }

    animate();
};

module.exports = Chronographer;
