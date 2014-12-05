'use strict';

var chronodataVertexShader = require('./shaders/chronodataVertex');
var chronodataFragmentShader = require('./shaders/chronodataFragment');


var ChronoData = function(radius, opts) {
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
    var locations = [];
    if (opts && opts.dataURL) {
        var jsonData = JSON.parse(loadText(opts.dataURL));
        locations = jsonData.locations;
    }
    if (opts && opts.dataJSON) {
        locations = opts.dataJSON.locations;
    }

    for (var i = 0; i < locations.length; ++i) {
        var timestampMs = parseFloat(locations[i].timestampMs) ||
                          locations[i].Year;

        this.minTime = Math.min(timestampMs, this.minTime);
        this.maxTime = Math.max(timestampMs, this.maxTime);

        var latitude = locations[i].latitudeE7 / 10000000.0 ||
                       locations[i].Latitude;
        var longitude = locations[i].longitudeE7 / 10000000.0 ||
                        locations[i].Longitude;

        var deg2rad = Math.PI / 180.0;
        var phi = latitude * deg2rad;
        var theta = (180 - longitude) * deg2rad;

        var x = (this.radius * 1.01) * Math.cos(phi) * Math.cos(theta);
        var y = (this.radius * 1.01) * Math.sin(phi);
        var z = (this.radius * 1.01) * Math.cos(phi) * Math.sin(theta);

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
      visualizationTime: {
        type: 'f',
        value: this.minTime
      },
      minTime: {
        type: 'f',
        value: this.minTime
      },
      maxTime: {
        type: 'f',
        value: this.maxTime
      },
      percentHighlightRange: {
        type: 'f',
        value: (opts && opts.percentHighlightRange) || 0.10
      },
      minAlpha: {
        type: 'f',
        value: (opts && opts.minAlpha) || 1.0
      },
      maxAlpha: {
        type: 'f',
        value: (opts && opts.maxAlpha) || 1.0
      },
      minColor: {
        type: 'c',
        value: (opts && opts.minColor) || new THREE.Color(0x222222)
      },
      maxColor: {
        type: 'c',
        value: (opts && opts.maxColor) || new THREE.Color(0xEEEEEE)
      },
      minSize: {
        type: 'f',
        value: (opts && opts.minSize) || 12.0
      },
      maxSize: {
        type: 'f',
        value: (opts && opts.maxSize) || 32.0
      }
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
    // particles.sortParticles = true;

    function compare(a, b) {
        if (a.time < b.time) { return -1; }
        if (a.time > b.time) { return 1; }
        return 0;
    }
    this.data.sort(compare);
};


ChronoData.prototype.setScene = function(scene) {
    this.scene = scene;
    scene.add(this.particles);
};


ChronoData.prototype.update = function() {

};


ChronoData.prototype.setTime = function(newTime) {
    this.currentTime = newTime;
    this.material.uniforms['visualizationTime'].value = newTime;
};


ChronoData.prototype.getCurrentTime = function() {
    return this.currentTime;
};


ChronoData.prototype.getMinTime = function() {
    return this.minTime;
};


ChronoData.prototype.getMaxTime = function() {
    return this.maxTime;
};


ChronoData.prototype.getData = function() {
    return this.data;
};


module.exports = ChronoData;
