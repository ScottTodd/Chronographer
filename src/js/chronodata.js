'use strict';

var chronodataVertexShader = require('./shaders/chronodataVertex');
var chronodataFragmentShader = require('./shaders/chronodataFragment');


var ChronoData = function(container, dataURL, projection) {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.projection = projection;

    function loadText(url) {
      var request = new XMLHttpRequest();
      request.open('GET', url, false); // Synchronous.
      request.overrideMimeType('text/plain');
      request.send();

      return request.responseText;
    }

    this.renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = 'renderer';

    // effect = new THREE.StereoEffect(renderer);
    // effect.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75,
      window.innerWidth / window.innerHeight, 1, 3000);
    this.camera.position.z = 622.5; // 1000.0

    this.data = [];
    var times = [];
    this.geometry = new THREE.Geometry();
    var time;
    var minTime, maxTime;

    // Load data from a json file.
    var jsonData = JSON.parse(loadText(dataURL));
    var locations = jsonData.locations;
    for (var i = 0; i < locations.length; ++i) {
        var timestampMs = locations[i].timestampMs;

        minTime = Math.min(timestampMs, minTime);
        maxTime = Math.max(timestampMs, maxTime);

        var latitude = locations[i].latitudeE7 / 10000000.0;
        var longitude = locations[i].longitudeE7 / 10000000.0;

        var screenCoordinates = this.projection([longitude, latitude]);
        var worldCoordinates = this.screenToWorld(screenCoordinates);
        // var worldCoordinates = new THREE.Vector3(Math.random() * 200,
        //                                          Math.random() * 200,
        //                                          Math.random() * 200);

        this.data.push({
          'lat': latitude,
          'long': longitude,
          'position': [
          worldCoordinates.x,
          worldCoordinates.y,
          worldCoordinates.z],
          'time': timestampMs
        });

        this.geometry.vertices.push(new THREE.Vector3(worldCoordinates.x,
                                                      worldCoordinates.y,
                                                      worldCoordinates.z));
        times.push(timestampMs);
    }

    var attributes = {
      pointTime: { type: 'f', value: times }
    };

    var uniforms = {
      particleTexture: {
        type: 't',
        value: THREE.ImageUtils.loadTexture('images/circle_alpha.png')
      },
      highlightTime: {type: 'f', value: 1.0},
      minTime: {type: 'f', value: minTime},
      maxTime: {type: 'f', value: maxTime},
      percentHighlightRange: {type: 'f', value: 1.0},
      minAlphaScale: {type: 'f', value: 0.1}
    };

    // var material = new THREE.PointCloudMaterial({
    //     color: 0xFFFFFF,
    //     size: 20,
    //     map: THREE.ImageUtils.loadTexture(
    //         'images/circle_alpha.png'
    //     ),
    //     blending: THREE.AdditiveBlending,
    //     transparent: true
    // });

    var material = new THREE.ShaderMaterial({
      attributes:     attributes,
      uniforms:       uniforms,
      vertexShader:   chronodataVertexShader,
      fragmentShader: chronodataFragmentShader,
      transparent:    true,
      blending:       THREE.AdditiveBlending
    });

    var particles = new THREE.PointCloud(this.geometry, material);
    // particles.frustomCulled = true;
    particles.sortParticles = true;

    this.scene.add(particles);

    // timeInput.setAttribute('min', minTime);
    // timeInput.setAttribute('max', maxTime);
    // timeRange = maxTime - minTime;
    // setInputTime(minTime);
};


ChronoData.prototype.update = function() {
    this.updatePositions();

    this.renderer.render(this.scene, this.camera);
};


ChronoData.prototype.updatePositions = function() {
    for (var i = 0; i < this.data.length; ++i) {
      var screenCoordinates = this.projection([
        this.data[i]['long'],
        this.data[i]['lat']]);
      var worldCoordinates = this.screenToWorld(screenCoordinates);

      this.data['position'] = [
        worldCoordinates.x,
        worldCoordinates.y,
        worldCoordinates.z];
      this.geometry.vertices[i].x = worldCoordinates.x;
      this.geometry.vertices[i].y = worldCoordinates.y;
      this.geometry.vertices[i].z = worldCoordinates.z;
    }

    this.geometry.verticesNeedUpdate = true;
};


ChronoData.prototype.screenToWorld = function(screenCoordinates) {
    var vector = new THREE.Vector3(
      (screenCoordinates[0] / this.width) * 2 - 1,
      -(screenCoordinates[1] / this.height) * 2 + 1, 0.5);

    vector.unproject(this.camera);
    var dir = vector.sub(this.camera.position).normalize();
    var distance = -this.camera.position.z / dir.z;
    var pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
    return pos;
};


module.exports = ChronoData;
