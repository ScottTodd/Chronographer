(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var ChronoControls = function(container) {
    this.totalPlayTime = 10.0;
    this.paused = true;
    this.loop = true;

    // Create controls from imported html.
    var content = document.querySelector('link[rel="import"]').import;
    var controls = content.getElementById('chrono-controls');
    container.appendChild(controls);

    this.playPause = document.getElementById('chrono-playPauseButton');
    this.timeInput = document.getElementById('chrono-timeInput');
    this.dateBox   = document.getElementById('chrono-dateBox');

    // Listen to play/pause events (button click and space bar).
    this.playPause.addEventListener('click', this.handlePlayPause.bind(this),
                                    false);
    document.onkeypress = function(event) {
        if (event.keyCode === 32) {
            event.preventDefault();
            this.handlePlayPause();
        }
    }.bind(this);

    // Also update if the input slider is changed directly.
    this.timeInput.addEventListener('change', this.updateTimeDisplay.bind(this),
                                    false);
};


ChronoControls.prototype.getTime = function() {
    return parseFloat(this.timeInput.value);
};


ChronoControls.prototype.setTimeRange = function(minTime, maxTime) {
    this.minTime = minTime;
    this.maxTime = maxTime;
    this.timeRange = maxTime - minTime;

    this.timeInput.setAttribute('min', minTime);
    this.timeInput.setAttribute('max', maxTime);
    this.setInputTime(minTime);
};


ChronoControls.prototype.setInputTime = function(inputTime) {
    var clampedValue = Math.max(Math.min(inputTime, this.maxTime),
                                this.minTime);
    this.timeInput.value = clampedValue;

    this.updateTimeDisplay();
};


ChronoControls.prototype.updateTimeDisplay = function() {
    // var date = new Date(parseFloat(this.timeInput.value));
    // this.dateBox.textContent = this.getFormattedDate(date);
    this.dateBox.textContent = Math.round(parseFloat(this.timeInput.value));
};


ChronoControls.prototype.getFormattedDate = function(date) {
    var year = date.getFullYear();
    var month = (1 + date.getMonth()).toString();
    month = month.length > 1 ? month : '0' + month;
    var day = date.getDate().toString();
    day = day.length > 1 ? day : '0' + day;
    return year + '/' + month + '/' + day;
};


ChronoControls.prototype.handlePlayPause = function() {
    this.loop = false;
    this.paused = !this.paused;
    if (parseFloat(this.timeInput.value) >= this.maxTime) {
        this.paused = true;
        this.setInputTime(this.minTime);
    }
};


ChronoControls.prototype.update = function(dt) {
    if (!this.paused) {
        // Scale dt to cover this.timeRange over this.totalPlaytime.
        var deltaTime = this.timeRange / this.totalPlayTime * dt;
        var newTime = parseFloat(this.timeInput.value) + deltaTime;
        this.setInputTime(newTime);

        // End of time range? Loop back to the start or pause.
        if (newTime >= this.maxTime) {
            if (this.loop) {
                this.setInputTime(this.minTime);
            } else {
                this.paused = true;
            }
        }
    }
};


module.exports = ChronoControls;

},{}],2:[function(require,module,exports){
'use strict';

var chronodataVertexShader = require('./shaders/chronodataVertex');
var chronodataFragmentShader = require('./shaders/chronodataFragment');


var ChronoData = function(dataURL, radius, opts) {
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

},{"./shaders/chronodataFragment":8,"./shaders/chronodataVertex":9}],3:[function(require,module,exports){
'use strict';

var ChronoData = require('./ChronoData');
var ChronoControls = require('./ChronoControls');
var DeviceOrbitControls = require('./DeviceOrbitControls');
var Earth = require('./Earth');
var FollowLine = require('./FollowLine');


var Chronographer = function(container, data, opts) {
    if (!Detector.webgl) { Detector.addGetWebGLMessage(); }

    this.container = container;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.radius = 1000;

    this.setupRenderer();
    this.setupScene();

    this.chronoData = new ChronoData(data, this.radius, opts);
    this.chronoData.setScene(this.scene);
    var minTime = this.chronoData.getMinTime();
    var maxTime = this.chronoData.getMaxTime();

    this.chronoControls = new ChronoControls(container);
    this.chronoControls.setTimeRange(minTime, maxTime);

    this.earth = new Earth(this.radius);
    this.earth.setScene(this.scene);

    if (opts.followLine) {
        this.followLine = new FollowLine(this.chronoData, this.radius);
        this.followLine.setScene(this.scene);
    }
};


Chronographer.prototype.setupRenderer = function() {
    this.renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = 'cgr-chronoData';

    this.effect = new THREE.StereoEffect(this.renderer);
    this.effect.setSize(this.width, this.height);
};


Chronographer.prototype.onWindowResize = function() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.effect.setSize(this.width, this.height);
};


Chronographer.prototype.setOrientationControls = function() {
    this.controls = new DeviceOrbitControls(this.camera, this.radius * 2.0);

    this.renderer.domElement.addEventListener('click',
                                              this.fullscreen.bind(this),
                                              false);

    window.removeEventListener('deviceorientation',
                               this.setOrientationControls);
};


Chronographer.prototype.fullscreen = function() {
    if (this.container.requestFullscreen) {
        this.container.requestFullscreen();
    } else if (this.container.msRequestFullscreen) {
        this.container.msRequestFullscreen();
    } else if (this.container.mozRequestFullScreen) {
        this.container.mozRequestFullScreen();
    } else if (this.container.webkitRequestFullscreen) {
        this.container.webkitRequestFullscreen();
    }

    var targetOrientation = ['landscape-primary', 'landscape-secondary'];
    if (screen.lockOrientation) {
        screen.lockOrientation(targetOrientation);
    } else if (screen.mozLockOrientation) {
        screen.mozLockOrientation(targetOrientation);
    } else if (screen.msLockOrientation) {
        screen.msLockOrientation(targetOrientation);
    } else if (screen.orientation.lock) {
        screen.orientation.lock(targetOrientation);
    }
};


Chronographer.prototype.setupScene = function() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75,
      window.innerWidth / window.innerHeight, 1, 30000);
    this.camera.position.z = -(this.radius * 1.5);
    this.camera.position.y = this.radius * 1.2;
    this.camera.lookAt(this.scene.position);

    this.controls = new THREE.OrbitControls(this.camera,
      this.renderer.domElement);
    this.controls.addEventListener('change', this.render.bind(this));
    this.controls.noPan = true;
    this.controls.rotateSpeed = 0.5;

    var ambientLight = new THREE.AmbientLight(0x888888);
    this.scene.add(ambientLight);

    var dirLight = new THREE.DirectionalLight(0xcccccc, 0.2);
    dirLight.position.set(5, 3, 5);
    this.scene.add(dirLight);

    this.clock = new THREE.Clock();

    window.addEventListener('resize', this.onWindowResize.bind(this), false);
    window.addEventListener('deviceorientation',
                            this.setOrientationControls.bind(this), false);
};


Chronographer.prototype.update = function() {
    var dt = this.clock.getDelta();

    this.chronoControls.update(dt);
    this.chronoData.setTime(this.chronoControls.getTime());

    this.chronoData.update(dt);
    if (this.followLine) {
        this.followLine.update(dt);
    }

    this.controls.update(dt);
    this.render();
};


Chronographer.prototype.render = function() {
    this.renderer.clear();
    // this.renderer.render(this.scene, this.camera);
    this.effect.render(this.scene, this.camera);
};


module.exports = Chronographer;

},{"./ChronoControls":1,"./ChronoData":2,"./DeviceOrbitControls":4,"./Earth":5,"./FollowLine":6}],4:[function(require,module,exports){
'use strict';

var DeviceOrbitControls = function(camera, radius) {
    this.camera = camera;
    this.radius = radius;

    window.addEventListener('deviceorientation',
                             this.setOrientation.bind(this), false);
};


DeviceOrbitControls.prototype.setOrientation = function(event) {
    var deg2rad = Math.PI / 180.0;
    var alpha = -((event.alpha) * deg2rad);
    var gamma =  ((event.gamma + 90) * deg2rad);

    var x = this.radius * Math.cos(gamma) * Math.cos(alpha);
    var y = this.radius * Math.sin(gamma);
    var z = this.radius * Math.cos(gamma) * Math.sin(alpha);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));
};


DeviceOrbitControls.prototype.update = function() {

};


module.exports = DeviceOrbitControls;

},{}],5:[function(require,module,exports){
'use strict';

var Earth = function(radius) {
    var earthGeometry = new THREE.SphereGeometry(radius, 80, 60);
    var earthMaterial = new THREE.MeshPhongMaterial({
      map: this.loadTexture('earth_diffuse_4k.jpg')
      // map: this.loadTexture('earth_diffuse_night_4k.jpg')
    });

    earthMaterial.bumpMap = this.loadTexture('earth_bump_2k.jpg');
    earthMaterial.bumpScale = radius / 2.0;
    earthMaterial.specularMap = this.loadTexture('earth_specular_2k.jpg');
    earthMaterial.specular = new THREE.Color(0x3A3A3A);

    this.earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    this.earthMesh.rotation.y = Math.PI;

    var boundariesMaterial = new THREE.MeshBasicMaterial({
      map: this.loadTexture('earth_boundaries_2k.png'),
      transparent: true,
      opacity: 0.5
    });

    this.boundariesMesh = new THREE.Mesh(earthGeometry, boundariesMaterial);
    this.boundariesMesh.rotation.y = Math.PI;
};


Earth.prototype.setScene = function(scene) {
    this.scene = scene;
    scene.add(this.earthMesh);
    scene.add(this.boundariesMesh);
};


Earth.prototype.loadTexture = function(textureName) {
  // TODO: customize path or images, this relative path is nasty.
    return THREE.ImageUtils.loadTexture('../../dist/images/' + textureName);
};


module.exports = Earth;

},{}],6:[function(require,module,exports){
'use strict';

var FollowLine = function(chronoData, radius) {
    this.chronoData = chronoData;
    this.radius = radius;
    this.maxPoints = 1000;

    this.curve = new THREE.SplineCurve3([
      new THREE.Vector3(0,0,0),
      new THREE.Vector3(0,0,0)
    ]);

    this.curvePoints = [];

    this.curveGeometry = new THREE.Geometry();
    this.curveGeometry.vertices = this.curve.getPoints(200);

    this.curveMaterial = new THREE.LineBasicMaterial( { color: 0xcccccc } );

    this.line = new THREE.Line(this.curveGeometry, this.curveMaterial);

    this.data = chronoData.getData();
    this.lastTime = chronoData.getMinTime();
    this.currentDataIndex = 0;
};


FollowLine.prototype.setScene = function(scene) {
    this.scene = scene;
    scene.add(this.line);
};


FollowLine.prototype.update = function() {
    var currentTime = this.chronoData.getCurrentTime();

    if (currentTime < this.lastTime) {
        this.reset(currentTime);
    }

    while (currentTime > this.data[this.currentDataIndex].time) {
        this.currentDataIndex++;
        this.addPoint();
    }

    this.lastTime = currentTime;
};


FollowLine.prototype.reset = function(currentTime) {
    this.curvePoints = [];
    this.currentDataIndex = 0;

    while (currentTime > this.data[this.currentDataIndex].time) {
        this.currentDataIndex++;
    }
};


FollowLine.prototype.addPoint = function() {
    var nextPosition = this.data[this.currentDataIndex].position;
    this.curvePoints.push(new THREE.Vector3(nextPosition[0],
                                            nextPosition[1],
                                            nextPosition[2]));
    if (this.curvePoints.length > this.maxPoints) {
        this.curvePoints.shift();
    }

    this.curve = new THREE.SplineCurve3(this.curvePoints);

    this.curveGeometry.vertices = this.curve.getPoints(this.maxPoints * 3);
    this.line.geometry.verticesNeedUpdate = true;
};


module.exports = FollowLine;

},{}],7:[function(require,module,exports){
// Entry point for building.

var Chronographer = require('./Chronographer');

window.Chronographer = Chronographer;

},{"./Chronographer":3}],8:[function(require,module,exports){
'use strict';

var chronodataFragment = '' +
    'uniform sampler2D particleTexture; \n' +
    ' \n' +
    'varying float t; \n' +
    'varying vec3 timeColor; \n' +
    'varying float timeAlpha; \n' +
    ' \n' +
    'void main() { \n' +
    '    float textureAlpha = texture2D(particleTexture, gl_PointCoord).a; \n' +
    '    float alpha = textureAlpha * timeAlpha; \n' +
    ' \n' +
    '    vec3 color = timeColor; \n' +
    ' \n' +
    '    gl_FragColor = vec4(color, alpha); \n' +
    '} \n' +
    '';

module.exports = chronodataFragment;

},{}],9:[function(require,module,exports){
'use strict';

var chronodataVertex = '' +
    'attribute float pointTime; \n' +
    ' \n' +
    'uniform float minTime; \n' +
    'uniform float maxTime; \n' +
    'uniform float visualizationTime; \n' +
    'uniform float percentHighlightRange; \n' +
    ' \n' +
    'uniform float minAlpha; \n' +
    'uniform float maxAlpha; \n' +
    'uniform vec3 minColor; \n' +
    'uniform vec3 maxColor; \n' +
    'uniform float minSize; \n' +
    'uniform float maxSize; \n' +
    ' \n' +
    'varying float t; \n' +
    'varying float timeAlpha; \n' +
    'varying vec3 timeColor; \n' +
    ' \n' +
    'float lerp(float minValue, float maxValue, float t) { \n' +
    '    return (minValue * (1.0 - t)) + (maxValue * t); \n' +
    '} \n' +
    ' \n' +
    'float inverseLerp(float value, float minValue, float maxValue) { \n' +
    '    float valueRange = maxValue - minValue; \n' +
    '    float inverseLerped = (value - minValue) / valueRange; \n' +
    '    float clamped = clamp(inverseLerped, 0.0, 1.0); \n' +
    '    return inverseLerped; \n' +
    '} \n' +
    ' \n' +
    '// RGB to HSV and HSV to RGB \n' +
    '// source: http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl \n' +
    'vec3 rgb2hsv(vec3 c) { \n' +
    '    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); \n' +
    '    vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy); \n' +
    '    vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx); \n' +
    ' \n' +
    '    float d = q.x - min(q.w, q.y); \n' +
    '    float e = 1.0e-10; \n' +
    '    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); \n' +
    '} \n' +
    ' \n' +
    'vec3 hsv2rgb(vec3 c) { \n' +
    '    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); \n' +
    '    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); \n' +
    '    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); \n' +
    '} \n' +
    ' \n' +
    ' \n' +
    'void main() { \n' +
    '    vec4 mvPosition = viewMatrix * vec4(position, 1.0); \n' +
    '    gl_Position = projectionMatrix * mvPosition; \n' +
    ' \n' +
    '    float vertexPercent = inverseLerp(pointTime, minTime, maxTime); \n' +
    '    float visPercent = inverseLerp(visualizationTime, minTime, maxTime); \n' +
    '    float percentDifference = abs(vertexPercent - visPercent); \n' +
    '    // Scale difference based on highlight range into an interpolation time. \n' +
    '    t = clamp(1.0 - percentDifference / percentHighlightRange, 0.0, 1.0); \n' +
    ' \n' +
    '    gl_PointSize = lerp(minSize, maxSize, t); \n' +
    ' \n' +
    '    timeAlpha = lerp(minAlpha, maxAlpha, t); \n' +
    ' \n' +
    '    vec3 minHSV = rgb2hsv(minColor); \n' +
    '    vec3 maxHSV = rgb2hsv(maxColor); \n' +
    '    float h = lerp(minHSV.x, maxHSV.x, t); \n' +
    '    float s = lerp(minHSV.y, maxHSV.y, t); \n' +
    '    float v = lerp(minHSV.z, maxHSV.z, t); \n' +
    '    timeColor = hsv2rgb(vec3(h, s, v)); \n' +
    '} \n' +
    '';

module.exports = chronodataVertex;

},{}]},{},[7])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwic3JjXFxqc1xcQ2hyb25vQ29udHJvbHMuanMiLCJzcmNcXGpzXFxDaHJvbm9EYXRhLmpzIiwic3JjXFxqc1xcQ2hyb25vZ3JhcGhlci5qcyIsInNyY1xcanNcXERldmljZU9yYml0Q29udHJvbHMuanMiLCJzcmNcXGpzXFxFYXJ0aC5qcyIsInNyY1xcanNcXEZvbGxvd0xpbmUuanMiLCJzcmNcXGpzXFxtYWluLmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YUZyYWdtZW50LmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YVZlcnRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIENocm9ub0NvbnRyb2xzID0gZnVuY3Rpb24oY29udGFpbmVyKSB7XHJcbiAgICB0aGlzLnRvdGFsUGxheVRpbWUgPSAxMC4wO1xyXG4gICAgdGhpcy5wYXVzZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5sb29wID0gdHJ1ZTtcclxuXHJcbiAgICAvLyBDcmVhdGUgY29udHJvbHMgZnJvbSBpbXBvcnRlZCBodG1sLlxyXG4gICAgdmFyIGNvbnRlbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdsaW5rW3JlbD1cImltcG9ydFwiXScpLmltcG9ydDtcclxuICAgIHZhciBjb250cm9scyA9IGNvbnRlbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby1jb250cm9scycpO1xyXG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGNvbnRyb2xzKTtcclxuXHJcbiAgICB0aGlzLnBsYXlQYXVzZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tcGxheVBhdXNlQnV0dG9uJyk7XHJcbiAgICB0aGlzLnRpbWVJbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tdGltZUlucHV0Jyk7XHJcbiAgICB0aGlzLmRhdGVCb3ggICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tZGF0ZUJveCcpO1xyXG5cclxuICAgIC8vIExpc3RlbiB0byBwbGF5L3BhdXNlIGV2ZW50cyAoYnV0dG9uIGNsaWNrIGFuZCBzcGFjZSBiYXIpLlxyXG4gICAgdGhpcy5wbGF5UGF1c2UuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmhhbmRsZVBsYXlQYXVzZS5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSk7XHJcbiAgICBkb2N1bWVudC5vbmtleXByZXNzID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gMzIpIHtcclxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgdGhpcy5oYW5kbGVQbGF5UGF1c2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQodGhpcyk7XHJcblxyXG4gICAgLy8gQWxzbyB1cGRhdGUgaWYgdGhlIGlucHV0IHNsaWRlciBpcyBjaGFuZ2VkIGRpcmVjdGx5LlxyXG4gICAgdGhpcy50aW1lSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy51cGRhdGVUaW1lRGlzcGxheS5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmdldFRpbWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiBwYXJzZUZsb2F0KHRoaXMudGltZUlucHV0LnZhbHVlKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuc2V0VGltZVJhbmdlID0gZnVuY3Rpb24obWluVGltZSwgbWF4VGltZSkge1xyXG4gICAgdGhpcy5taW5UaW1lID0gbWluVGltZTtcclxuICAgIHRoaXMubWF4VGltZSA9IG1heFRpbWU7XHJcbiAgICB0aGlzLnRpbWVSYW5nZSA9IG1heFRpbWUgLSBtaW5UaW1lO1xyXG5cclxuICAgIHRoaXMudGltZUlucHV0LnNldEF0dHJpYnV0ZSgnbWluJywgbWluVGltZSk7XHJcbiAgICB0aGlzLnRpbWVJbnB1dC5zZXRBdHRyaWJ1dGUoJ21heCcsIG1heFRpbWUpO1xyXG4gICAgdGhpcy5zZXRJbnB1dFRpbWUobWluVGltZSk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLnNldElucHV0VGltZSA9IGZ1bmN0aW9uKGlucHV0VGltZSkge1xyXG4gICAgdmFyIGNsYW1wZWRWYWx1ZSA9IE1hdGgubWF4KE1hdGgubWluKGlucHV0VGltZSwgdGhpcy5tYXhUaW1lKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1pblRpbWUpO1xyXG4gICAgdGhpcy50aW1lSW5wdXQudmFsdWUgPSBjbGFtcGVkVmFsdWU7XHJcblxyXG4gICAgdGhpcy51cGRhdGVUaW1lRGlzcGxheSgpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS51cGRhdGVUaW1lRGlzcGxheSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgLy8gdmFyIGRhdGUgPSBuZXcgRGF0ZShwYXJzZUZsb2F0KHRoaXMudGltZUlucHV0LnZhbHVlKSk7XHJcbiAgICAvLyB0aGlzLmRhdGVCb3gudGV4dENvbnRlbnQgPSB0aGlzLmdldEZvcm1hdHRlZERhdGUoZGF0ZSk7XHJcbiAgICB0aGlzLmRhdGVCb3gudGV4dENvbnRlbnQgPSBNYXRoLnJvdW5kKHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuZ2V0Rm9ybWF0dGVkRGF0ZSA9IGZ1bmN0aW9uKGRhdGUpIHtcclxuICAgIHZhciB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xyXG4gICAgdmFyIG1vbnRoID0gKDEgKyBkYXRlLmdldE1vbnRoKCkpLnRvU3RyaW5nKCk7XHJcbiAgICBtb250aCA9IG1vbnRoLmxlbmd0aCA+IDEgPyBtb250aCA6ICcwJyArIG1vbnRoO1xyXG4gICAgdmFyIGRheSA9IGRhdGUuZ2V0RGF0ZSgpLnRvU3RyaW5nKCk7XHJcbiAgICBkYXkgPSBkYXkubGVuZ3RoID4gMSA/IGRheSA6ICcwJyArIGRheTtcclxuICAgIHJldHVybiB5ZWFyICsgJy8nICsgbW9udGggKyAnLycgKyBkYXk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmhhbmRsZVBsYXlQYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5sb29wID0gZmFsc2U7XHJcbiAgICB0aGlzLnBhdXNlZCA9ICF0aGlzLnBhdXNlZDtcclxuICAgIGlmIChwYXJzZUZsb2F0KHRoaXMudGltZUlucHV0LnZhbHVlKSA+PSB0aGlzLm1heFRpbWUpIHtcclxuICAgICAgICB0aGlzLnBhdXNlZCA9IHRydWU7XHJcbiAgICAgICAgdGhpcy5zZXRJbnB1dFRpbWUodGhpcy5taW5UaW1lKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZHQpIHtcclxuICAgIGlmICghdGhpcy5wYXVzZWQpIHtcclxuICAgICAgICAvLyBTY2FsZSBkdCB0byBjb3ZlciB0aGlzLnRpbWVSYW5nZSBvdmVyIHRoaXMudG90YWxQbGF5dGltZS5cclxuICAgICAgICB2YXIgZGVsdGFUaW1lID0gdGhpcy50aW1lUmFuZ2UgLyB0aGlzLnRvdGFsUGxheVRpbWUgKiBkdDtcclxuICAgICAgICB2YXIgbmV3VGltZSA9IHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpICsgZGVsdGFUaW1lO1xyXG4gICAgICAgIHRoaXMuc2V0SW5wdXRUaW1lKG5ld1RpbWUpO1xyXG5cclxuICAgICAgICAvLyBFbmQgb2YgdGltZSByYW5nZT8gTG9vcCBiYWNrIHRvIHRoZSBzdGFydCBvciBwYXVzZS5cclxuICAgICAgICBpZiAobmV3VGltZSA+PSB0aGlzLm1heFRpbWUpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMubG9vcCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRJbnB1dFRpbWUodGhpcy5taW5UaW1lKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENocm9ub0NvbnRyb2xzO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgY2hyb25vZGF0YVZlcnRleFNoYWRlciA9IHJlcXVpcmUoJy4vc2hhZGVycy9jaHJvbm9kYXRhVmVydGV4Jyk7XHJcbnZhciBjaHJvbm9kYXRhRnJhZ21lbnRTaGFkZXIgPSByZXF1aXJlKCcuL3NoYWRlcnMvY2hyb25vZGF0YUZyYWdtZW50Jyk7XHJcblxyXG5cclxudmFyIENocm9ub0RhdGEgPSBmdW5jdGlvbihkYXRhVVJMLCByYWRpdXMsIG9wdHMpIHtcclxuICAgIHRoaXMucmFkaXVzID0gcmFkaXVzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRUZXh0KHVybCkge1xyXG4gICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsIHVybCwgZmFsc2UpOyAvLyBTeW5jaHJvbm91cy5cclxuICAgICAgcmVxdWVzdC5vdmVycmlkZU1pbWVUeXBlKCd0ZXh0L3BsYWluJyk7XHJcbiAgICAgIHJlcXVlc3Quc2VuZCgpO1xyXG5cclxuICAgICAgcmV0dXJuIHJlcXVlc3QucmVzcG9uc2VUZXh0O1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZGF0YSA9IFtdO1xyXG4gICAgdmFyIHRpbWVzID0gW107XHJcbiAgICB0aGlzLmdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XHJcbiAgICB0aGlzLm1pblRpbWUgPSBOdW1iZXIuTUFYX1ZBTFVFO1xyXG4gICAgdGhpcy5tYXhUaW1lID0gMDtcclxuXHJcbiAgICAvLyBMb2FkIGRhdGEgZnJvbSBhIGpzb24gZmlsZS5cclxuICAgIHZhciBqc29uRGF0YSA9IEpTT04ucGFyc2UobG9hZFRleHQoZGF0YVVSTCkpO1xyXG4gICAgdmFyIGxvY2F0aW9ucyA9IGpzb25EYXRhLmxvY2F0aW9ucztcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2F0aW9ucy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgIHZhciB0aW1lc3RhbXBNcyA9IHBhcnNlRmxvYXQobG9jYXRpb25zW2ldLnRpbWVzdGFtcE1zKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uc1tpXS5ZZWFyO1xyXG5cclxuICAgICAgICB0aGlzLm1pblRpbWUgPSBNYXRoLm1pbih0aW1lc3RhbXBNcywgdGhpcy5taW5UaW1lKTtcclxuICAgICAgICB0aGlzLm1heFRpbWUgPSBNYXRoLm1heCh0aW1lc3RhbXBNcywgdGhpcy5tYXhUaW1lKTtcclxuXHJcbiAgICAgICAgdmFyIGxhdGl0dWRlID0gbG9jYXRpb25zW2ldLmxhdGl0dWRlRTcgLyAxMDAwMDAwMC4wIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgbG9jYXRpb25zW2ldLkxhdGl0dWRlO1xyXG4gICAgICAgIHZhciBsb25naXR1ZGUgPSBsb2NhdGlvbnNbaV0ubG9uZ2l0dWRlRTcgLyAxMDAwMDAwMC4wIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uc1tpXS5Mb25naXR1ZGU7XHJcblxyXG4gICAgICAgIHZhciBkZWcycmFkID0gTWF0aC5QSSAvIDE4MC4wO1xyXG4gICAgICAgIHZhciBwaGkgPSBsYXRpdHVkZSAqIGRlZzJyYWQ7XHJcbiAgICAgICAgdmFyIHRoZXRhID0gKDE4MCAtIGxvbmdpdHVkZSkgKiBkZWcycmFkO1xyXG5cclxuICAgICAgICB2YXIgeCA9ICh0aGlzLnJhZGl1cyAqIDEuMDEpICogTWF0aC5jb3MocGhpKSAqIE1hdGguY29zKHRoZXRhKTtcclxuICAgICAgICB2YXIgeSA9ICh0aGlzLnJhZGl1cyAqIDEuMDEpICogTWF0aC5zaW4ocGhpKTtcclxuICAgICAgICB2YXIgeiA9ICh0aGlzLnJhZGl1cyAqIDEuMDEpICogTWF0aC5jb3MocGhpKSAqIE1hdGguc2luKHRoZXRhKTtcclxuXHJcbiAgICAgICAgdGhpcy5kYXRhLnB1c2goe1xyXG4gICAgICAgICAgJ2xhdCc6IGxhdGl0dWRlLFxyXG4gICAgICAgICAgJ2xvbmcnOiBsb25naXR1ZGUsXHJcbiAgICAgICAgICAncG9zaXRpb24nOiBbeCwgeSwgel0sXHJcbiAgICAgICAgICAndGltZSc6IHRpbWVzdGFtcE1zXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGltZXMucHVzaCh0aW1lc3RhbXBNcyk7XHJcblxyXG4gICAgICAgIHRoaXMuZ2VvbWV0cnkudmVydGljZXMucHVzaChuZXcgVEhSRUUuVmVjdG9yMyh4LCB5LCB6KSk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGF0dHJpYnV0ZXMgPSB7XHJcbiAgICAgIHBvaW50VGltZTogeyB0eXBlOiAnZicsIHZhbHVlOiB0aW1lcyB9XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciB1bmlmb3JtcyA9IHtcclxuICAgICAgcGFydGljbGVUZXh0dXJlOiB7XHJcbiAgICAgICAgdHlwZTogJ3QnLFxyXG4gICAgICAgIHZhbHVlOiBUSFJFRS5JbWFnZVV0aWxzLmxvYWRUZXh0dXJlKCdpbWFnZXMvY2lyY2xlX2FscGhhLnBuZycpXHJcbiAgICAgIH0sXHJcbiAgICAgIHZpc3VhbGl6YXRpb25UaW1lOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiB0aGlzLm1pblRpbWVcclxuICAgICAgfSxcclxuICAgICAgbWluVGltZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogdGhpcy5taW5UaW1lXHJcbiAgICAgIH0sXHJcbiAgICAgIG1heFRpbWU6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IHRoaXMubWF4VGltZVxyXG4gICAgICB9LFxyXG4gICAgICBwZXJjZW50SGlnaGxpZ2h0UmFuZ2U6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMucGVyY2VudEhpZ2hsaWdodFJhbmdlKSB8fCAwLjEwXHJcbiAgICAgIH0sXHJcbiAgICAgIG1pbkFscGhhOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLm1pbkFscGhhKSB8fCAxLjBcclxuICAgICAgfSxcclxuICAgICAgbWF4QWxwaGE6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWF4QWxwaGEpIHx8IDEuMFxyXG4gICAgICB9LFxyXG4gICAgICBtaW5Db2xvcjoge1xyXG4gICAgICAgIHR5cGU6ICdjJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5taW5Db2xvcikgfHwgbmV3IFRIUkVFLkNvbG9yKDB4MjIyMjIyKVxyXG4gICAgICB9LFxyXG4gICAgICBtYXhDb2xvcjoge1xyXG4gICAgICAgIHR5cGU6ICdjJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5tYXhDb2xvcikgfHwgbmV3IFRIUkVFLkNvbG9yKDB4RUVFRUVFKVxyXG4gICAgICB9LFxyXG4gICAgICBtaW5TaXplOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLm1pblNpemUpIHx8IDEyLjBcclxuICAgICAgfSxcclxuICAgICAgbWF4U2l6ZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5tYXhTaXplKSB8fCAzMi4wXHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCh7XHJcbiAgICAgIGF0dHJpYnV0ZXM6ICAgICBhdHRyaWJ1dGVzLFxyXG4gICAgICB1bmlmb3JtczogICAgICAgdW5pZm9ybXMsXHJcbiAgICAgIHZlcnRleFNoYWRlcjogICBjaHJvbm9kYXRhVmVydGV4U2hhZGVyLFxyXG4gICAgICBmcmFnbWVudFNoYWRlcjogY2hyb25vZGF0YUZyYWdtZW50U2hhZGVyLFxyXG4gICAgICB0cmFuc3BhcmVudDogICAgdHJ1ZSxcclxuICAgICAgYmxlbmRpbmc6ICAgICAgIFRIUkVFLk5vcm1hbEJsZW5kaW5nLFxyXG4gICAgICBkZXB0aFdyaXRlOiAgICAgZmFsc2VcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMucGFydGljbGVzID0gbmV3IFRIUkVFLlBvaW50Q2xvdWQodGhpcy5nZW9tZXRyeSwgdGhpcy5tYXRlcmlhbCk7XHJcbiAgICAvLyBwYXJ0aWNsZXMuc29ydFBhcnRpY2xlcyA9IHRydWU7XHJcblxyXG4gICAgZnVuY3Rpb24gY29tcGFyZShhLCBiKSB7XHJcbiAgICAgICAgaWYgKGEudGltZSA8IGIudGltZSkgeyByZXR1cm4gLTE7IH1cclxuICAgICAgICBpZiAoYS50aW1lID4gYi50aW1lKSB7IHJldHVybiAxOyB9XHJcbiAgICAgICAgcmV0dXJuIDA7XHJcbiAgICB9XHJcbiAgICB0aGlzLmRhdGEuc29ydChjb21wYXJlKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5zZXRTY2VuZSA9IGZ1bmN0aW9uKHNjZW5lKSB7XHJcbiAgICB0aGlzLnNjZW5lID0gc2NlbmU7XHJcbiAgICBzY2VuZS5hZGQodGhpcy5wYXJ0aWNsZXMpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5zZXRUaW1lID0gZnVuY3Rpb24obmV3VGltZSkge1xyXG4gICAgdGhpcy5jdXJyZW50VGltZSA9IG5ld1RpbWU7XHJcbiAgICB0aGlzLm1hdGVyaWFsLnVuaWZvcm1zWyd2aXN1YWxpemF0aW9uVGltZSddLnZhbHVlID0gbmV3VGltZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5nZXRDdXJyZW50VGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRpbWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuZ2V0TWluVGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMubWluVGltZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5nZXRNYXhUaW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5tYXhUaW1lO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLmdldERhdGEgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGE7XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDaHJvbm9EYXRhO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgQ2hyb25vRGF0YSA9IHJlcXVpcmUoJy4vQ2hyb25vRGF0YScpO1xyXG52YXIgQ2hyb25vQ29udHJvbHMgPSByZXF1aXJlKCcuL0Nocm9ub0NvbnRyb2xzJyk7XHJcbnZhciBEZXZpY2VPcmJpdENvbnRyb2xzID0gcmVxdWlyZSgnLi9EZXZpY2VPcmJpdENvbnRyb2xzJyk7XHJcbnZhciBFYXJ0aCA9IHJlcXVpcmUoJy4vRWFydGgnKTtcclxudmFyIEZvbGxvd0xpbmUgPSByZXF1aXJlKCcuL0ZvbGxvd0xpbmUnKTtcclxuXHJcblxyXG52YXIgQ2hyb25vZ3JhcGhlciA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgZGF0YSwgb3B0cykge1xyXG4gICAgaWYgKCFEZXRlY3Rvci53ZWJnbCkgeyBEZXRlY3Rvci5hZGRHZXRXZWJHTE1lc3NhZ2UoKTsgfVxyXG5cclxuICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xyXG4gICAgdGhpcy53aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xyXG4gICAgdGhpcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcbiAgICB0aGlzLnJhZGl1cyA9IDEwMDA7XHJcblxyXG4gICAgdGhpcy5zZXR1cFJlbmRlcmVyKCk7XHJcbiAgICB0aGlzLnNldHVwU2NlbmUoKTtcclxuXHJcbiAgICB0aGlzLmNocm9ub0RhdGEgPSBuZXcgQ2hyb25vRGF0YShkYXRhLCB0aGlzLnJhZGl1cywgb3B0cyk7XHJcbiAgICB0aGlzLmNocm9ub0RhdGEuc2V0U2NlbmUodGhpcy5zY2VuZSk7XHJcbiAgICB2YXIgbWluVGltZSA9IHRoaXMuY2hyb25vRGF0YS5nZXRNaW5UaW1lKCk7XHJcbiAgICB2YXIgbWF4VGltZSA9IHRoaXMuY2hyb25vRGF0YS5nZXRNYXhUaW1lKCk7XHJcblxyXG4gICAgdGhpcy5jaHJvbm9Db250cm9scyA9IG5ldyBDaHJvbm9Db250cm9scyhjb250YWluZXIpO1xyXG4gICAgdGhpcy5jaHJvbm9Db250cm9scy5zZXRUaW1lUmFuZ2UobWluVGltZSwgbWF4VGltZSk7XHJcblxyXG4gICAgdGhpcy5lYXJ0aCA9IG5ldyBFYXJ0aCh0aGlzLnJhZGl1cyk7XHJcbiAgICB0aGlzLmVhcnRoLnNldFNjZW5lKHRoaXMuc2NlbmUpO1xyXG5cclxuICAgIGlmIChvcHRzLmZvbGxvd0xpbmUpIHtcclxuICAgICAgICB0aGlzLmZvbGxvd0xpbmUgPSBuZXcgRm9sbG93TGluZSh0aGlzLmNocm9ub0RhdGEsIHRoaXMucmFkaXVzKTtcclxuICAgICAgICB0aGlzLmZvbGxvd0xpbmUuc2V0U2NlbmUodGhpcy5zY2VuZSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUuc2V0dXBSZW5kZXJlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5yZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKHthbHBoYTogdHJ1ZSwgYW50aWFsaWFzOiB0cnVlfSk7XHJcbiAgICB0aGlzLnJlbmRlcmVyLnNldFNpemUod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XHJcbiAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQpO1xyXG4gICAgdGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmlkID0gJ2Nnci1jaHJvbm9EYXRhJztcclxuXHJcbiAgICB0aGlzLmVmZmVjdCA9IG5ldyBUSFJFRS5TdGVyZW9FZmZlY3QodGhpcy5yZW5kZXJlcik7XHJcbiAgICB0aGlzLmVmZmVjdC5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5vbldpbmRvd1Jlc2l6ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy53aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xyXG4gICAgdGhpcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcblxyXG4gICAgdGhpcy5jYW1lcmEuYXNwZWN0ID0gdGhpcy53aWR0aCAvIHRoaXMuaGVpZ2h0O1xyXG4gICAgdGhpcy5jYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xyXG5cclxuICAgIHRoaXMucmVuZGVyZXIuc2V0U2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XHJcbiAgICB0aGlzLmVmZmVjdC5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5zZXRPcmllbnRhdGlvbkNvbnRyb2xzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmNvbnRyb2xzID0gbmV3IERldmljZU9yYml0Q29udHJvbHModGhpcy5jYW1lcmEsIHRoaXMucmFkaXVzICogMi4wKTtcclxuXHJcbiAgICB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5mdWxsc2NyZWVuLmJpbmQodGhpcyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSk7XHJcblxyXG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RldmljZW9yaWVudGF0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0T3JpZW50YXRpb25Db250cm9scyk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUuZnVsbHNjcmVlbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYgKHRoaXMuY29udGFpbmVyLnJlcXVlc3RGdWxsc2NyZWVuKSB7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIucmVxdWVzdEZ1bGxzY3JlZW4oKTtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5jb250YWluZXIubXNSZXF1ZXN0RnVsbHNjcmVlbikge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLm1zUmVxdWVzdEZ1bGxzY3JlZW4oKTtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5jb250YWluZXIubW96UmVxdWVzdEZ1bGxTY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lci5tb3pSZXF1ZXN0RnVsbFNjcmVlbigpO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnRhaW5lci53ZWJraXRSZXF1ZXN0RnVsbHNjcmVlbikge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLndlYmtpdFJlcXVlc3RGdWxsc2NyZWVuKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHRhcmdldE9yaWVudGF0aW9uID0gWydsYW5kc2NhcGUtcHJpbWFyeScsICdsYW5kc2NhcGUtc2Vjb25kYXJ5J107XHJcbiAgICBpZiAoc2NyZWVuLmxvY2tPcmllbnRhdGlvbikge1xyXG4gICAgICAgIHNjcmVlbi5sb2NrT3JpZW50YXRpb24odGFyZ2V0T3JpZW50YXRpb24pO1xyXG4gICAgfSBlbHNlIGlmIChzY3JlZW4ubW96TG9ja09yaWVudGF0aW9uKSB7XHJcbiAgICAgICAgc2NyZWVuLm1vekxvY2tPcmllbnRhdGlvbih0YXJnZXRPcmllbnRhdGlvbik7XHJcbiAgICB9IGVsc2UgaWYgKHNjcmVlbi5tc0xvY2tPcmllbnRhdGlvbikge1xyXG4gICAgICAgIHNjcmVlbi5tc0xvY2tPcmllbnRhdGlvbih0YXJnZXRPcmllbnRhdGlvbik7XHJcbiAgICB9IGVsc2UgaWYgKHNjcmVlbi5vcmllbnRhdGlvbi5sb2NrKSB7XHJcbiAgICAgICAgc2NyZWVuLm9yaWVudGF0aW9uLmxvY2sodGFyZ2V0T3JpZW50YXRpb24pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnNldHVwU2NlbmUgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcclxuXHJcbiAgICB0aGlzLmNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYSg3NSxcclxuICAgICAgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDEsIDMwMDAwKTtcclxuICAgIHRoaXMuY2FtZXJhLnBvc2l0aW9uLnogPSAtKHRoaXMucmFkaXVzICogMS41KTtcclxuICAgIHRoaXMuY2FtZXJhLnBvc2l0aW9uLnkgPSB0aGlzLnJhZGl1cyAqIDEuMjtcclxuICAgIHRoaXMuY2FtZXJhLmxvb2tBdCh0aGlzLnNjZW5lLnBvc2l0aW9uKTtcclxuXHJcbiAgICB0aGlzLmNvbnRyb2xzID0gbmV3IFRIUkVFLk9yYml0Q29udHJvbHModGhpcy5jYW1lcmEsXHJcbiAgICAgIHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCk7XHJcbiAgICB0aGlzLmNvbnRyb2xzLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xyXG4gICAgdGhpcy5jb250cm9scy5ub1BhbiA9IHRydWU7XHJcbiAgICB0aGlzLmNvbnRyb2xzLnJvdGF0ZVNwZWVkID0gMC41O1xyXG5cclxuICAgIHZhciBhbWJpZW50TGlnaHQgPSBuZXcgVEhSRUUuQW1iaWVudExpZ2h0KDB4ODg4ODg4KTtcclxuICAgIHRoaXMuc2NlbmUuYWRkKGFtYmllbnRMaWdodCk7XHJcblxyXG4gICAgdmFyIGRpckxpZ2h0ID0gbmV3IFRIUkVFLkRpcmVjdGlvbmFsTGlnaHQoMHhjY2NjY2MsIDAuMik7XHJcbiAgICBkaXJMaWdodC5wb3NpdGlvbi5zZXQoNSwgMywgNSk7XHJcbiAgICB0aGlzLnNjZW5lLmFkZChkaXJMaWdodCk7XHJcblxyXG4gICAgdGhpcy5jbG9jayA9IG5ldyBUSFJFRS5DbG9jaygpO1xyXG5cclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCB0aGlzLm9uV2luZG93UmVzaXplLmJpbmQodGhpcyksIGZhbHNlKTtcclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VvcmllbnRhdGlvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNldE9yaWVudGF0aW9uQ29udHJvbHMuYmluZCh0aGlzKSwgZmFsc2UpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGR0ID0gdGhpcy5jbG9jay5nZXREZWx0YSgpO1xyXG5cclxuICAgIHRoaXMuY2hyb25vQ29udHJvbHMudXBkYXRlKGR0KTtcclxuICAgIHRoaXMuY2hyb25vRGF0YS5zZXRUaW1lKHRoaXMuY2hyb25vQ29udHJvbHMuZ2V0VGltZSgpKTtcclxuXHJcbiAgICB0aGlzLmNocm9ub0RhdGEudXBkYXRlKGR0KTtcclxuICAgIGlmICh0aGlzLmZvbGxvd0xpbmUpIHtcclxuICAgICAgICB0aGlzLmZvbGxvd0xpbmUudXBkYXRlKGR0KTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNvbnRyb2xzLnVwZGF0ZShkdCk7XHJcbiAgICB0aGlzLnJlbmRlcigpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5yZW5kZXJlci5jbGVhcigpO1xyXG4gICAgLy8gdGhpcy5yZW5kZXJlci5yZW5kZXIodGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEpO1xyXG4gICAgdGhpcy5lZmZlY3QucmVuZGVyKHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhKTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENocm9ub2dyYXBoZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBEZXZpY2VPcmJpdENvbnRyb2xzID0gZnVuY3Rpb24oY2FtZXJhLCByYWRpdXMpIHtcclxuICAgIHRoaXMuY2FtZXJhID0gY2FtZXJhO1xyXG4gICAgdGhpcy5yYWRpdXMgPSByYWRpdXM7XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZW9yaWVudGF0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNldE9yaWVudGF0aW9uLmJpbmQodGhpcyksIGZhbHNlKTtcclxufTtcclxuXHJcblxyXG5EZXZpY2VPcmJpdENvbnRyb2xzLnByb3RvdHlwZS5zZXRPcmllbnRhdGlvbiA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICB2YXIgZGVnMnJhZCA9IE1hdGguUEkgLyAxODAuMDtcclxuICAgIHZhciBhbHBoYSA9IC0oKGV2ZW50LmFscGhhKSAqIGRlZzJyYWQpO1xyXG4gICAgdmFyIGdhbW1hID0gICgoZXZlbnQuZ2FtbWEgKyA5MCkgKiBkZWcycmFkKTtcclxuXHJcbiAgICB2YXIgeCA9IHRoaXMucmFkaXVzICogTWF0aC5jb3MoZ2FtbWEpICogTWF0aC5jb3MoYWxwaGEpO1xyXG4gICAgdmFyIHkgPSB0aGlzLnJhZGl1cyAqIE1hdGguc2luKGdhbW1hKTtcclxuICAgIHZhciB6ID0gdGhpcy5yYWRpdXMgKiBNYXRoLmNvcyhnYW1tYSkgKiBNYXRoLnNpbihhbHBoYSk7XHJcblxyXG4gICAgdGhpcy5jYW1lcmEucG9zaXRpb24uc2V0KHgsIHksIHopO1xyXG4gICAgdGhpcy5jYW1lcmEubG9va0F0KG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wLCAwLjApKTtcclxufTtcclxuXHJcblxyXG5EZXZpY2VPcmJpdENvbnRyb2xzLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcclxuXHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBEZXZpY2VPcmJpdENvbnRyb2xzO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRWFydGggPSBmdW5jdGlvbihyYWRpdXMpIHtcclxuICAgIHZhciBlYXJ0aEdlb21ldHJ5ID0gbmV3IFRIUkVFLlNwaGVyZUdlb21ldHJ5KHJhZGl1cywgODAsIDYwKTtcclxuICAgIHZhciBlYXJ0aE1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hQaG9uZ01hdGVyaWFsKHtcclxuICAgICAgbWFwOiB0aGlzLmxvYWRUZXh0dXJlKCdlYXJ0aF9kaWZmdXNlXzRrLmpwZycpXHJcbiAgICAgIC8vIG1hcDogdGhpcy5sb2FkVGV4dHVyZSgnZWFydGhfZGlmZnVzZV9uaWdodF80ay5qcGcnKVxyXG4gICAgfSk7XHJcblxyXG4gICAgZWFydGhNYXRlcmlhbC5idW1wTWFwID0gdGhpcy5sb2FkVGV4dHVyZSgnZWFydGhfYnVtcF8yay5qcGcnKTtcclxuICAgIGVhcnRoTWF0ZXJpYWwuYnVtcFNjYWxlID0gcmFkaXVzIC8gMi4wO1xyXG4gICAgZWFydGhNYXRlcmlhbC5zcGVjdWxhck1hcCA9IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX3NwZWN1bGFyXzJrLmpwZycpO1xyXG4gICAgZWFydGhNYXRlcmlhbC5zcGVjdWxhciA9IG5ldyBUSFJFRS5Db2xvcigweDNBM0EzQSk7XHJcblxyXG4gICAgdGhpcy5lYXJ0aE1lc2ggPSBuZXcgVEhSRUUuTWVzaChlYXJ0aEdlb21ldHJ5LCBlYXJ0aE1hdGVyaWFsKTtcclxuICAgIHRoaXMuZWFydGhNZXNoLnJvdGF0aW9uLnkgPSBNYXRoLlBJO1xyXG5cclxuICAgIHZhciBib3VuZGFyaWVzTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe1xyXG4gICAgICBtYXA6IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX2JvdW5kYXJpZXNfMmsucG5nJyksXHJcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxyXG4gICAgICBvcGFjaXR5OiAwLjVcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYm91bmRhcmllc01lc2ggPSBuZXcgVEhSRUUuTWVzaChlYXJ0aEdlb21ldHJ5LCBib3VuZGFyaWVzTWF0ZXJpYWwpO1xyXG4gICAgdGhpcy5ib3VuZGFyaWVzTWVzaC5yb3RhdGlvbi55ID0gTWF0aC5QSTtcclxufTtcclxuXHJcblxyXG5FYXJ0aC5wcm90b3R5cGUuc2V0U2NlbmUgPSBmdW5jdGlvbihzY2VuZSkge1xyXG4gICAgdGhpcy5zY2VuZSA9IHNjZW5lO1xyXG4gICAgc2NlbmUuYWRkKHRoaXMuZWFydGhNZXNoKTtcclxuICAgIHNjZW5lLmFkZCh0aGlzLmJvdW5kYXJpZXNNZXNoKTtcclxufTtcclxuXHJcblxyXG5FYXJ0aC5wcm90b3R5cGUubG9hZFRleHR1cmUgPSBmdW5jdGlvbih0ZXh0dXJlTmFtZSkge1xyXG4gIC8vIFRPRE86IGN1c3RvbWl6ZSBwYXRoIG9yIGltYWdlcywgdGhpcyByZWxhdGl2ZSBwYXRoIGlzIG5hc3R5LlxyXG4gICAgcmV0dXJuIFRIUkVFLkltYWdlVXRpbHMubG9hZFRleHR1cmUoJy4uLy4uL2Rpc3QvaW1hZ2VzLycgKyB0ZXh0dXJlTmFtZSk7XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFYXJ0aDtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEZvbGxvd0xpbmUgPSBmdW5jdGlvbihjaHJvbm9EYXRhLCByYWRpdXMpIHtcclxuICAgIHRoaXMuY2hyb25vRGF0YSA9IGNocm9ub0RhdGE7XHJcbiAgICB0aGlzLnJhZGl1cyA9IHJhZGl1cztcclxuICAgIHRoaXMubWF4UG9pbnRzID0gMTAwMDtcclxuXHJcbiAgICB0aGlzLmN1cnZlID0gbmV3IFRIUkVFLlNwbGluZUN1cnZlMyhbXHJcbiAgICAgIG5ldyBUSFJFRS5WZWN0b3IzKDAsMCwwKSxcclxuICAgICAgbmV3IFRIUkVFLlZlY3RvcjMoMCwwLDApXHJcbiAgICBdKTtcclxuXHJcbiAgICB0aGlzLmN1cnZlUG9pbnRzID0gW107XHJcblxyXG4gICAgdGhpcy5jdXJ2ZUdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XHJcbiAgICB0aGlzLmN1cnZlR2VvbWV0cnkudmVydGljZXMgPSB0aGlzLmN1cnZlLmdldFBvaW50cygyMDApO1xyXG5cclxuICAgIHRoaXMuY3VydmVNYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCggeyBjb2xvcjogMHhjY2NjY2MgfSApO1xyXG5cclxuICAgIHRoaXMubGluZSA9IG5ldyBUSFJFRS5MaW5lKHRoaXMuY3VydmVHZW9tZXRyeSwgdGhpcy5jdXJ2ZU1hdGVyaWFsKTtcclxuXHJcbiAgICB0aGlzLmRhdGEgPSBjaHJvbm9EYXRhLmdldERhdGEoKTtcclxuICAgIHRoaXMubGFzdFRpbWUgPSBjaHJvbm9EYXRhLmdldE1pblRpbWUoKTtcclxuICAgIHRoaXMuY3VycmVudERhdGFJbmRleCA9IDA7XHJcbn07XHJcblxyXG5cclxuRm9sbG93TGluZS5wcm90b3R5cGUuc2V0U2NlbmUgPSBmdW5jdGlvbihzY2VuZSkge1xyXG4gICAgdGhpcy5zY2VuZSA9IHNjZW5lO1xyXG4gICAgc2NlbmUuYWRkKHRoaXMubGluZSk7XHJcbn07XHJcblxyXG5cclxuRm9sbG93TGluZS5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgY3VycmVudFRpbWUgPSB0aGlzLmNocm9ub0RhdGEuZ2V0Q3VycmVudFRpbWUoKTtcclxuXHJcbiAgICBpZiAoY3VycmVudFRpbWUgPCB0aGlzLmxhc3RUaW1lKSB7XHJcbiAgICAgICAgdGhpcy5yZXNldChjdXJyZW50VGltZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd2hpbGUgKGN1cnJlbnRUaW1lID4gdGhpcy5kYXRhW3RoaXMuY3VycmVudERhdGFJbmRleF0udGltZSkge1xyXG4gICAgICAgIHRoaXMuY3VycmVudERhdGFJbmRleCsrO1xyXG4gICAgICAgIHRoaXMuYWRkUG9pbnQoKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmxhc3RUaW1lID0gY3VycmVudFRpbWU7XHJcbn07XHJcblxyXG5cclxuRm9sbG93TGluZS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbihjdXJyZW50VGltZSkge1xyXG4gICAgdGhpcy5jdXJ2ZVBvaW50cyA9IFtdO1xyXG4gICAgdGhpcy5jdXJyZW50RGF0YUluZGV4ID0gMDtcclxuXHJcbiAgICB3aGlsZSAoY3VycmVudFRpbWUgPiB0aGlzLmRhdGFbdGhpcy5jdXJyZW50RGF0YUluZGV4XS50aW1lKSB7XHJcbiAgICAgICAgdGhpcy5jdXJyZW50RGF0YUluZGV4Kys7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuRm9sbG93TGluZS5wcm90b3R5cGUuYWRkUG9pbnQgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBuZXh0UG9zaXRpb24gPSB0aGlzLmRhdGFbdGhpcy5jdXJyZW50RGF0YUluZGV4XS5wb3NpdGlvbjtcclxuICAgIHRoaXMuY3VydmVQb2ludHMucHVzaChuZXcgVEhSRUUuVmVjdG9yMyhuZXh0UG9zaXRpb25bMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dFBvc2l0aW9uWzFdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRQb3NpdGlvblsyXSkpO1xyXG4gICAgaWYgKHRoaXMuY3VydmVQb2ludHMubGVuZ3RoID4gdGhpcy5tYXhQb2ludHMpIHtcclxuICAgICAgICB0aGlzLmN1cnZlUG9pbnRzLnNoaWZ0KCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5jdXJ2ZSA9IG5ldyBUSFJFRS5TcGxpbmVDdXJ2ZTModGhpcy5jdXJ2ZVBvaW50cyk7XHJcblxyXG4gICAgdGhpcy5jdXJ2ZUdlb21ldHJ5LnZlcnRpY2VzID0gdGhpcy5jdXJ2ZS5nZXRQb2ludHModGhpcy5tYXhQb2ludHMgKiAzKTtcclxuICAgIHRoaXMubGluZS5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRm9sbG93TGluZTtcclxuIiwiLy8gRW50cnkgcG9pbnQgZm9yIGJ1aWxkaW5nLlxyXG5cclxudmFyIENocm9ub2dyYXBoZXIgPSByZXF1aXJlKCcuL0Nocm9ub2dyYXBoZXInKTtcclxuXHJcbndpbmRvdy5DaHJvbm9ncmFwaGVyID0gQ2hyb25vZ3JhcGhlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGNocm9ub2RhdGFGcmFnbWVudCA9ICcnICtcclxuICAgICd1bmlmb3JtIHNhbXBsZXIyRCBwYXJ0aWNsZVRleHR1cmU7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd2YXJ5aW5nIGZsb2F0IHQ7IFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgdmVjMyB0aW1lQ29sb3I7IFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgZmxvYXQgdGltZUFscGhhOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndm9pZCBtYWluKCkgeyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdGV4dHVyZUFscGhhID0gdGV4dHVyZTJEKHBhcnRpY2xlVGV4dHVyZSwgZ2xfUG9pbnRDb29yZCkuYTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGFscGhhID0gdGV4dHVyZUFscGhhICogdGltZUFscGhhOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIHZlYzMgY29sb3IgPSB0aW1lQ29sb3I7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChjb2xvciwgYWxwaGEpOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGNocm9ub2RhdGFGcmFnbWVudDtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGNocm9ub2RhdGFWZXJ0ZXggPSAnJyArXHJcbiAgICAnYXR0cmlidXRlIGZsb2F0IHBvaW50VGltZTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWluVGltZTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBtYXhUaW1lOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IHZpc3VhbGl6YXRpb25UaW1lOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IHBlcmNlbnRIaWdobGlnaHRSYW5nZTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWluQWxwaGE7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWF4QWxwaGE7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gdmVjMyBtaW5Db2xvcjsgXFxuJyArXHJcbiAgICAndW5pZm9ybSB2ZWMzIG1heENvbG9yOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1pblNpemU7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWF4U2l6ZTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgZmxvYXQgdDsgXFxuJyArXHJcbiAgICAndmFyeWluZyBmbG9hdCB0aW1lQWxwaGE7IFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgdmVjMyB0aW1lQ29sb3I7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICdmbG9hdCBsZXJwKGZsb2F0IG1pblZhbHVlLCBmbG9hdCBtYXhWYWx1ZSwgZmxvYXQgdCkgeyBcXG4nICtcclxuICAgICcgICAgcmV0dXJuIChtaW5WYWx1ZSAqICgxLjAgLSB0KSkgKyAobWF4VmFsdWUgKiB0KTsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnZmxvYXQgaW52ZXJzZUxlcnAoZmxvYXQgdmFsdWUsIGZsb2F0IG1pblZhbHVlLCBmbG9hdCBtYXhWYWx1ZSkgeyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdmFsdWVSYW5nZSA9IG1heFZhbHVlIC0gbWluVmFsdWU7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBpbnZlcnNlTGVycGVkID0gKHZhbHVlIC0gbWluVmFsdWUpIC8gdmFsdWVSYW5nZTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGNsYW1wZWQgPSBjbGFtcChpbnZlcnNlTGVycGVkLCAwLjAsIDEuMCk7IFxcbicgK1xyXG4gICAgJyAgICByZXR1cm4gaW52ZXJzZUxlcnBlZDsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnLy8gUkdCIHRvIEhTViBhbmQgSFNWIHRvIFJHQiBcXG4nICtcclxuICAgICcvLyBzb3VyY2U6IGh0dHA6Ly9sb2xlbmdpbmUubmV0L2Jsb2cvMjAxMy8wNy8yNy9yZ2ItdG8taHN2LWluLWdsc2wgXFxuJyArXHJcbiAgICAndmVjMyByZ2IyaHN2KHZlYzMgYykgeyBcXG4nICtcclxuICAgICcgICAgdmVjNCBLID0gdmVjNCgwLjAsIC0xLjAgLyAzLjAsIDIuMCAvIDMuMCwgLTEuMCk7IFxcbicgK1xyXG4gICAgJyAgICB2ZWM0IHAgPSBjLmcgPCBjLmIgPyB2ZWM0KGMuYmcsIEsud3opIDogdmVjNChjLmdiLCBLLnh5KTsgXFxuJyArXHJcbiAgICAnICAgIHZlYzQgcSA9IGMuciA8IHAueCA/IHZlYzQocC54eXcsIGMucikgOiB2ZWM0KGMuciwgcC55engpOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGQgPSBxLnggLSBtaW4ocS53LCBxLnkpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgZSA9IDEuMGUtMTA7IFxcbicgK1xyXG4gICAgJyAgICByZXR1cm4gdmVjMyhhYnMocS56ICsgKHEudyAtIHEueSkgLyAoNi4wICogZCArIGUpKSwgZCAvIChxLnggKyBlKSwgcS54KTsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndmVjMyBoc3YycmdiKHZlYzMgYykgeyBcXG4nICtcclxuICAgICcgICAgdmVjNCBLID0gdmVjNCgxLjAsIDIuMCAvIDMuMCwgMS4wIC8gMy4wLCAzLjApOyBcXG4nICtcclxuICAgICcgICAgdmVjMyBwID0gYWJzKGZyYWN0KGMueHh4ICsgSy54eXopICogNi4wIC0gSy53d3cpOyBcXG4nICtcclxuICAgICcgICAgcmV0dXJuIGMueiAqIG1peChLLnh4eCwgY2xhbXAocCAtIEsueHh4LCAwLjAsIDEuMCksIGMueSk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd2b2lkIG1haW4oKSB7IFxcbicgK1xyXG4gICAgJyAgICB2ZWM0IG12UG9zaXRpb24gPSB2aWV3TWF0cml4ICogdmVjNChwb3NpdGlvbiwgMS4wKTsgXFxuJyArXHJcbiAgICAnICAgIGdsX1Bvc2l0aW9uID0gcHJvamVjdGlvbk1hdHJpeCAqIG12UG9zaXRpb247IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdmVydGV4UGVyY2VudCA9IGludmVyc2VMZXJwKHBvaW50VGltZSwgbWluVGltZSwgbWF4VGltZSk7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCB2aXNQZXJjZW50ID0gaW52ZXJzZUxlcnAodmlzdWFsaXphdGlvblRpbWUsIG1pblRpbWUsIG1heFRpbWUpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgcGVyY2VudERpZmZlcmVuY2UgPSBhYnModmVydGV4UGVyY2VudCAtIHZpc1BlcmNlbnQpOyBcXG4nICtcclxuICAgICcgICAgLy8gU2NhbGUgZGlmZmVyZW5jZSBiYXNlZCBvbiBoaWdobGlnaHQgcmFuZ2UgaW50byBhbiBpbnRlcnBvbGF0aW9uIHRpbWUuIFxcbicgK1xyXG4gICAgJyAgICB0ID0gY2xhbXAoMS4wIC0gcGVyY2VudERpZmZlcmVuY2UgLyBwZXJjZW50SGlnaGxpZ2h0UmFuZ2UsIDAuMCwgMS4wKTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICBnbF9Qb2ludFNpemUgPSBsZXJwKG1pblNpemUsIG1heFNpemUsIHQpOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIHRpbWVBbHBoYSA9IGxlcnAobWluQWxwaGEsIG1heEFscGhhLCB0KTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICB2ZWMzIG1pbkhTViA9IHJnYjJoc3YobWluQ29sb3IpOyBcXG4nICtcclxuICAgICcgICAgdmVjMyBtYXhIU1YgPSByZ2IyaHN2KG1heENvbG9yKTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGggPSBsZXJwKG1pbkhTVi54LCBtYXhIU1YueCwgdCk7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBzID0gbGVycChtaW5IU1YueSwgbWF4SFNWLnksIHQpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdiA9IGxlcnAobWluSFNWLnosIG1heEhTVi56LCB0KTsgXFxuJyArXHJcbiAgICAnICAgIHRpbWVDb2xvciA9IGhzdjJyZ2IodmVjMyhoLCBzLCB2KSk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnJztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gY2hyb25vZGF0YVZlcnRleDtcclxuIl19
