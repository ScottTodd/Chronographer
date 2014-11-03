'use strict';

var WorldMap = function(container, mapData) {
    console.log('WorldMap object!');

    var width = window.innerWidth;
    var height = window.innerHeight;

    var projection = d3.geo.albers()
      .scale(1070)
      .translate([width / 2, height / 2]);

    var zoom = d3.behavior.zoom()
      .translate(projection.translate())
      .scale(projection.scale())
      .scaleExtent([height, 4000 * height]);
      // .on('zoom', zoomed);

    var canvas = d3.select(container).append('canvas')
      .call(zoom)
      .attr('id', 'cgr-worldMap')
      .attr('width', width)
      .attr('height', height);

    var path = d3.geo.path()
      .projection(projection);

    var states = {};
    var context = {};

    d3.json(mapData, function(error, us) {
        states = topojson.feature(us, us.objects.states);
        context = canvas.node().getContext('2d');

        drawMap();
    });

    function drawMap() {
      context.strokeStyle = '#E1D6C1';
      context.fillStyle = '#3E3733';
      context.beginPath();
      path.context(context)(states);
      context.fill();
      context.stroke();
    }
};

module.exports = WorldMap;
