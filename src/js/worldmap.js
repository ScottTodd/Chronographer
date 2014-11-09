'use strict';

var WorldMap = function(container, mapData) {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.projection = d3.geo.orthographic()
      .scale(325)
      .translate([this.width / 2, this.height / 2])
      .clipAngle(90)
      .rotate([40, -20])
      .precision(0.1);

    var zoom = d3.behavior.zoom()
      .translate(this.projection.translate())
      .scale(this.projection.scale())
      .scaleExtent([this.height, 4000 * this.height]);

    this.canvas = d3.select(container).append('canvas')
      .call(zoom)
      .attr('id', 'cgr-worldMap')
      .attr('width', this.width)
      .attr('height', this.height);

    this.path = d3.geo.path()
      .projection(this.projection);

    d3.json(mapData, this.getData.bind(this));
};

WorldMap.prototype.getData = function(error, world) {
    this.land = topojson.feature(world, world.objects.land);
    this.context = this.canvas.node().getContext('2d');

    this.drawMap();
};

WorldMap.prototype.drawMap = function() {
    this.context.strokeStyle = '#E1D6C1';
    this.context.fillStyle = '#3E3733';
    this.context.beginPath();
    this.path.context(this.context)(this.land);
    this.context.fill();
    this.context.stroke();
};

module.exports = WorldMap;
