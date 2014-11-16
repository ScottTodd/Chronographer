'use strict';

var chronodataVertexShader = require('./shaders/chronodataVertex');
var chronodataFragmentShader = require('./shaders/chronodataFragment');


var ChronoData = function(dataURL, radius) {
    this.radius = radius;

    function loadText(url) {
      var request = new XMLHttpRequest();
      request.open('GET', url, false); // Synchronous.
      request.overrideMimeType('text/plain');
      request.send();

      return request.responseText;
    }

    this.data = [];
    var times = [];
    this.geometry = new THREE.Geometry();
    this.minTime = Number.MAX_VALUE;
    this.maxTime = 0;

    // Load data from a json file.
    var jsonData = JSON.parse(loadText(dataURL));
    var locations = jsonData.locations;

    for (var i = 0; i < locations.length; ++i) {
        var timestampMs = locations[i].timestampMs;

        this.minTime = Math.min(timestampMs, this.minTime);
        this.maxTime = Math.max(timestampMs, this.maxTime);

        var latitude = locations[i].latitudeE7 / 10000000.0;
        var longitude = locations[i].longitudeE7 / 10000000.0;

        var deg2rad = Math.PI / 180.0;
        var phi = (90 - latitude) * deg2rad;
        var theta = (180 - longitude) * deg2rad;

        var x = (this.radius * 1.01) * Math.cos(phi) * Math.cos(theta);
        var y = (this.radius * 1.01) * Math.cos(phi);
        var z = (this.radius * 1.01) * Math.sin(phi) * Math.sin(theta);

        this.data.push({
          'lat': latitude,
          'long': longitude,
          'position': [x, y, z],
          'time': timestampMs
        });
        times.push(timestampMs);

        this.geometry.vertices.push(new THREE.Vector3(x, y, z));
    }

    var attributes = {
      pointTime: { type: 'f', value: times }
    };

    var uniforms = {
      particleTexture: {
        type: 't',
        value: THREE.ImageUtils.loadTexture('images/circle_alpha.png')
      },
      highlightTime: {type: 'f', value: this.minTime},
      minTime: {type: 'f', value: this.minTime},
      maxTime: {type: 'f', value: this.maxTime},
      percentHighlightRange: {type: 'f', value: 0.02},
      minAlphaScale: {type: 'f', value: 0.0}
    };

    this.material = new THREE.ShaderMaterial({
      attributes:     attributes,
      uniforms:       uniforms,
      vertexShader:   chronodataVertexShader,
      fragmentShader: chronodataFragmentShader,
      transparent:    true,
      blending:       THREE.NormalBlending,
      depthWrite:     false
    });

    this.particles = new THREE.PointCloud(this.geometry, this.material);
    // particles.frustomCulled = true;
    // particles.sortParticles = true;

};


ChronoData.prototype.setScene = function(scene) {
    this.scene = scene;
    scene.add(this.particles);
};


ChronoData.prototype.update = function() {

};


ChronoData.prototype.setTime = function(visualizationTime) {
    this.material.uniforms['highlightTime'].value = visualizationTime;
};


ChronoData.prototype.getMinTime = function() {
    return this.minTime;
};


ChronoData.prototype.getMaxTime = function() {
    return this.maxTime;
};


module.exports = ChronoData;
