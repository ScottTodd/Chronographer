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
    this.camera.position.z = 622.5; // 1000.0

    this.controls = new THREE.OrbitControls(this.camera,
      this.renderer.domElement);
    this.controls.addEventListener('change', this.render.bind(this));

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

        var phi = (180 - latitude) * Math.PI / 180;
        var theta = (180 - longitude) * Math.PI / 180;

        var x = 210 * Math.cos(phi) * Math.cos(theta);
        var y = 210 * Math.cos(phi) * Math.sin(theta);
        var z = 210 * Math.sin(phi);

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
      minTime: {type: 'f', value: minTime},
      maxTime: {type: 'f', value: maxTime},
      percentHighlightRange: {type: 'f', value: 1.0},
      minAlphaScale: {type: 'f', value: 0.1}
    };

    var material = new THREE.ShaderMaterial({
      attributes:     attributes,
      uniforms:       uniforms,
      vertexShader:   chronodataVertexShader,
      fragmentShader: chronodataFragmentShader,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false
    });

    var particles = new THREE.PointCloud(this.geometry, material);
    // particles.frustomCulled = true;
    // particles.sortParticles = true;

    this.scene.add(particles);

    // timeInput.setAttribute('min', minTime);
    // timeInput.setAttribute('max', maxTime);
    // timeRange = maxTime - minTime;
    // setInputTime(minTime);

    var light = new THREE.AmbientLight(0x888888);
    this.scene.add(light);

    var earthGeometry = new THREE.SphereGeometry(200, 40, 30);
    var earthMaterial = new THREE.MeshPhongMaterial({
      map: THREE.ImageUtils.loadTexture('../../dist/images/EarthMapAtmos.jpg')
    });
    var earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    this.scene.add(earthMesh);
};


ChronoData.prototype.update = function() {
    this.controls.update();

    this.render();
};


ChronoData.prototype.render = function() {
    this.renderer.render(this.scene, this.camera);
};


module.exports = ChronoData;
