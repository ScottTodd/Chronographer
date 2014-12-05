(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var ChronoControls = function(chronographer, container, opts) {
    this.chronographer = chronographer;
    this.totalPlayTime = (opts && opts.playTime) || 10.0;
    this.paused = true;
    this.loop = true;
    this.dateFormat = (opts && opts.dateFormat) || 'string';

    // Create controls from imported html.
    var content = document.querySelector('link[rel="import"]').import;
    var controls = content.getElementById('chrono-controls-root');
    container.appendChild(controls);

    this.controls   = document.getElementById('chrono-controls');
    this.vrControls = document.getElementById('chrono-vr-controls');

    this.playPause  = document.getElementById('chrono-playPauseButton');
    this.enterVR    = document.getElementById('chrono-enterVRButton');
    this.timeInput  = document.getElementById('chrono-timeInput');
    this.dateBox    = document.getElementById('chrono-dateBox');
    this.vrDateBox1 = document.getElementById('chrono-vr-dateBox-1');
    this.vrDateBox2 = document.getElementById('chrono-vr-dateBox-2');

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

    this.enterVR.addEventListener('click', this.handleEnterVR.bind(this),
                                  false);

    document.addEventListener('fullscreenchange',
                              this.fullscreenChangeHandler.bind(this), false);
    document.addEventListener('webkitfullscreenchange',
                              this.fullscreenChangeHandler.bind(this), false);
    document.addEventListener('mozfullscreenchange',
                              this.fullscreenChangeHandler.bind(this), false);
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
    var dateValue = '';
    if (this.dateFormat === 'timestamp') {
        var date = new Date(parseFloat(this.timeInput.value));
        dateValue = this.getFormattedDate(date);
    } else {
        dateValue = Math.round(parseFloat(this.timeInput.value));
    }

    this.dateBox.textContent = dateValue;
    this.vrDateBox1.textContent = dateValue;
    this.vrDateBox2.textContent = dateValue;
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
    this.playPause.value = this.paused ? 'Play' : 'Pause';
};


ChronoControls.prototype.handleEnterVR = function() {
    this.chronographer.enterVR();

    this.paused = false;
    this.loop = true;

    this.controls.style.display = 'none';
    this.vrControls.style.display = 'inline-block';
};


ChronoControls.prototype.handleLeaveVR = function() {
    this.chronographer.leaveVR();

    this.paused = true;
    this.loop = false;

    this.controls.style.display = 'inline-block';
    this.vrControls.style.display = 'none';
};


ChronoControls.prototype.fullscreenChangeHandler = function() {
    var fullscreen = (document.webkitIsFullScreen ||
                      document.mozFullScreen ||
                      document.msFullscreenElement);

    if (!fullscreen) {
        this.handleLeaveVR();
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

    this.vr = false;

    this.setupRenderer();
    this.setupScene();

    this.chronoData = new ChronoData(data, this.radius, opts);
    this.chronoData.setScene(this.scene);
    var minTime = this.chronoData.getMinTime();
    var maxTime = this.chronoData.getMaxTime();

    this.chronoControls = new ChronoControls(this, container, opts);
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
    this.controls = this.deviceOrbitControls;
    this.orbitControls.enabled = false;
    this.deviceOrbitControls.enabled = true;
};


Chronographer.prototype.setOrbitControls = function() {
    this.controls = this.orbitControls;
    this.orbitControls.enabled = true;
    this.deviceOrbitControls.enabled = false;
};


Chronographer.prototype.enterVR = function() {
    this.vr = true;
    this.fullscreen();
    this.setOrientationControls();
};


Chronographer.prototype.leaveVR = function() {
    this.vr = false;
    this.setOrbitControls();
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

    this.deviceOrbitControls = new DeviceOrbitControls(this.camera,
                                                       this.radius * 2.0);

    this.orbitControls = new THREE.OrbitControls(this.camera,
                                                 this.renderer.domElement);
    this.orbitControls.addEventListener('change', this.render.bind(this));
    this.orbitControls.noPan = true;
    this.orbitControls.rotateSpeed = 0.5;

    this.setOrbitControls();

    var ambientLight = new THREE.AmbientLight(0x888888);
    this.scene.add(ambientLight);

    var dirLight = new THREE.DirectionalLight(0xcccccc, 0.2);
    dirLight.position.set(5, 3, 5);
    this.scene.add(dirLight);

    this.clock = new THREE.Clock();

    window.addEventListener('resize', this.onWindowResize.bind(this), false);
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

    if (this.vr) {
        this.effect.render(this.scene, this.camera);
    } else {
        this.renderer.render(this.scene, this.camera);
    }
};


module.exports = Chronographer;

},{"./ChronoControls":1,"./ChronoData":2,"./DeviceOrbitControls":4,"./Earth":5,"./FollowLine":6}],4:[function(require,module,exports){
'use strict';

var DeviceOrbitControls = function(camera, radius) {
    this.enabled = true;
    this.camera = camera;
    this.radius = radius;

    window.addEventListener('deviceorientation',
                             this.setOrientation.bind(this), false);
};


DeviceOrbitControls.prototype.setOrientation = function(event) {
    if (!this.enabled) { return; }

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

    earthMaterial.bumpMap = this.loadTexture('earth_bump_4k.jpg');
    earthMaterial.bumpScale = radius / 2.0;
    earthMaterial.specularMap = this.loadTexture('earth_specular_4k.jpg');
    earthMaterial.specular = new THREE.Color(0x3A3A3A);

    this.earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    this.earthMesh.rotation.y = Math.PI;

    var boundariesMaterial = new THREE.MeshBasicMaterial({
      map: this.loadTexture('earth_boundaries_4k.png'),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwic3JjXFxqc1xcQ2hyb25vQ29udHJvbHMuanMiLCJzcmNcXGpzXFxDaHJvbm9EYXRhLmpzIiwic3JjXFxqc1xcQ2hyb25vZ3JhcGhlci5qcyIsInNyY1xcanNcXERldmljZU9yYml0Q29udHJvbHMuanMiLCJzcmNcXGpzXFxFYXJ0aC5qcyIsInNyY1xcanNcXEZvbGxvd0xpbmUuanMiLCJzcmNcXGpzXFxtYWluLmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YUZyYWdtZW50LmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YVZlcnRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIENocm9ub0NvbnRyb2xzID0gZnVuY3Rpb24oY2hyb25vZ3JhcGhlciwgY29udGFpbmVyLCBvcHRzKSB7XHJcbiAgICB0aGlzLmNocm9ub2dyYXBoZXIgPSBjaHJvbm9ncmFwaGVyO1xyXG4gICAgdGhpcy50b3RhbFBsYXlUaW1lID0gKG9wdHMgJiYgb3B0cy5wbGF5VGltZSkgfHwgMTAuMDtcclxuICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcclxuICAgIHRoaXMubG9vcCA9IHRydWU7XHJcbiAgICB0aGlzLmRhdGVGb3JtYXQgPSAob3B0cyAmJiBvcHRzLmRhdGVGb3JtYXQpIHx8ICdzdHJpbmcnO1xyXG5cclxuICAgIC8vIENyZWF0ZSBjb250cm9scyBmcm9tIGltcG9ydGVkIGh0bWwuXHJcbiAgICB2YXIgY29udGVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2xpbmtbcmVsPVwiaW1wb3J0XCJdJykuaW1wb3J0O1xyXG4gICAgdmFyIGNvbnRyb2xzID0gY29udGVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWNvbnRyb2xzLXJvb3QnKTtcclxuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChjb250cm9scyk7XHJcblxyXG4gICAgdGhpcy5jb250cm9scyAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby1jb250cm9scycpO1xyXG4gICAgdGhpcy52ckNvbnRyb2xzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby12ci1jb250cm9scycpO1xyXG5cclxuICAgIHRoaXMucGxheVBhdXNlICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tcGxheVBhdXNlQnV0dG9uJyk7XHJcbiAgICB0aGlzLmVudGVyVlIgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWVudGVyVlJCdXR0b24nKTtcclxuICAgIHRoaXMudGltZUlucHV0ICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tdGltZUlucHV0Jyk7XHJcbiAgICB0aGlzLmRhdGVCb3ggICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWRhdGVCb3gnKTtcclxuICAgIHRoaXMudnJEYXRlQm94MSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tdnItZGF0ZUJveC0xJyk7XHJcbiAgICB0aGlzLnZyRGF0ZUJveDIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLXZyLWRhdGVCb3gtMicpO1xyXG5cclxuICAgIC8vIExpc3RlbiB0byBwbGF5L3BhdXNlIGV2ZW50cyAoYnV0dG9uIGNsaWNrIGFuZCBzcGFjZSBiYXIpLlxyXG4gICAgdGhpcy5wbGF5UGF1c2UuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmhhbmRsZVBsYXlQYXVzZS5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSk7XHJcbiAgICBkb2N1bWVudC5vbmtleXByZXNzID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gMzIpIHtcclxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgdGhpcy5oYW5kbGVQbGF5UGF1c2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQodGhpcyk7XHJcblxyXG4gICAgLy8gQWxzbyB1cGRhdGUgaWYgdGhlIGlucHV0IHNsaWRlciBpcyBjaGFuZ2VkIGRpcmVjdGx5LlxyXG4gICAgdGhpcy50aW1lSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy51cGRhdGVUaW1lRGlzcGxheS5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSk7XHJcblxyXG4gICAgdGhpcy5lbnRlclZSLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5oYW5kbGVFbnRlclZSLmJpbmQodGhpcyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSk7XHJcblxyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmNoYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZnVsbHNjcmVlbkNoYW5nZUhhbmRsZXIuYmluZCh0aGlzKSwgZmFsc2UpO1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignd2Via2l0ZnVsbHNjcmVlbmNoYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZnVsbHNjcmVlbkNoYW5nZUhhbmRsZXIuYmluZCh0aGlzKSwgZmFsc2UpO1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW96ZnVsbHNjcmVlbmNoYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZnVsbHNjcmVlbkNoYW5nZUhhbmRsZXIuYmluZCh0aGlzKSwgZmFsc2UpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5nZXRUaW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gcGFyc2VGbG9hdCh0aGlzLnRpbWVJbnB1dC52YWx1ZSk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLnNldFRpbWVSYW5nZSA9IGZ1bmN0aW9uKG1pblRpbWUsIG1heFRpbWUpIHtcclxuICAgIHRoaXMubWluVGltZSA9IG1pblRpbWU7XHJcbiAgICB0aGlzLm1heFRpbWUgPSBtYXhUaW1lO1xyXG4gICAgdGhpcy50aW1lUmFuZ2UgPSBtYXhUaW1lIC0gbWluVGltZTtcclxuXHJcbiAgICB0aGlzLnRpbWVJbnB1dC5zZXRBdHRyaWJ1dGUoJ21pbicsIG1pblRpbWUpO1xyXG4gICAgdGhpcy50aW1lSW5wdXQuc2V0QXR0cmlidXRlKCdtYXgnLCBtYXhUaW1lKTtcclxuICAgIHRoaXMuc2V0SW5wdXRUaW1lKG1pblRpbWUpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5zZXRJbnB1dFRpbWUgPSBmdW5jdGlvbihpbnB1dFRpbWUpIHtcclxuICAgIHZhciBjbGFtcGVkVmFsdWUgPSBNYXRoLm1heChNYXRoLm1pbihpbnB1dFRpbWUsIHRoaXMubWF4VGltZSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5taW5UaW1lKTtcclxuICAgIHRoaXMudGltZUlucHV0LnZhbHVlID0gY2xhbXBlZFZhbHVlO1xyXG5cclxuICAgIHRoaXMudXBkYXRlVGltZURpc3BsYXkoKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUudXBkYXRlVGltZURpc3BsYXkgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBkYXRlVmFsdWUgPSAnJztcclxuICAgIGlmICh0aGlzLmRhdGVGb3JtYXQgPT09ICd0aW1lc3RhbXAnKSB7XHJcbiAgICAgICAgdmFyIGRhdGUgPSBuZXcgRGF0ZShwYXJzZUZsb2F0KHRoaXMudGltZUlucHV0LnZhbHVlKSk7XHJcbiAgICAgICAgZGF0ZVZhbHVlID0gdGhpcy5nZXRGb3JtYXR0ZWREYXRlKGRhdGUpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBkYXRlVmFsdWUgPSBNYXRoLnJvdW5kKHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmRhdGVCb3gudGV4dENvbnRlbnQgPSBkYXRlVmFsdWU7XHJcbiAgICB0aGlzLnZyRGF0ZUJveDEudGV4dENvbnRlbnQgPSBkYXRlVmFsdWU7XHJcbiAgICB0aGlzLnZyRGF0ZUJveDIudGV4dENvbnRlbnQgPSBkYXRlVmFsdWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmdldEZvcm1hdHRlZERhdGUgPSBmdW5jdGlvbihkYXRlKSB7XHJcbiAgICB2YXIgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcclxuICAgIHZhciBtb250aCA9ICgxICsgZGF0ZS5nZXRNb250aCgpKS50b1N0cmluZygpO1xyXG4gICAgbW9udGggPSBtb250aC5sZW5ndGggPiAxID8gbW9udGggOiAnMCcgKyBtb250aDtcclxuICAgIHZhciBkYXkgPSBkYXRlLmdldERhdGUoKS50b1N0cmluZygpO1xyXG4gICAgZGF5ID0gZGF5Lmxlbmd0aCA+IDEgPyBkYXkgOiAnMCcgKyBkYXk7XHJcbiAgICByZXR1cm4geWVhciArICcvJyArIG1vbnRoICsgJy8nICsgZGF5O1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5oYW5kbGVQbGF5UGF1c2UgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMubG9vcCA9IGZhbHNlO1xyXG4gICAgdGhpcy5wYXVzZWQgPSAhdGhpcy5wYXVzZWQ7XHJcbiAgICBpZiAocGFyc2VGbG9hdCh0aGlzLnRpbWVJbnB1dC52YWx1ZSkgPj0gdGhpcy5tYXhUaW1lKSB7XHJcbiAgICAgICAgdGhpcy5wYXVzZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuc2V0SW5wdXRUaW1lKHRoaXMubWluVGltZSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBsYXlQYXVzZS52YWx1ZSA9IHRoaXMucGF1c2VkID8gJ1BsYXknIDogJ1BhdXNlJztcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuaGFuZGxlRW50ZXJWUiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5jaHJvbm9ncmFwaGVyLmVudGVyVlIoKTtcclxuXHJcbiAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xyXG4gICAgdGhpcy5sb29wID0gdHJ1ZTtcclxuXHJcbiAgICB0aGlzLmNvbnRyb2xzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICB0aGlzLnZyQ29udHJvbHMuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5oYW5kbGVMZWF2ZVZSID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmNocm9ub2dyYXBoZXIubGVhdmVWUigpO1xyXG5cclxuICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcclxuICAgIHRoaXMubG9vcCA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMuY29udHJvbHMuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xyXG4gICAgdGhpcy52ckNvbnRyb2xzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgZnVsbHNjcmVlbiA9IChkb2N1bWVudC53ZWJraXRJc0Z1bGxTY3JlZW4gfHxcclxuICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50Lm1vekZ1bGxTY3JlZW4gfHxcclxuICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50Lm1zRnVsbHNjcmVlbkVsZW1lbnQpO1xyXG5cclxuICAgIGlmICghZnVsbHNjcmVlbikge1xyXG4gICAgICAgIHRoaXMuaGFuZGxlTGVhdmVWUigpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihkdCkge1xyXG4gICAgaWYgKCF0aGlzLnBhdXNlZCkge1xyXG4gICAgICAgIC8vIFNjYWxlIGR0IHRvIGNvdmVyIHRoaXMudGltZVJhbmdlIG92ZXIgdGhpcy50b3RhbFBsYXl0aW1lLlxyXG4gICAgICAgIHZhciBkZWx0YVRpbWUgPSB0aGlzLnRpbWVSYW5nZSAvIHRoaXMudG90YWxQbGF5VGltZSAqIGR0O1xyXG4gICAgICAgIHZhciBuZXdUaW1lID0gcGFyc2VGbG9hdCh0aGlzLnRpbWVJbnB1dC52YWx1ZSkgKyBkZWx0YVRpbWU7XHJcbiAgICAgICAgdGhpcy5zZXRJbnB1dFRpbWUobmV3VGltZSk7XHJcblxyXG4gICAgICAgIC8vIEVuZCBvZiB0aW1lIHJhbmdlPyBMb29wIGJhY2sgdG8gdGhlIHN0YXJ0IG9yIHBhdXNlLlxyXG4gICAgICAgIGlmIChuZXdUaW1lID49IHRoaXMubWF4VGltZSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5sb29wKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldElucHV0VGltZSh0aGlzLm1pblRpbWUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wYXVzZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ2hyb25vQ29udHJvbHM7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBjaHJvbm9kYXRhVmVydGV4U2hhZGVyID0gcmVxdWlyZSgnLi9zaGFkZXJzL2Nocm9ub2RhdGFWZXJ0ZXgnKTtcclxudmFyIGNocm9ub2RhdGFGcmFnbWVudFNoYWRlciA9IHJlcXVpcmUoJy4vc2hhZGVycy9jaHJvbm9kYXRhRnJhZ21lbnQnKTtcclxuXHJcblxyXG52YXIgQ2hyb25vRGF0YSA9IGZ1bmN0aW9uKGRhdGFVUkwsIHJhZGl1cywgb3B0cykge1xyXG4gICAgdGhpcy5yYWRpdXMgPSByYWRpdXM7XHJcblxyXG4gICAgZnVuY3Rpb24gbG9hZFRleHQodXJsKSB7XHJcbiAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgdXJsLCBmYWxzZSk7IC8vIFN5bmNocm9ub3VzLlxyXG4gICAgICByZXF1ZXN0Lm92ZXJyaWRlTWltZVR5cGUoJ3RleHQvcGxhaW4nKTtcclxuICAgICAgcmVxdWVzdC5zZW5kKCk7XHJcblxyXG4gICAgICByZXR1cm4gcmVxdWVzdC5yZXNwb25zZVRleHQ7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5kYXRhID0gW107XHJcbiAgICB2YXIgdGltZXMgPSBbXTtcclxuICAgIHRoaXMuZ2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcclxuICAgIHRoaXMubWluVGltZSA9IE51bWJlci5NQVhfVkFMVUU7XHJcbiAgICB0aGlzLm1heFRpbWUgPSAwO1xyXG5cclxuICAgIC8vIExvYWQgZGF0YSBmcm9tIGEganNvbiBmaWxlLlxyXG4gICAgdmFyIGpzb25EYXRhID0gSlNPTi5wYXJzZShsb2FkVGV4dChkYXRhVVJMKSk7XHJcbiAgICB2YXIgbG9jYXRpb25zID0ganNvbkRhdGEubG9jYXRpb25zO1xyXG5cclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbG9jYXRpb25zLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgdmFyIHRpbWVzdGFtcE1zID0gcGFyc2VGbG9hdChsb2NhdGlvbnNbaV0udGltZXN0YW1wTXMpIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYXRpb25zW2ldLlllYXI7XHJcblxyXG4gICAgICAgIHRoaXMubWluVGltZSA9IE1hdGgubWluKHRpbWVzdGFtcE1zLCB0aGlzLm1pblRpbWUpO1xyXG4gICAgICAgIHRoaXMubWF4VGltZSA9IE1hdGgubWF4KHRpbWVzdGFtcE1zLCB0aGlzLm1heFRpbWUpO1xyXG5cclxuICAgICAgICB2YXIgbGF0aXR1ZGUgPSBsb2NhdGlvbnNbaV0ubGF0aXR1ZGVFNyAvIDEwMDAwMDAwLjAgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbnNbaV0uTGF0aXR1ZGU7XHJcbiAgICAgICAgdmFyIGxvbmdpdHVkZSA9IGxvY2F0aW9uc1tpXS5sb25naXR1ZGVFNyAvIDEwMDAwMDAwLjAgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYXRpb25zW2ldLkxvbmdpdHVkZTtcclxuXHJcbiAgICAgICAgdmFyIGRlZzJyYWQgPSBNYXRoLlBJIC8gMTgwLjA7XHJcbiAgICAgICAgdmFyIHBoaSA9IGxhdGl0dWRlICogZGVnMnJhZDtcclxuICAgICAgICB2YXIgdGhldGEgPSAoMTgwIC0gbG9uZ2l0dWRlKSAqIGRlZzJyYWQ7XHJcblxyXG4gICAgICAgIHZhciB4ID0gKHRoaXMucmFkaXVzICogMS4wMSkgKiBNYXRoLmNvcyhwaGkpICogTWF0aC5jb3ModGhldGEpO1xyXG4gICAgICAgIHZhciB5ID0gKHRoaXMucmFkaXVzICogMS4wMSkgKiBNYXRoLnNpbihwaGkpO1xyXG4gICAgICAgIHZhciB6ID0gKHRoaXMucmFkaXVzICogMS4wMSkgKiBNYXRoLmNvcyhwaGkpICogTWF0aC5zaW4odGhldGEpO1xyXG5cclxuICAgICAgICB0aGlzLmRhdGEucHVzaCh7XHJcbiAgICAgICAgICAnbGF0JzogbGF0aXR1ZGUsXHJcbiAgICAgICAgICAnbG9uZyc6IGxvbmdpdHVkZSxcclxuICAgICAgICAgICdwb3NpdGlvbic6IFt4LCB5LCB6XSxcclxuICAgICAgICAgICd0aW1lJzogdGltZXN0YW1wTXNcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aW1lcy5wdXNoKHRpbWVzdGFtcE1zKTtcclxuXHJcbiAgICAgICAgdGhpcy5nZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKG5ldyBUSFJFRS5WZWN0b3IzKHgsIHksIHopKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgYXR0cmlidXRlcyA9IHtcclxuICAgICAgcG9pbnRUaW1lOiB7IHR5cGU6ICdmJywgdmFsdWU6IHRpbWVzIH1cclxuICAgIH07XHJcblxyXG4gICAgdmFyIHVuaWZvcm1zID0ge1xyXG4gICAgICBwYXJ0aWNsZVRleHR1cmU6IHtcclxuICAgICAgICB0eXBlOiAndCcsXHJcbiAgICAgICAgdmFsdWU6IFRIUkVFLkltYWdlVXRpbHMubG9hZFRleHR1cmUoJ2ltYWdlcy9jaXJjbGVfYWxwaGEucG5nJylcclxuICAgICAgfSxcclxuICAgICAgdmlzdWFsaXphdGlvblRpbWU6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IHRoaXMubWluVGltZVxyXG4gICAgICB9LFxyXG4gICAgICBtaW5UaW1lOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiB0aGlzLm1pblRpbWVcclxuICAgICAgfSxcclxuICAgICAgbWF4VGltZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogdGhpcy5tYXhUaW1lXHJcbiAgICAgIH0sXHJcbiAgICAgIHBlcmNlbnRIaWdobGlnaHRSYW5nZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5wZXJjZW50SGlnaGxpZ2h0UmFuZ2UpIHx8IDAuMTBcclxuICAgICAgfSxcclxuICAgICAgbWluQWxwaGE6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWluQWxwaGEpIHx8IDEuMFxyXG4gICAgICB9LFxyXG4gICAgICBtYXhBbHBoYToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5tYXhBbHBoYSkgfHwgMS4wXHJcbiAgICAgIH0sXHJcbiAgICAgIG1pbkNvbG9yOiB7XHJcbiAgICAgICAgdHlwZTogJ2MnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLm1pbkNvbG9yKSB8fCBuZXcgVEhSRUUuQ29sb3IoMHgyMjIyMjIpXHJcbiAgICAgIH0sXHJcbiAgICAgIG1heENvbG9yOiB7XHJcbiAgICAgICAgdHlwZTogJ2MnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLm1heENvbG9yKSB8fCBuZXcgVEhSRUUuQ29sb3IoMHhFRUVFRUUpXHJcbiAgICAgIH0sXHJcbiAgICAgIG1pblNpemU6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWluU2l6ZSkgfHwgMTIuMFxyXG4gICAgICB9LFxyXG4gICAgICBtYXhTaXplOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLm1heFNpemUpIHx8IDMyLjBcclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLlNoYWRlck1hdGVyaWFsKHtcclxuICAgICAgYXR0cmlidXRlczogICAgIGF0dHJpYnV0ZXMsXHJcbiAgICAgIHVuaWZvcm1zOiAgICAgICB1bmlmb3JtcyxcclxuICAgICAgdmVydGV4U2hhZGVyOiAgIGNocm9ub2RhdGFWZXJ0ZXhTaGFkZXIsXHJcbiAgICAgIGZyYWdtZW50U2hhZGVyOiBjaHJvbm9kYXRhRnJhZ21lbnRTaGFkZXIsXHJcbiAgICAgIHRyYW5zcGFyZW50OiAgICB0cnVlLFxyXG4gICAgICBibGVuZGluZzogICAgICAgVEhSRUUuTm9ybWFsQmxlbmRpbmcsXHJcbiAgICAgIGRlcHRoV3JpdGU6ICAgICBmYWxzZVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5wYXJ0aWNsZXMgPSBuZXcgVEhSRUUuUG9pbnRDbG91ZCh0aGlzLmdlb21ldHJ5LCB0aGlzLm1hdGVyaWFsKTtcclxuICAgIC8vIHBhcnRpY2xlcy5zb3J0UGFydGljbGVzID0gdHJ1ZTtcclxuXHJcbiAgICBmdW5jdGlvbiBjb21wYXJlKGEsIGIpIHtcclxuICAgICAgICBpZiAoYS50aW1lIDwgYi50aW1lKSB7IHJldHVybiAtMTsgfVxyXG4gICAgICAgIGlmIChhLnRpbWUgPiBiLnRpbWUpIHsgcmV0dXJuIDE7IH1cclxuICAgICAgICByZXR1cm4gMDtcclxuICAgIH1cclxuICAgIHRoaXMuZGF0YS5zb3J0KGNvbXBhcmUpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLnNldFNjZW5lID0gZnVuY3Rpb24oc2NlbmUpIHtcclxuICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcclxuICAgIHNjZW5lLmFkZCh0aGlzLnBhcnRpY2xlcyk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcblxyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLnNldFRpbWUgPSBmdW5jdGlvbihuZXdUaW1lKSB7XHJcbiAgICB0aGlzLmN1cnJlbnRUaW1lID0gbmV3VGltZTtcclxuICAgIHRoaXMubWF0ZXJpYWwudW5pZm9ybXNbJ3Zpc3VhbGl6YXRpb25UaW1lJ10udmFsdWUgPSBuZXdUaW1lO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLmdldEN1cnJlbnRUaW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5jdXJyZW50VGltZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5nZXRNaW5UaW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5taW5UaW1lO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLmdldE1heFRpbWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLm1heFRpbWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuZ2V0RGF0YSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZGF0YTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENocm9ub0RhdGE7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBDaHJvbm9EYXRhID0gcmVxdWlyZSgnLi9DaHJvbm9EYXRhJyk7XHJcbnZhciBDaHJvbm9Db250cm9scyA9IHJlcXVpcmUoJy4vQ2hyb25vQ29udHJvbHMnKTtcclxudmFyIERldmljZU9yYml0Q29udHJvbHMgPSByZXF1aXJlKCcuL0RldmljZU9yYml0Q29udHJvbHMnKTtcclxudmFyIEVhcnRoID0gcmVxdWlyZSgnLi9FYXJ0aCcpO1xyXG52YXIgRm9sbG93TGluZSA9IHJlcXVpcmUoJy4vRm9sbG93TGluZScpO1xyXG5cclxuXHJcbnZhciBDaHJvbm9ncmFwaGVyID0gZnVuY3Rpb24oY29udGFpbmVyLCBkYXRhLCBvcHRzKSB7XHJcbiAgICBpZiAoIURldGVjdG9yLndlYmdsKSB7IERldGVjdG9yLmFkZEdldFdlYkdMTWVzc2FnZSgpOyB9XHJcblxyXG4gICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XHJcbiAgICB0aGlzLndpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XHJcbiAgICB0aGlzLmhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcclxuICAgIHRoaXMucmFkaXVzID0gMTAwMDtcclxuXHJcbiAgICB0aGlzLnZyID0gZmFsc2U7XHJcblxyXG4gICAgdGhpcy5zZXR1cFJlbmRlcmVyKCk7XHJcbiAgICB0aGlzLnNldHVwU2NlbmUoKTtcclxuXHJcbiAgICB0aGlzLmNocm9ub0RhdGEgPSBuZXcgQ2hyb25vRGF0YShkYXRhLCB0aGlzLnJhZGl1cywgb3B0cyk7XHJcbiAgICB0aGlzLmNocm9ub0RhdGEuc2V0U2NlbmUodGhpcy5zY2VuZSk7XHJcbiAgICB2YXIgbWluVGltZSA9IHRoaXMuY2hyb25vRGF0YS5nZXRNaW5UaW1lKCk7XHJcbiAgICB2YXIgbWF4VGltZSA9IHRoaXMuY2hyb25vRGF0YS5nZXRNYXhUaW1lKCk7XHJcblxyXG4gICAgdGhpcy5jaHJvbm9Db250cm9scyA9IG5ldyBDaHJvbm9Db250cm9scyh0aGlzLCBjb250YWluZXIsIG9wdHMpO1xyXG4gICAgdGhpcy5jaHJvbm9Db250cm9scy5zZXRUaW1lUmFuZ2UobWluVGltZSwgbWF4VGltZSk7XHJcblxyXG4gICAgdGhpcy5lYXJ0aCA9IG5ldyBFYXJ0aCh0aGlzLnJhZGl1cyk7XHJcbiAgICB0aGlzLmVhcnRoLnNldFNjZW5lKHRoaXMuc2NlbmUpO1xyXG5cclxuICAgIGlmIChvcHRzLmZvbGxvd0xpbmUpIHtcclxuICAgICAgICB0aGlzLmZvbGxvd0xpbmUgPSBuZXcgRm9sbG93TGluZSh0aGlzLmNocm9ub0RhdGEsIHRoaXMucmFkaXVzKTtcclxuICAgICAgICB0aGlzLmZvbGxvd0xpbmUuc2V0U2NlbmUodGhpcy5zY2VuZSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUuc2V0dXBSZW5kZXJlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5yZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKHthbHBoYTogdHJ1ZSwgYW50aWFsaWFzOiB0cnVlfSk7XHJcbiAgICB0aGlzLnJlbmRlcmVyLnNldFNpemUod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XHJcbiAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQpO1xyXG4gICAgdGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmlkID0gJ2Nnci1jaHJvbm9EYXRhJztcclxuXHJcbiAgICB0aGlzLmVmZmVjdCA9IG5ldyBUSFJFRS5TdGVyZW9FZmZlY3QodGhpcy5yZW5kZXJlcik7XHJcbiAgICB0aGlzLmVmZmVjdC5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5vbldpbmRvd1Jlc2l6ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy53aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xyXG4gICAgdGhpcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcblxyXG4gICAgdGhpcy5jYW1lcmEuYXNwZWN0ID0gdGhpcy53aWR0aCAvIHRoaXMuaGVpZ2h0O1xyXG4gICAgdGhpcy5jYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xyXG5cclxuICAgIHRoaXMucmVuZGVyZXIuc2V0U2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XHJcbiAgICB0aGlzLmVmZmVjdC5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5zZXRPcmllbnRhdGlvbkNvbnRyb2xzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmNvbnRyb2xzID0gdGhpcy5kZXZpY2VPcmJpdENvbnRyb2xzO1xyXG4gICAgdGhpcy5vcmJpdENvbnRyb2xzLmVuYWJsZWQgPSBmYWxzZTtcclxuICAgIHRoaXMuZGV2aWNlT3JiaXRDb250cm9scy5lbmFibGVkID0gdHJ1ZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5zZXRPcmJpdENvbnRyb2xzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmNvbnRyb2xzID0gdGhpcy5vcmJpdENvbnRyb2xzO1xyXG4gICAgdGhpcy5vcmJpdENvbnRyb2xzLmVuYWJsZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5kZXZpY2VPcmJpdENvbnRyb2xzLmVuYWJsZWQgPSBmYWxzZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5lbnRlclZSID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnZyID0gdHJ1ZTtcclxuICAgIHRoaXMuZnVsbHNjcmVlbigpO1xyXG4gICAgdGhpcy5zZXRPcmllbnRhdGlvbkNvbnRyb2xzKCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUubGVhdmVWUiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy52ciA9IGZhbHNlO1xyXG4gICAgdGhpcy5zZXRPcmJpdENvbnRyb2xzKCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUuZnVsbHNjcmVlbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYgKHRoaXMuY29udGFpbmVyLnJlcXVlc3RGdWxsc2NyZWVuKSB7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIucmVxdWVzdEZ1bGxzY3JlZW4oKTtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5jb250YWluZXIubXNSZXF1ZXN0RnVsbHNjcmVlbikge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLm1zUmVxdWVzdEZ1bGxzY3JlZW4oKTtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5jb250YWluZXIubW96UmVxdWVzdEZ1bGxTY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lci5tb3pSZXF1ZXN0RnVsbFNjcmVlbigpO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnRhaW5lci53ZWJraXRSZXF1ZXN0RnVsbHNjcmVlbikge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLndlYmtpdFJlcXVlc3RGdWxsc2NyZWVuKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHRhcmdldE9yaWVudGF0aW9uID0gWydsYW5kc2NhcGUtcHJpbWFyeScsICdsYW5kc2NhcGUtc2Vjb25kYXJ5J107XHJcbiAgICBpZiAoc2NyZWVuLmxvY2tPcmllbnRhdGlvbikge1xyXG4gICAgICAgIHNjcmVlbi5sb2NrT3JpZW50YXRpb24odGFyZ2V0T3JpZW50YXRpb24pO1xyXG4gICAgfSBlbHNlIGlmIChzY3JlZW4ubW96TG9ja09yaWVudGF0aW9uKSB7XHJcbiAgICAgICAgc2NyZWVuLm1vekxvY2tPcmllbnRhdGlvbih0YXJnZXRPcmllbnRhdGlvbik7XHJcbiAgICB9IGVsc2UgaWYgKHNjcmVlbi5tc0xvY2tPcmllbnRhdGlvbikge1xyXG4gICAgICAgIHNjcmVlbi5tc0xvY2tPcmllbnRhdGlvbih0YXJnZXRPcmllbnRhdGlvbik7XHJcbiAgICB9IGVsc2UgaWYgKHNjcmVlbi5vcmllbnRhdGlvbi5sb2NrKSB7XHJcbiAgICAgICAgc2NyZWVuLm9yaWVudGF0aW9uLmxvY2sodGFyZ2V0T3JpZW50YXRpb24pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnNldHVwU2NlbmUgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcclxuXHJcbiAgICB0aGlzLmNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYSg3NSxcclxuICAgICAgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDEsIDMwMDAwKTtcclxuICAgIHRoaXMuY2FtZXJhLnBvc2l0aW9uLnogPSAtKHRoaXMucmFkaXVzICogMS41KTtcclxuICAgIHRoaXMuY2FtZXJhLnBvc2l0aW9uLnkgPSB0aGlzLnJhZGl1cyAqIDEuMjtcclxuICAgIHRoaXMuY2FtZXJhLmxvb2tBdCh0aGlzLnNjZW5lLnBvc2l0aW9uKTtcclxuXHJcbiAgICB0aGlzLmRldmljZU9yYml0Q29udHJvbHMgPSBuZXcgRGV2aWNlT3JiaXRDb250cm9scyh0aGlzLmNhbWVyYSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmFkaXVzICogMi4wKTtcclxuXHJcbiAgICB0aGlzLm9yYml0Q29udHJvbHMgPSBuZXcgVEhSRUUuT3JiaXRDb250cm9scyh0aGlzLmNhbWVyYSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCk7XHJcbiAgICB0aGlzLm9yYml0Q29udHJvbHMuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XHJcbiAgICB0aGlzLm9yYml0Q29udHJvbHMubm9QYW4gPSB0cnVlO1xyXG4gICAgdGhpcy5vcmJpdENvbnRyb2xzLnJvdGF0ZVNwZWVkID0gMC41O1xyXG5cclxuICAgIHRoaXMuc2V0T3JiaXRDb250cm9scygpO1xyXG5cclxuICAgIHZhciBhbWJpZW50TGlnaHQgPSBuZXcgVEhSRUUuQW1iaWVudExpZ2h0KDB4ODg4ODg4KTtcclxuICAgIHRoaXMuc2NlbmUuYWRkKGFtYmllbnRMaWdodCk7XHJcblxyXG4gICAgdmFyIGRpckxpZ2h0ID0gbmV3IFRIUkVFLkRpcmVjdGlvbmFsTGlnaHQoMHhjY2NjY2MsIDAuMik7XHJcbiAgICBkaXJMaWdodC5wb3NpdGlvbi5zZXQoNSwgMywgNSk7XHJcbiAgICB0aGlzLnNjZW5lLmFkZChkaXJMaWdodCk7XHJcblxyXG4gICAgdGhpcy5jbG9jayA9IG5ldyBUSFJFRS5DbG9jaygpO1xyXG5cclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCB0aGlzLm9uV2luZG93UmVzaXplLmJpbmQodGhpcyksIGZhbHNlKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBkdCA9IHRoaXMuY2xvY2suZ2V0RGVsdGEoKTtcclxuXHJcbiAgICB0aGlzLmNocm9ub0NvbnRyb2xzLnVwZGF0ZShkdCk7XHJcbiAgICB0aGlzLmNocm9ub0RhdGEuc2V0VGltZSh0aGlzLmNocm9ub0NvbnRyb2xzLmdldFRpbWUoKSk7XHJcblxyXG4gICAgdGhpcy5jaHJvbm9EYXRhLnVwZGF0ZShkdCk7XHJcbiAgICBpZiAodGhpcy5mb2xsb3dMaW5lKSB7XHJcbiAgICAgICAgdGhpcy5mb2xsb3dMaW5lLnVwZGF0ZShkdCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5jb250cm9scy51cGRhdGUoZHQpO1xyXG4gICAgdGhpcy5yZW5kZXIoKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMucmVuZGVyZXIuY2xlYXIoKTtcclxuXHJcbiAgICBpZiAodGhpcy52cikge1xyXG4gICAgICAgIHRoaXMuZWZmZWN0LnJlbmRlcih0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMucmVuZGVyZXIucmVuZGVyKHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENocm9ub2dyYXBoZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBEZXZpY2VPcmJpdENvbnRyb2xzID0gZnVuY3Rpb24oY2FtZXJhLCByYWRpdXMpIHtcclxuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XHJcbiAgICB0aGlzLmNhbWVyYSA9IGNhbWVyYTtcclxuICAgIHRoaXMucmFkaXVzID0gcmFkaXVzO1xyXG5cclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VvcmllbnRhdGlvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRPcmllbnRhdGlvbi5iaW5kKHRoaXMpLCBmYWxzZSk7XHJcbn07XHJcblxyXG5cclxuRGV2aWNlT3JiaXRDb250cm9scy5wcm90b3R5cGUuc2V0T3JpZW50YXRpb24gPSBmdW5jdGlvbihldmVudCkge1xyXG4gICAgaWYgKCF0aGlzLmVuYWJsZWQpIHsgcmV0dXJuOyB9XHJcblxyXG4gICAgdmFyIGRlZzJyYWQgPSBNYXRoLlBJIC8gMTgwLjA7XHJcbiAgICB2YXIgYWxwaGEgPSAtKChldmVudC5hbHBoYSkgKiBkZWcycmFkKTtcclxuICAgIHZhciBnYW1tYSA9ICAoKGV2ZW50LmdhbW1hICsgOTApICogZGVnMnJhZCk7XHJcblxyXG4gICAgdmFyIHggPSB0aGlzLnJhZGl1cyAqIE1hdGguY29zKGdhbW1hKSAqIE1hdGguY29zKGFscGhhKTtcclxuICAgIHZhciB5ID0gdGhpcy5yYWRpdXMgKiBNYXRoLnNpbihnYW1tYSk7XHJcbiAgICB2YXIgeiA9IHRoaXMucmFkaXVzICogTWF0aC5jb3MoZ2FtbWEpICogTWF0aC5zaW4oYWxwaGEpO1xyXG5cclxuICAgIHRoaXMuY2FtZXJhLnBvc2l0aW9uLnNldCh4LCB5LCB6KTtcclxuICAgIHRoaXMuY2FtZXJhLmxvb2tBdChuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMCwgMC4wKSk7XHJcbn07XHJcblxyXG5cclxuRGV2aWNlT3JiaXRDb250cm9scy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcblxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRGV2aWNlT3JiaXRDb250cm9scztcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEVhcnRoID0gZnVuY3Rpb24ocmFkaXVzKSB7XHJcbiAgICB2YXIgZWFydGhHZW9tZXRyeSA9IG5ldyBUSFJFRS5TcGhlcmVHZW9tZXRyeShyYWRpdXMsIDgwLCA2MCk7XHJcbiAgICB2YXIgZWFydGhNYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoUGhvbmdNYXRlcmlhbCh7XHJcbiAgICAgIG1hcDogdGhpcy5sb2FkVGV4dHVyZSgnZWFydGhfZGlmZnVzZV80ay5qcGcnKVxyXG4gICAgICAvLyBtYXA6IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX2RpZmZ1c2VfbmlnaHRfNGsuanBnJylcclxuICAgIH0pO1xyXG5cclxuICAgIGVhcnRoTWF0ZXJpYWwuYnVtcE1hcCA9IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX2J1bXBfNGsuanBnJyk7XHJcbiAgICBlYXJ0aE1hdGVyaWFsLmJ1bXBTY2FsZSA9IHJhZGl1cyAvIDIuMDtcclxuICAgIGVhcnRoTWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSB0aGlzLmxvYWRUZXh0dXJlKCdlYXJ0aF9zcGVjdWxhcl80ay5qcGcnKTtcclxuICAgIGVhcnRoTWF0ZXJpYWwuc3BlY3VsYXIgPSBuZXcgVEhSRUUuQ29sb3IoMHgzQTNBM0EpO1xyXG5cclxuICAgIHRoaXMuZWFydGhNZXNoID0gbmV3IFRIUkVFLk1lc2goZWFydGhHZW9tZXRyeSwgZWFydGhNYXRlcmlhbCk7XHJcbiAgICB0aGlzLmVhcnRoTWVzaC5yb3RhdGlvbi55ID0gTWF0aC5QSTtcclxuXHJcbiAgICB2YXIgYm91bmRhcmllc01hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtcclxuICAgICAgbWFwOiB0aGlzLmxvYWRUZXh0dXJlKCdlYXJ0aF9ib3VuZGFyaWVzXzRrLnBuZycpLFxyXG4gICAgICB0cmFuc3BhcmVudDogdHJ1ZSxcclxuICAgICAgb3BhY2l0eTogMC41XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmJvdW5kYXJpZXNNZXNoID0gbmV3IFRIUkVFLk1lc2goZWFydGhHZW9tZXRyeSwgYm91bmRhcmllc01hdGVyaWFsKTtcclxuICAgIHRoaXMuYm91bmRhcmllc01lc2gucm90YXRpb24ueSA9IE1hdGguUEk7XHJcbn07XHJcblxyXG5cclxuRWFydGgucHJvdG90eXBlLnNldFNjZW5lID0gZnVuY3Rpb24oc2NlbmUpIHtcclxuICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcclxuICAgIHNjZW5lLmFkZCh0aGlzLmVhcnRoTWVzaCk7XHJcbiAgICBzY2VuZS5hZGQodGhpcy5ib3VuZGFyaWVzTWVzaCk7XHJcbn07XHJcblxyXG5cclxuRWFydGgucHJvdG90eXBlLmxvYWRUZXh0dXJlID0gZnVuY3Rpb24odGV4dHVyZU5hbWUpIHtcclxuICAvLyBUT0RPOiBjdXN0b21pemUgcGF0aCBvciBpbWFnZXMsIHRoaXMgcmVsYXRpdmUgcGF0aCBpcyBuYXN0eS5cclxuICAgIHJldHVybiBUSFJFRS5JbWFnZVV0aWxzLmxvYWRUZXh0dXJlKCcuLi8uLi9kaXN0L2ltYWdlcy8nICsgdGV4dHVyZU5hbWUpO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRWFydGg7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBGb2xsb3dMaW5lID0gZnVuY3Rpb24oY2hyb25vRGF0YSwgcmFkaXVzKSB7XHJcbiAgICB0aGlzLmNocm9ub0RhdGEgPSBjaHJvbm9EYXRhO1xyXG4gICAgdGhpcy5yYWRpdXMgPSByYWRpdXM7XHJcbiAgICB0aGlzLm1heFBvaW50cyA9IDEwMDA7XHJcblxyXG4gICAgdGhpcy5jdXJ2ZSA9IG5ldyBUSFJFRS5TcGxpbmVDdXJ2ZTMoW1xyXG4gICAgICBuZXcgVEhSRUUuVmVjdG9yMygwLDAsMCksXHJcbiAgICAgIG5ldyBUSFJFRS5WZWN0b3IzKDAsMCwwKVxyXG4gICAgXSk7XHJcblxyXG4gICAgdGhpcy5jdXJ2ZVBvaW50cyA9IFtdO1xyXG5cclxuICAgIHRoaXMuY3VydmVHZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xyXG4gICAgdGhpcy5jdXJ2ZUdlb21ldHJ5LnZlcnRpY2VzID0gdGhpcy5jdXJ2ZS5nZXRQb2ludHMoMjAwKTtcclxuXHJcbiAgICB0aGlzLmN1cnZlTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoIHsgY29sb3I6IDB4Y2NjY2NjIH0gKTtcclxuXHJcbiAgICB0aGlzLmxpbmUgPSBuZXcgVEhSRUUuTGluZSh0aGlzLmN1cnZlR2VvbWV0cnksIHRoaXMuY3VydmVNYXRlcmlhbCk7XHJcblxyXG4gICAgdGhpcy5kYXRhID0gY2hyb25vRGF0YS5nZXREYXRhKCk7XHJcbiAgICB0aGlzLmxhc3RUaW1lID0gY2hyb25vRGF0YS5nZXRNaW5UaW1lKCk7XHJcbiAgICB0aGlzLmN1cnJlbnREYXRhSW5kZXggPSAwO1xyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLnNldFNjZW5lID0gZnVuY3Rpb24oc2NlbmUpIHtcclxuICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcclxuICAgIHNjZW5lLmFkZCh0aGlzLmxpbmUpO1xyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGN1cnJlbnRUaW1lID0gdGhpcy5jaHJvbm9EYXRhLmdldEN1cnJlbnRUaW1lKCk7XHJcblxyXG4gICAgaWYgKGN1cnJlbnRUaW1lIDwgdGhpcy5sYXN0VGltZSkge1xyXG4gICAgICAgIHRoaXMucmVzZXQoY3VycmVudFRpbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHdoaWxlIChjdXJyZW50VGltZSA+IHRoaXMuZGF0YVt0aGlzLmN1cnJlbnREYXRhSW5kZXhdLnRpbWUpIHtcclxuICAgICAgICB0aGlzLmN1cnJlbnREYXRhSW5kZXgrKztcclxuICAgICAgICB0aGlzLmFkZFBvaW50KCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5sYXN0VGltZSA9IGN1cnJlbnRUaW1lO1xyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oY3VycmVudFRpbWUpIHtcclxuICAgIHRoaXMuY3VydmVQb2ludHMgPSBbXTtcclxuICAgIHRoaXMuY3VycmVudERhdGFJbmRleCA9IDA7XHJcblxyXG4gICAgd2hpbGUgKGN1cnJlbnRUaW1lID4gdGhpcy5kYXRhW3RoaXMuY3VycmVudERhdGFJbmRleF0udGltZSkge1xyXG4gICAgICAgIHRoaXMuY3VycmVudERhdGFJbmRleCsrO1xyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLmFkZFBvaW50ID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgbmV4dFBvc2l0aW9uID0gdGhpcy5kYXRhW3RoaXMuY3VycmVudERhdGFJbmRleF0ucG9zaXRpb247XHJcbiAgICB0aGlzLmN1cnZlUG9pbnRzLnB1c2gobmV3IFRIUkVFLlZlY3RvcjMobmV4dFBvc2l0aW9uWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRQb3NpdGlvblsxXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXh0UG9zaXRpb25bMl0pKTtcclxuICAgIGlmICh0aGlzLmN1cnZlUG9pbnRzLmxlbmd0aCA+IHRoaXMubWF4UG9pbnRzKSB7XHJcbiAgICAgICAgdGhpcy5jdXJ2ZVBvaW50cy5zaGlmdCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY3VydmUgPSBuZXcgVEhSRUUuU3BsaW5lQ3VydmUzKHRoaXMuY3VydmVQb2ludHMpO1xyXG5cclxuICAgIHRoaXMuY3VydmVHZW9tZXRyeS52ZXJ0aWNlcyA9IHRoaXMuY3VydmUuZ2V0UG9pbnRzKHRoaXMubWF4UG9pbnRzICogMyk7XHJcbiAgICB0aGlzLmxpbmUuZ2VvbWV0cnkudmVydGljZXNOZWVkVXBkYXRlID0gdHJ1ZTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEZvbGxvd0xpbmU7XHJcbiIsIi8vIEVudHJ5IHBvaW50IGZvciBidWlsZGluZy5cclxuXHJcbnZhciBDaHJvbm9ncmFwaGVyID0gcmVxdWlyZSgnLi9DaHJvbm9ncmFwaGVyJyk7XHJcblxyXG53aW5kb3cuQ2hyb25vZ3JhcGhlciA9IENocm9ub2dyYXBoZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBjaHJvbm9kYXRhRnJhZ21lbnQgPSAnJyArXHJcbiAgICAndW5pZm9ybSBzYW1wbGVyMkQgcGFydGljbGVUZXh0dXJlOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndmFyeWluZyBmbG9hdCB0OyBcXG4nICtcclxuICAgICd2YXJ5aW5nIHZlYzMgdGltZUNvbG9yOyBcXG4nICtcclxuICAgICd2YXJ5aW5nIGZsb2F0IHRpbWVBbHBoYTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3ZvaWQgbWFpbigpIHsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHRleHR1cmVBbHBoYSA9IHRleHR1cmUyRChwYXJ0aWNsZVRleHR1cmUsIGdsX1BvaW50Q29vcmQpLmE7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBhbHBoYSA9IHRleHR1cmVBbHBoYSAqIHRpbWVBbHBoYTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICB2ZWMzIGNvbG9yID0gdGltZUNvbG9yOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoY29sb3IsIGFscGhhKTsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcnO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBjaHJvbm9kYXRhRnJhZ21lbnQ7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBjaHJvbm9kYXRhVmVydGV4ID0gJycgK1xyXG4gICAgJ2F0dHJpYnV0ZSBmbG9hdCBwb2ludFRpbWU7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1pblRpbWU7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWF4VGltZTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCB2aXN1YWxpemF0aW9uVGltZTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBwZXJjZW50SGlnaGxpZ2h0UmFuZ2U7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1pbkFscGhhOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1heEFscGhhOyBcXG4nICtcclxuICAgICd1bmlmb3JtIHZlYzMgbWluQ29sb3I7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gdmVjMyBtYXhDb2xvcjsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBtaW5TaXplOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1heFNpemU7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd2YXJ5aW5nIGZsb2F0IHQ7IFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgZmxvYXQgdGltZUFscGhhOyBcXG4nICtcclxuICAgICd2YXJ5aW5nIHZlYzMgdGltZUNvbG9yOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnZmxvYXQgbGVycChmbG9hdCBtaW5WYWx1ZSwgZmxvYXQgbWF4VmFsdWUsIGZsb2F0IHQpIHsgXFxuJyArXHJcbiAgICAnICAgIHJldHVybiAobWluVmFsdWUgKiAoMS4wIC0gdCkpICsgKG1heFZhbHVlICogdCk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ2Zsb2F0IGludmVyc2VMZXJwKGZsb2F0IHZhbHVlLCBmbG9hdCBtaW5WYWx1ZSwgZmxvYXQgbWF4VmFsdWUpIHsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHZhbHVlUmFuZ2UgPSBtYXhWYWx1ZSAtIG1pblZhbHVlOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgaW52ZXJzZUxlcnBlZCA9ICh2YWx1ZSAtIG1pblZhbHVlKSAvIHZhbHVlUmFuZ2U7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBjbGFtcGVkID0gY2xhbXAoaW52ZXJzZUxlcnBlZCwgMC4wLCAxLjApOyBcXG4nICtcclxuICAgICcgICAgcmV0dXJuIGludmVyc2VMZXJwZWQ7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJy8vIFJHQiB0byBIU1YgYW5kIEhTViB0byBSR0IgXFxuJyArXHJcbiAgICAnLy8gc291cmNlOiBodHRwOi8vbG9sZW5naW5lLm5ldC9ibG9nLzIwMTMvMDcvMjcvcmdiLXRvLWhzdi1pbi1nbHNsIFxcbicgK1xyXG4gICAgJ3ZlYzMgcmdiMmhzdih2ZWMzIGMpIHsgXFxuJyArXHJcbiAgICAnICAgIHZlYzQgSyA9IHZlYzQoMC4wLCAtMS4wIC8gMy4wLCAyLjAgLyAzLjAsIC0xLjApOyBcXG4nICtcclxuICAgICcgICAgdmVjNCBwID0gYy5nIDwgYy5iID8gdmVjNChjLmJnLCBLLnd6KSA6IHZlYzQoYy5nYiwgSy54eSk7IFxcbicgK1xyXG4gICAgJyAgICB2ZWM0IHEgPSBjLnIgPCBwLnggPyB2ZWM0KHAueHl3LCBjLnIpIDogdmVjNChjLnIsIHAueXp4KTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBkID0gcS54IC0gbWluKHEudywgcS55KTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGUgPSAxLjBlLTEwOyBcXG4nICtcclxuICAgICcgICAgcmV0dXJuIHZlYzMoYWJzKHEueiArIChxLncgLSBxLnkpIC8gKDYuMCAqIGQgKyBlKSksIGQgLyAocS54ICsgZSksIHEueCk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3ZlYzMgaHN2MnJnYih2ZWMzIGMpIHsgXFxuJyArXHJcbiAgICAnICAgIHZlYzQgSyA9IHZlYzQoMS4wLCAyLjAgLyAzLjAsIDEuMCAvIDMuMCwgMy4wKTsgXFxuJyArXHJcbiAgICAnICAgIHZlYzMgcCA9IGFicyhmcmFjdChjLnh4eCArIEsueHl6KSAqIDYuMCAtIEsud3d3KTsgXFxuJyArXHJcbiAgICAnICAgIHJldHVybiBjLnogKiBtaXgoSy54eHgsIGNsYW1wKHAgLSBLLnh4eCwgMC4wLCAxLjApLCBjLnkpOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndm9pZCBtYWluKCkgeyBcXG4nICtcclxuICAgICcgICAgdmVjNCBtdlBvc2l0aW9uID0gdmlld01hdHJpeCAqIHZlYzQocG9zaXRpb24sIDEuMCk7IFxcbicgK1xyXG4gICAgJyAgICBnbF9Qb3NpdGlvbiA9IHByb2plY3Rpb25NYXRyaXggKiBtdlBvc2l0aW9uOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHZlcnRleFBlcmNlbnQgPSBpbnZlcnNlTGVycChwb2ludFRpbWUsIG1pblRpbWUsIG1heFRpbWUpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdmlzUGVyY2VudCA9IGludmVyc2VMZXJwKHZpc3VhbGl6YXRpb25UaW1lLCBtaW5UaW1lLCBtYXhUaW1lKTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHBlcmNlbnREaWZmZXJlbmNlID0gYWJzKHZlcnRleFBlcmNlbnQgLSB2aXNQZXJjZW50KTsgXFxuJyArXHJcbiAgICAnICAgIC8vIFNjYWxlIGRpZmZlcmVuY2UgYmFzZWQgb24gaGlnaGxpZ2h0IHJhbmdlIGludG8gYW4gaW50ZXJwb2xhdGlvbiB0aW1lLiBcXG4nICtcclxuICAgICcgICAgdCA9IGNsYW1wKDEuMCAtIHBlcmNlbnREaWZmZXJlbmNlIC8gcGVyY2VudEhpZ2hsaWdodFJhbmdlLCAwLjAsIDEuMCk7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgZ2xfUG9pbnRTaXplID0gbGVycChtaW5TaXplLCBtYXhTaXplLCB0KTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICB0aW1lQWxwaGEgPSBsZXJwKG1pbkFscGhhLCBtYXhBbHBoYSwgdCk7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgdmVjMyBtaW5IU1YgPSByZ2IyaHN2KG1pbkNvbG9yKTsgXFxuJyArXHJcbiAgICAnICAgIHZlYzMgbWF4SFNWID0gcmdiMmhzdihtYXhDb2xvcik7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBoID0gbGVycChtaW5IU1YueCwgbWF4SFNWLngsIHQpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgcyA9IGxlcnAobWluSFNWLnksIG1heEhTVi55LCB0KTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHYgPSBsZXJwKG1pbkhTVi56LCBtYXhIU1YueiwgdCk7IFxcbicgK1xyXG4gICAgJyAgICB0aW1lQ29sb3IgPSBoc3YycmdiKHZlYzMoaCwgcywgdikpOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGNocm9ub2RhdGFWZXJ0ZXg7XHJcbiJdfQ==
