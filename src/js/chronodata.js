'use strict';

var chronodataVertexShader = require('./shaders/chronodataVertex');
var chronodataFragmentShader = require('./shaders/chronodataFragment');


var ChronoData = function(container, dataURL) {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

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
    this.renderer.domElement.id = 'cgr-chronoData';

    // effect = new THREE.StereoEffect(renderer);
    // effect.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75,
      window.innerWidth / window.innerHeight, 1, 3000);
    this.camera.position.z = 30;

    this.controls = new THREE.OrbitControls(this.camera,
      this.renderer.domElement);
    this.controls.addEventListener('change', this.render.bind(this));

    this.data = [];
    var times = [];
    this.geometry = new THREE.Geometry();
    var time;
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
        var r = 10.1;

        var x = r * Math.cos(phi) * Math.cos(theta);
        var y = r * Math.cos(phi);
        var z = r * Math.sin(phi) * Math.sin(theta);

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
      highlightTime: {type: 'f', value: 1.0},
      minTime: {type: 'f', value: this.minTime},
      maxTime: {type: 'f', value: this.maxTime},
      percentHighlightRange: {type: 'f', value: 0.1},
      minAlphaScale: {type: 'f', value: 0.0}
    };

    this.material = new THREE.ShaderMaterial({
      attributes:     attributes,
      uniforms:       uniforms,
      vertexShader:   chronodataVertexShader,
      fragmentShader: chronodataFragmentShader,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false
    });

    var particles = new THREE.PointCloud(this.geometry, this.material);
    // particles.frustomCulled = true;
    // particles.sortParticles = true;

    this.scene.add(particles);

    var ambientLight = new THREE.AmbientLight(0x888888);
    this.scene.add(ambientLight);

    var dirLight = new THREE.DirectionalLight(0xcccccc, 0.2);
    dirLight.position.set(5, 3, 5);
    this.scene.add(dirLight);

    var earthGeometry = new THREE.SphereGeometry(10, 80, 60);
    var earthMaterial = new THREE.MeshPhongMaterial({
      map: this.loadTexture('earthmap1k.jpg')
    });

    earthMaterial.bumpMap = this.loadTexture('earthbump1k.jpg');
    earthMaterial.bumpScale = 10;
    earthMaterial.specularMap = this.loadTexture('earthspec1k.jpg');
    earthMaterial.specular = new THREE.Color('grey');

    var earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthMesh.rotation.y = Math.PI;
    this.scene.add(earthMesh);
};


ChronoData.prototype.loadTexture = function(textureName) {
    return THREE.ImageUtils.loadTexture('../../dist/images/' + textureName);
};


ChronoData.prototype.update = function() {
    this.controls.update();

    this.render();
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


ChronoData.prototype.render = function() {
    this.renderer.render(this.scene, this.camera);
};


module.exports = ChronoData;
