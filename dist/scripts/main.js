(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var ChronoControls = function(chronographer, container, opts) {
    this.chronographer = chronographer;
    this.totalPlayTime = 10.0;
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
    this.controls = new DeviceOrbitControls(this.camera, this.radius * 2.0);

    window.removeEventListener('deviceorientation',
                               this.setOrientationControls);
};


Chronographer.prototype.enterVR = function() {
    this.fullscreen();

    this.vr = true;
};


Chronographer.prototype.leaveVR = function() {
    this.vr = false;
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

    var targetOrientation = ['landscape-primary'];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwic3JjXFxqc1xcQ2hyb25vQ29udHJvbHMuanMiLCJzcmNcXGpzXFxDaHJvbm9EYXRhLmpzIiwic3JjXFxqc1xcQ2hyb25vZ3JhcGhlci5qcyIsInNyY1xcanNcXERldmljZU9yYml0Q29udHJvbHMuanMiLCJzcmNcXGpzXFxFYXJ0aC5qcyIsInNyY1xcanNcXEZvbGxvd0xpbmUuanMiLCJzcmNcXGpzXFxtYWluLmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YUZyYWdtZW50LmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YVZlcnRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBDaHJvbm9Db250cm9scyA9IGZ1bmN0aW9uKGNocm9ub2dyYXBoZXIsIGNvbnRhaW5lciwgb3B0cykge1xyXG4gICAgdGhpcy5jaHJvbm9ncmFwaGVyID0gY2hyb25vZ3JhcGhlcjtcclxuICAgIHRoaXMudG90YWxQbGF5VGltZSA9IDEwLjA7XHJcbiAgICB0aGlzLnBhdXNlZCA9IHRydWU7XHJcbiAgICB0aGlzLmxvb3AgPSB0cnVlO1xyXG4gICAgdGhpcy5kYXRlRm9ybWF0ID0gKG9wdHMgJiYgb3B0cy5kYXRlRm9ybWF0KSB8fCAnc3RyaW5nJztcclxuXHJcbiAgICAvLyBDcmVhdGUgY29udHJvbHMgZnJvbSBpbXBvcnRlZCBodG1sLlxyXG4gICAgdmFyIGNvbnRlbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdsaW5rW3JlbD1cImltcG9ydFwiXScpLmltcG9ydDtcclxuICAgIHZhciBjb250cm9scyA9IGNvbnRlbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby1jb250cm9scy1yb290Jyk7XHJcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY29udHJvbHMpO1xyXG5cclxuICAgIHRoaXMuY29udHJvbHMgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tY29udHJvbHMnKTtcclxuICAgIHRoaXMudnJDb250cm9scyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tdnItY29udHJvbHMnKTtcclxuXHJcbiAgICB0aGlzLnBsYXlQYXVzZSAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLXBsYXlQYXVzZUJ1dHRvbicpO1xyXG4gICAgdGhpcy5lbnRlclZSICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby1lbnRlclZSQnV0dG9uJyk7XHJcbiAgICB0aGlzLnRpbWVJbnB1dCAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLXRpbWVJbnB1dCcpO1xyXG4gICAgdGhpcy5kYXRlQm94ICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby1kYXRlQm94Jyk7XHJcbiAgICB0aGlzLnZyRGF0ZUJveDEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLXZyLWRhdGVCb3gtMScpO1xyXG4gICAgdGhpcy52ckRhdGVCb3gyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby12ci1kYXRlQm94LTInKTtcclxuXHJcbiAgICAvLyBMaXN0ZW4gdG8gcGxheS9wYXVzZSBldmVudHMgKGJ1dHRvbiBjbGljayBhbmQgc3BhY2UgYmFyKS5cclxuICAgIHRoaXMucGxheVBhdXNlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5oYW5kbGVQbGF5UGF1c2UuYmluZCh0aGlzKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UpO1xyXG4gICAgZG9jdW1lbnQub25rZXlwcmVzcyA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IDMyKSB7XHJcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlUGxheVBhdXNlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKHRoaXMpO1xyXG5cclxuICAgIC8vIEFsc28gdXBkYXRlIGlmIHRoZSBpbnB1dCBzbGlkZXIgaXMgY2hhbmdlZCBkaXJlY3RseS5cclxuICAgIHRoaXMudGltZUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMudXBkYXRlVGltZURpc3BsYXkuYmluZCh0aGlzKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UpO1xyXG5cclxuICAgIHRoaXMuZW50ZXJWUi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuaGFuZGxlRW50ZXJWUi5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UpO1xyXG5cclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdGZ1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vemZ1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuZ2V0VGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5zZXRUaW1lUmFuZ2UgPSBmdW5jdGlvbihtaW5UaW1lLCBtYXhUaW1lKSB7XHJcbiAgICB0aGlzLm1pblRpbWUgPSBtaW5UaW1lO1xyXG4gICAgdGhpcy5tYXhUaW1lID0gbWF4VGltZTtcclxuICAgIHRoaXMudGltZVJhbmdlID0gbWF4VGltZSAtIG1pblRpbWU7XHJcblxyXG4gICAgdGhpcy50aW1lSW5wdXQuc2V0QXR0cmlidXRlKCdtaW4nLCBtaW5UaW1lKTtcclxuICAgIHRoaXMudGltZUlucHV0LnNldEF0dHJpYnV0ZSgnbWF4JywgbWF4VGltZSk7XHJcbiAgICB0aGlzLnNldElucHV0VGltZShtaW5UaW1lKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuc2V0SW5wdXRUaW1lID0gZnVuY3Rpb24oaW5wdXRUaW1lKSB7XHJcbiAgICB2YXIgY2xhbXBlZFZhbHVlID0gTWF0aC5tYXgoTWF0aC5taW4oaW5wdXRUaW1lLCB0aGlzLm1heFRpbWUpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubWluVGltZSk7XHJcbiAgICB0aGlzLnRpbWVJbnB1dC52YWx1ZSA9IGNsYW1wZWRWYWx1ZTtcclxuXHJcbiAgICB0aGlzLnVwZGF0ZVRpbWVEaXNwbGF5KCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLnVwZGF0ZVRpbWVEaXNwbGF5ID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgZGF0ZVZhbHVlID0gJyc7XHJcbiAgICBpZiAodGhpcy5kYXRlRm9ybWF0ID09PSAndGltZXN0YW1wJykge1xyXG4gICAgICAgIHZhciBkYXRlID0gbmV3IERhdGUocGFyc2VGbG9hdCh0aGlzLnRpbWVJbnB1dC52YWx1ZSkpO1xyXG4gICAgICAgIGRhdGVWYWx1ZSA9IHRoaXMuZ2V0Rm9ybWF0dGVkRGF0ZShkYXRlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZGF0ZVZhbHVlID0gTWF0aC5yb3VuZChwYXJzZUZsb2F0KHRoaXMudGltZUlucHV0LnZhbHVlKSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5kYXRlQm94LnRleHRDb250ZW50ID0gZGF0ZVZhbHVlO1xyXG4gICAgdGhpcy52ckRhdGVCb3gxLnRleHRDb250ZW50ID0gZGF0ZVZhbHVlO1xyXG4gICAgdGhpcy52ckRhdGVCb3gyLnRleHRDb250ZW50ID0gZGF0ZVZhbHVlO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5nZXRGb3JtYXR0ZWREYXRlID0gZnVuY3Rpb24oZGF0ZSkge1xyXG4gICAgdmFyIHllYXIgPSBkYXRlLmdldEZ1bGxZZWFyKCk7XHJcbiAgICB2YXIgbW9udGggPSAoMSArIGRhdGUuZ2V0TW9udGgoKSkudG9TdHJpbmcoKTtcclxuICAgIG1vbnRoID0gbW9udGgubGVuZ3RoID4gMSA/IG1vbnRoIDogJzAnICsgbW9udGg7XHJcbiAgICB2YXIgZGF5ID0gZGF0ZS5nZXREYXRlKCkudG9TdHJpbmcoKTtcclxuICAgIGRheSA9IGRheS5sZW5ndGggPiAxID8gZGF5IDogJzAnICsgZGF5O1xyXG4gICAgcmV0dXJuIHllYXIgKyAnLycgKyBtb250aCArICcvJyArIGRheTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuaGFuZGxlUGxheVBhdXNlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmxvb3AgPSBmYWxzZTtcclxuICAgIHRoaXMucGF1c2VkID0gIXRoaXMucGF1c2VkO1xyXG4gICAgaWYgKHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpID49IHRoaXMubWF4VGltZSkge1xyXG4gICAgICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLnNldElucHV0VGltZSh0aGlzLm1pblRpbWUpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5wbGF5UGF1c2UudmFsdWUgPSB0aGlzLnBhdXNlZCA/ICdQbGF5JyA6ICdQYXVzZSc7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmhhbmRsZUVudGVyVlIgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY2hyb25vZ3JhcGhlci5lbnRlclZSKCk7XHJcblxyXG4gICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcclxuICAgIHRoaXMubG9vcCA9IHRydWU7XHJcblxyXG4gICAgdGhpcy5jb250cm9scy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgdGhpcy52ckNvbnRyb2xzLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuaGFuZGxlTGVhdmVWUiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5jaHJvbm9ncmFwaGVyLmxlYXZlVlIoKTtcclxuXHJcbiAgICB0aGlzLnBhdXNlZCA9IHRydWU7XHJcbiAgICB0aGlzLmxvb3AgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLmNvbnRyb2xzLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcclxuICAgIHRoaXMudnJDb250cm9scy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5mdWxsc2NyZWVuQ2hhbmdlSGFuZGxlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGZ1bGxzY3JlZW4gPSAoZG9jdW1lbnQud2Via2l0SXNGdWxsU2NyZWVuIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5tb3pGdWxsU2NyZWVuIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5tc0Z1bGxzY3JlZW5FbGVtZW50KTtcclxuXHJcbiAgICBpZiAoIWZ1bGxzY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmhhbmRsZUxlYXZlVlIoKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZHQpIHtcclxuICAgIGlmICghdGhpcy5wYXVzZWQpIHtcclxuICAgICAgICAvLyBTY2FsZSBkdCB0byBjb3ZlciB0aGlzLnRpbWVSYW5nZSBvdmVyIHRoaXMudG90YWxQbGF5dGltZS5cclxuICAgICAgICB2YXIgZGVsdGFUaW1lID0gdGhpcy50aW1lUmFuZ2UgLyB0aGlzLnRvdGFsUGxheVRpbWUgKiBkdDtcclxuICAgICAgICB2YXIgbmV3VGltZSA9IHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpICsgZGVsdGFUaW1lO1xyXG4gICAgICAgIHRoaXMuc2V0SW5wdXRUaW1lKG5ld1RpbWUpO1xyXG5cclxuICAgICAgICAvLyBFbmQgb2YgdGltZSByYW5nZT8gTG9vcCBiYWNrIHRvIHRoZSBzdGFydCBvciBwYXVzZS5cclxuICAgICAgICBpZiAobmV3VGltZSA+PSB0aGlzLm1heFRpbWUpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMubG9vcCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRJbnB1dFRpbWUodGhpcy5taW5UaW1lKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENocm9ub0NvbnRyb2xzO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgY2hyb25vZGF0YVZlcnRleFNoYWRlciA9IHJlcXVpcmUoJy4vc2hhZGVycy9jaHJvbm9kYXRhVmVydGV4Jyk7XHJcbnZhciBjaHJvbm9kYXRhRnJhZ21lbnRTaGFkZXIgPSByZXF1aXJlKCcuL3NoYWRlcnMvY2hyb25vZGF0YUZyYWdtZW50Jyk7XHJcblxyXG5cclxudmFyIENocm9ub0RhdGEgPSBmdW5jdGlvbihkYXRhVVJMLCByYWRpdXMsIG9wdHMpIHtcclxuICAgIHRoaXMucmFkaXVzID0gcmFkaXVzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRUZXh0KHVybCkge1xyXG4gICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsIHVybCwgZmFsc2UpOyAvLyBTeW5jaHJvbm91cy5cclxuICAgICAgcmVxdWVzdC5vdmVycmlkZU1pbWVUeXBlKCd0ZXh0L3BsYWluJyk7XHJcbiAgICAgIHJlcXVlc3Quc2VuZCgpO1xyXG5cclxuICAgICAgcmV0dXJuIHJlcXVlc3QucmVzcG9uc2VUZXh0O1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZGF0YSA9IFtdO1xyXG4gICAgdmFyIHRpbWVzID0gW107XHJcbiAgICB0aGlzLmdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XHJcbiAgICB0aGlzLm1pblRpbWUgPSBOdW1iZXIuTUFYX1ZBTFVFO1xyXG4gICAgdGhpcy5tYXhUaW1lID0gMDtcclxuXHJcbiAgICAvLyBMb2FkIGRhdGEgZnJvbSBhIGpzb24gZmlsZS5cclxuICAgIHZhciBqc29uRGF0YSA9IEpTT04ucGFyc2UobG9hZFRleHQoZGF0YVVSTCkpO1xyXG4gICAgdmFyIGxvY2F0aW9ucyA9IGpzb25EYXRhLmxvY2F0aW9ucztcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2F0aW9ucy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgIHZhciB0aW1lc3RhbXBNcyA9IHBhcnNlRmxvYXQobG9jYXRpb25zW2ldLnRpbWVzdGFtcE1zKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uc1tpXS5ZZWFyO1xyXG5cclxuICAgICAgICB0aGlzLm1pblRpbWUgPSBNYXRoLm1pbih0aW1lc3RhbXBNcywgdGhpcy5taW5UaW1lKTtcclxuICAgICAgICB0aGlzLm1heFRpbWUgPSBNYXRoLm1heCh0aW1lc3RhbXBNcywgdGhpcy5tYXhUaW1lKTtcclxuXHJcbiAgICAgICAgdmFyIGxhdGl0dWRlID0gbG9jYXRpb25zW2ldLmxhdGl0dWRlRTcgLyAxMDAwMDAwMC4wIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgbG9jYXRpb25zW2ldLkxhdGl0dWRlO1xyXG4gICAgICAgIHZhciBsb25naXR1ZGUgPSBsb2NhdGlvbnNbaV0ubG9uZ2l0dWRlRTcgLyAxMDAwMDAwMC4wIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uc1tpXS5Mb25naXR1ZGU7XHJcblxyXG4gICAgICAgIHZhciBkZWcycmFkID0gTWF0aC5QSSAvIDE4MC4wO1xyXG4gICAgICAgIHZhciBwaGkgPSBsYXRpdHVkZSAqIGRlZzJyYWQ7XHJcbiAgICAgICAgdmFyIHRoZXRhID0gKDE4MCAtIGxvbmdpdHVkZSkgKiBkZWcycmFkO1xyXG5cclxuICAgICAgICB2YXIgeCA9ICh0aGlzLnJhZGl1cyAqIDEuMDEpICogTWF0aC5jb3MocGhpKSAqIE1hdGguY29zKHRoZXRhKTtcclxuICAgICAgICB2YXIgeSA9ICh0aGlzLnJhZGl1cyAqIDEuMDEpICogTWF0aC5zaW4ocGhpKTtcclxuICAgICAgICB2YXIgeiA9ICh0aGlzLnJhZGl1cyAqIDEuMDEpICogTWF0aC5jb3MocGhpKSAqIE1hdGguc2luKHRoZXRhKTtcclxuXHJcbiAgICAgICAgdGhpcy5kYXRhLnB1c2goe1xyXG4gICAgICAgICAgJ2xhdCc6IGxhdGl0dWRlLFxyXG4gICAgICAgICAgJ2xvbmcnOiBsb25naXR1ZGUsXHJcbiAgICAgICAgICAncG9zaXRpb24nOiBbeCwgeSwgel0sXHJcbiAgICAgICAgICAndGltZSc6IHRpbWVzdGFtcE1zXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGltZXMucHVzaCh0aW1lc3RhbXBNcyk7XHJcblxyXG4gICAgICAgIHRoaXMuZ2VvbWV0cnkudmVydGljZXMucHVzaChuZXcgVEhSRUUuVmVjdG9yMyh4LCB5LCB6KSk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGF0dHJpYnV0ZXMgPSB7XHJcbiAgICAgIHBvaW50VGltZTogeyB0eXBlOiAnZicsIHZhbHVlOiB0aW1lcyB9XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciB1bmlmb3JtcyA9IHtcclxuICAgICAgcGFydGljbGVUZXh0dXJlOiB7XHJcbiAgICAgICAgdHlwZTogJ3QnLFxyXG4gICAgICAgIHZhbHVlOiBUSFJFRS5JbWFnZVV0aWxzLmxvYWRUZXh0dXJlKCdpbWFnZXMvY2lyY2xlX2FscGhhLnBuZycpXHJcbiAgICAgIH0sXHJcbiAgICAgIHZpc3VhbGl6YXRpb25UaW1lOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiB0aGlzLm1pblRpbWVcclxuICAgICAgfSxcclxuICAgICAgbWluVGltZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogdGhpcy5taW5UaW1lXHJcbiAgICAgIH0sXHJcbiAgICAgIG1heFRpbWU6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IHRoaXMubWF4VGltZVxyXG4gICAgICB9LFxyXG4gICAgICBwZXJjZW50SGlnaGxpZ2h0UmFuZ2U6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMucGVyY2VudEhpZ2hsaWdodFJhbmdlKSB8fCAwLjEwXHJcbiAgICAgIH0sXHJcbiAgICAgIG1pbkFscGhhOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLm1pbkFscGhhKSB8fCAxLjBcclxuICAgICAgfSxcclxuICAgICAgbWF4QWxwaGE6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWF4QWxwaGEpIHx8IDEuMFxyXG4gICAgICB9LFxyXG4gICAgICBtaW5Db2xvcjoge1xyXG4gICAgICAgIHR5cGU6ICdjJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5taW5Db2xvcikgfHwgbmV3IFRIUkVFLkNvbG9yKDB4MjIyMjIyKVxyXG4gICAgICB9LFxyXG4gICAgICBtYXhDb2xvcjoge1xyXG4gICAgICAgIHR5cGU6ICdjJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5tYXhDb2xvcikgfHwgbmV3IFRIUkVFLkNvbG9yKDB4RUVFRUVFKVxyXG4gICAgICB9LFxyXG4gICAgICBtaW5TaXplOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLm1pblNpemUpIHx8IDEyLjBcclxuICAgICAgfSxcclxuICAgICAgbWF4U2l6ZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5tYXhTaXplKSB8fCAzMi4wXHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCh7XHJcbiAgICAgIGF0dHJpYnV0ZXM6ICAgICBhdHRyaWJ1dGVzLFxyXG4gICAgICB1bmlmb3JtczogICAgICAgdW5pZm9ybXMsXHJcbiAgICAgIHZlcnRleFNoYWRlcjogICBjaHJvbm9kYXRhVmVydGV4U2hhZGVyLFxyXG4gICAgICBmcmFnbWVudFNoYWRlcjogY2hyb25vZGF0YUZyYWdtZW50U2hhZGVyLFxyXG4gICAgICB0cmFuc3BhcmVudDogICAgdHJ1ZSxcclxuICAgICAgYmxlbmRpbmc6ICAgICAgIFRIUkVFLk5vcm1hbEJsZW5kaW5nLFxyXG4gICAgICBkZXB0aFdyaXRlOiAgICAgZmFsc2VcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMucGFydGljbGVzID0gbmV3IFRIUkVFLlBvaW50Q2xvdWQodGhpcy5nZW9tZXRyeSwgdGhpcy5tYXRlcmlhbCk7XHJcbiAgICAvLyBwYXJ0aWNsZXMuc29ydFBhcnRpY2xlcyA9IHRydWU7XHJcblxyXG4gICAgZnVuY3Rpb24gY29tcGFyZShhLCBiKSB7XHJcbiAgICAgICAgaWYgKGEudGltZSA8IGIudGltZSkgeyByZXR1cm4gLTE7IH1cclxuICAgICAgICBpZiAoYS50aW1lID4gYi50aW1lKSB7IHJldHVybiAxOyB9XHJcbiAgICAgICAgcmV0dXJuIDA7XHJcbiAgICB9XHJcbiAgICB0aGlzLmRhdGEuc29ydChjb21wYXJlKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5zZXRTY2VuZSA9IGZ1bmN0aW9uKHNjZW5lKSB7XHJcbiAgICB0aGlzLnNjZW5lID0gc2NlbmU7XHJcbiAgICBzY2VuZS5hZGQodGhpcy5wYXJ0aWNsZXMpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5zZXRUaW1lID0gZnVuY3Rpb24obmV3VGltZSkge1xyXG4gICAgdGhpcy5jdXJyZW50VGltZSA9IG5ld1RpbWU7XHJcbiAgICB0aGlzLm1hdGVyaWFsLnVuaWZvcm1zWyd2aXN1YWxpemF0aW9uVGltZSddLnZhbHVlID0gbmV3VGltZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5nZXRDdXJyZW50VGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRpbWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuZ2V0TWluVGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMubWluVGltZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5nZXRNYXhUaW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5tYXhUaW1lO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLmdldERhdGEgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGE7XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDaHJvbm9EYXRhO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgQ2hyb25vRGF0YSA9IHJlcXVpcmUoJy4vQ2hyb25vRGF0YScpO1xyXG52YXIgQ2hyb25vQ29udHJvbHMgPSByZXF1aXJlKCcuL0Nocm9ub0NvbnRyb2xzJyk7XHJcbnZhciBEZXZpY2VPcmJpdENvbnRyb2xzID0gcmVxdWlyZSgnLi9EZXZpY2VPcmJpdENvbnRyb2xzJyk7XHJcbnZhciBFYXJ0aCA9IHJlcXVpcmUoJy4vRWFydGgnKTtcclxudmFyIEZvbGxvd0xpbmUgPSByZXF1aXJlKCcuL0ZvbGxvd0xpbmUnKTtcclxuXHJcblxyXG52YXIgQ2hyb25vZ3JhcGhlciA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgZGF0YSwgb3B0cykge1xyXG4gICAgaWYgKCFEZXRlY3Rvci53ZWJnbCkgeyBEZXRlY3Rvci5hZGRHZXRXZWJHTE1lc3NhZ2UoKTsgfVxyXG5cclxuICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xyXG4gICAgdGhpcy53aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xyXG4gICAgdGhpcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcbiAgICB0aGlzLnJhZGl1cyA9IDEwMDA7XHJcblxyXG4gICAgdGhpcy52ciA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMuc2V0dXBSZW5kZXJlcigpO1xyXG4gICAgdGhpcy5zZXR1cFNjZW5lKCk7XHJcblxyXG4gICAgdGhpcy5jaHJvbm9EYXRhID0gbmV3IENocm9ub0RhdGEoZGF0YSwgdGhpcy5yYWRpdXMsIG9wdHMpO1xyXG4gICAgdGhpcy5jaHJvbm9EYXRhLnNldFNjZW5lKHRoaXMuc2NlbmUpO1xyXG4gICAgdmFyIG1pblRpbWUgPSB0aGlzLmNocm9ub0RhdGEuZ2V0TWluVGltZSgpO1xyXG4gICAgdmFyIG1heFRpbWUgPSB0aGlzLmNocm9ub0RhdGEuZ2V0TWF4VGltZSgpO1xyXG5cclxuICAgIHRoaXMuY2hyb25vQ29udHJvbHMgPSBuZXcgQ2hyb25vQ29udHJvbHModGhpcywgY29udGFpbmVyLCBvcHRzKTtcclxuICAgIHRoaXMuY2hyb25vQ29udHJvbHMuc2V0VGltZVJhbmdlKG1pblRpbWUsIG1heFRpbWUpO1xyXG5cclxuICAgIHRoaXMuZWFydGggPSBuZXcgRWFydGgodGhpcy5yYWRpdXMpO1xyXG4gICAgdGhpcy5lYXJ0aC5zZXRTY2VuZSh0aGlzLnNjZW5lKTtcclxuXHJcbiAgICBpZiAob3B0cy5mb2xsb3dMaW5lKSB7XHJcbiAgICAgICAgdGhpcy5mb2xsb3dMaW5lID0gbmV3IEZvbGxvd0xpbmUodGhpcy5jaHJvbm9EYXRhLCB0aGlzLnJhZGl1cyk7XHJcbiAgICAgICAgdGhpcy5mb2xsb3dMaW5lLnNldFNjZW5lKHRoaXMuc2NlbmUpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnNldHVwUmVuZGVyZXIgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMucmVuZGVyZXIgPSBuZXcgVEhSRUUuV2ViR0xSZW5kZXJlcih7YWxwaGE6IHRydWUsIGFudGlhbGlhczogdHJ1ZX0pO1xyXG4gICAgdGhpcy5yZW5kZXJlci5zZXRTaXplKHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQpO1xyXG4gICAgdGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5yZW5kZXJlci5kb21FbGVtZW50KTtcclxuICAgIHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5pZCA9ICdjZ3ItY2hyb25vRGF0YSc7XHJcblxyXG4gICAgdGhpcy5lZmZlY3QgPSBuZXcgVEhSRUUuU3RlcmVvRWZmZWN0KHRoaXMucmVuZGVyZXIpO1xyXG4gICAgdGhpcy5lZmZlY3Quc2V0U2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUub25XaW5kb3dSZXNpemUgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcclxuICAgIHRoaXMuaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xyXG5cclxuICAgIHRoaXMuY2FtZXJhLmFzcGVjdCA9IHRoaXMud2lkdGggLyB0aGlzLmhlaWdodDtcclxuICAgIHRoaXMuY2FtZXJhLnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKTtcclxuXHJcbiAgICB0aGlzLnJlbmRlcmVyLnNldFNpemUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xyXG4gICAgdGhpcy5lZmZlY3Quc2V0U2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUuc2V0T3JpZW50YXRpb25Db250cm9scyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5jb250cm9scyA9IG5ldyBEZXZpY2VPcmJpdENvbnRyb2xzKHRoaXMuY2FtZXJhLCB0aGlzLnJhZGl1cyAqIDIuMCk7XHJcblxyXG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RldmljZW9yaWVudGF0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0T3JpZW50YXRpb25Db250cm9scyk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUuZW50ZXJWUiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5mdWxsc2NyZWVuKCk7XHJcblxyXG4gICAgdGhpcy52ciA9IHRydWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUubGVhdmVWUiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy52ciA9IGZhbHNlO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLmZ1bGxzY3JlZW4gPSBmdW5jdGlvbigpIHtcclxuICAgIGlmICh0aGlzLmNvbnRhaW5lci5yZXF1ZXN0RnVsbHNjcmVlbikge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLnJlcXVlc3RGdWxsc2NyZWVuKCk7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29udGFpbmVyLm1zUmVxdWVzdEZ1bGxzY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lci5tc1JlcXVlc3RGdWxsc2NyZWVuKCk7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29udGFpbmVyLm1velJlcXVlc3RGdWxsU2NyZWVuKSB7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIubW96UmVxdWVzdEZ1bGxTY3JlZW4oKTtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5jb250YWluZXIud2Via2l0UmVxdWVzdEZ1bGxzY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lci53ZWJraXRSZXF1ZXN0RnVsbHNjcmVlbigpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB0YXJnZXRPcmllbnRhdGlvbiA9IFsnbGFuZHNjYXBlLXByaW1hcnknXTtcclxuICAgIGlmIChzY3JlZW4ubG9ja09yaWVudGF0aW9uKSB7XHJcbiAgICAgICAgc2NyZWVuLmxvY2tPcmllbnRhdGlvbih0YXJnZXRPcmllbnRhdGlvbik7XHJcbiAgICB9IGVsc2UgaWYgKHNjcmVlbi5tb3pMb2NrT3JpZW50YXRpb24pIHtcclxuICAgICAgICBzY3JlZW4ubW96TG9ja09yaWVudGF0aW9uKHRhcmdldE9yaWVudGF0aW9uKTtcclxuICAgIH0gZWxzZSBpZiAoc2NyZWVuLm1zTG9ja09yaWVudGF0aW9uKSB7XHJcbiAgICAgICAgc2NyZWVuLm1zTG9ja09yaWVudGF0aW9uKHRhcmdldE9yaWVudGF0aW9uKTtcclxuICAgIH0gZWxzZSBpZiAoc2NyZWVuLm9yaWVudGF0aW9uLmxvY2spIHtcclxuICAgICAgICBzY3JlZW4ub3JpZW50YXRpb24ubG9jayh0YXJnZXRPcmllbnRhdGlvbik7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUuc2V0dXBTY2VuZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xyXG5cclxuICAgIHRoaXMuY2FtZXJhID0gbmV3IFRIUkVFLlBlcnNwZWN0aXZlQ2FtZXJhKDc1LFxyXG4gICAgICB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgMSwgMzAwMDApO1xyXG4gICAgdGhpcy5jYW1lcmEucG9zaXRpb24ueiA9IC0odGhpcy5yYWRpdXMgKiAxLjUpO1xyXG4gICAgdGhpcy5jYW1lcmEucG9zaXRpb24ueSA9IHRoaXMucmFkaXVzICogMS4yO1xyXG4gICAgdGhpcy5jYW1lcmEubG9va0F0KHRoaXMuc2NlbmUucG9zaXRpb24pO1xyXG5cclxuICAgIHRoaXMuY29udHJvbHMgPSBuZXcgVEhSRUUuT3JiaXRDb250cm9scyh0aGlzLmNhbWVyYSxcclxuICAgICAgdGhpcy5yZW5kZXJlci5kb21FbGVtZW50KTtcclxuICAgIHRoaXMuY29udHJvbHMuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XHJcbiAgICB0aGlzLmNvbnRyb2xzLm5vUGFuID0gdHJ1ZTtcclxuICAgIHRoaXMuY29udHJvbHMucm90YXRlU3BlZWQgPSAwLjU7XHJcblxyXG4gICAgdmFyIGFtYmllbnRMaWdodCA9IG5ldyBUSFJFRS5BbWJpZW50TGlnaHQoMHg4ODg4ODgpO1xyXG4gICAgdGhpcy5zY2VuZS5hZGQoYW1iaWVudExpZ2h0KTtcclxuXHJcbiAgICB2YXIgZGlyTGlnaHQgPSBuZXcgVEhSRUUuRGlyZWN0aW9uYWxMaWdodCgweGNjY2NjYywgMC4yKTtcclxuICAgIGRpckxpZ2h0LnBvc2l0aW9uLnNldCg1LCAzLCA1KTtcclxuICAgIHRoaXMuc2NlbmUuYWRkKGRpckxpZ2h0KTtcclxuXHJcbiAgICB0aGlzLmNsb2NrID0gbmV3IFRIUkVFLkNsb2NrKCk7XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHRoaXMub25XaW5kb3dSZXNpemUuYmluZCh0aGlzKSwgZmFsc2UpO1xyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZW9yaWVudGF0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0T3JpZW50YXRpb25Db250cm9scy5iaW5kKHRoaXMpLCBmYWxzZSk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgZHQgPSB0aGlzLmNsb2NrLmdldERlbHRhKCk7XHJcblxyXG4gICAgdGhpcy5jaHJvbm9Db250cm9scy51cGRhdGUoZHQpO1xyXG4gICAgdGhpcy5jaHJvbm9EYXRhLnNldFRpbWUodGhpcy5jaHJvbm9Db250cm9scy5nZXRUaW1lKCkpO1xyXG5cclxuICAgIHRoaXMuY2hyb25vRGF0YS51cGRhdGUoZHQpO1xyXG4gICAgaWYgKHRoaXMuZm9sbG93TGluZSkge1xyXG4gICAgICAgIHRoaXMuZm9sbG93TGluZS51cGRhdGUoZHQpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY29udHJvbHMudXBkYXRlKGR0KTtcclxuICAgIHRoaXMucmVuZGVyKCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnJlbmRlcmVyLmNsZWFyKCk7XHJcblxyXG4gICAgaWYgKHRoaXMudnIpIHtcclxuICAgICAgICB0aGlzLmVmZmVjdC5yZW5kZXIodGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLnJlbmRlcmVyLnJlbmRlcih0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDaHJvbm9ncmFwaGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRGV2aWNlT3JiaXRDb250cm9scyA9IGZ1bmN0aW9uKGNhbWVyYSwgcmFkaXVzKSB7XHJcbiAgICB0aGlzLmNhbWVyYSA9IGNhbWVyYTtcclxuICAgIHRoaXMucmFkaXVzID0gcmFkaXVzO1xyXG5cclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VvcmllbnRhdGlvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRPcmllbnRhdGlvbi5iaW5kKHRoaXMpLCBmYWxzZSk7XHJcbn07XHJcblxyXG5cclxuRGV2aWNlT3JiaXRDb250cm9scy5wcm90b3R5cGUuc2V0T3JpZW50YXRpb24gPSBmdW5jdGlvbihldmVudCkge1xyXG4gICAgdmFyIGRlZzJyYWQgPSBNYXRoLlBJIC8gMTgwLjA7XHJcbiAgICB2YXIgYWxwaGEgPSAtKChldmVudC5hbHBoYSkgKiBkZWcycmFkKTtcclxuICAgIHZhciBnYW1tYSA9ICAoKGV2ZW50LmdhbW1hICsgOTApICogZGVnMnJhZCk7XHJcblxyXG4gICAgdmFyIHggPSB0aGlzLnJhZGl1cyAqIE1hdGguY29zKGdhbW1hKSAqIE1hdGguY29zKGFscGhhKTtcclxuICAgIHZhciB5ID0gdGhpcy5yYWRpdXMgKiBNYXRoLnNpbihnYW1tYSk7XHJcbiAgICB2YXIgeiA9IHRoaXMucmFkaXVzICogTWF0aC5jb3MoZ2FtbWEpICogTWF0aC5zaW4oYWxwaGEpO1xyXG5cclxuICAgIHRoaXMuY2FtZXJhLnBvc2l0aW9uLnNldCh4LCB5LCB6KTtcclxuICAgIHRoaXMuY2FtZXJhLmxvb2tBdChuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMCwgMC4wKSk7XHJcbn07XHJcblxyXG5cclxuRGV2aWNlT3JiaXRDb250cm9scy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcblxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRGV2aWNlT3JiaXRDb250cm9scztcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEVhcnRoID0gZnVuY3Rpb24ocmFkaXVzKSB7XHJcbiAgICB2YXIgZWFydGhHZW9tZXRyeSA9IG5ldyBUSFJFRS5TcGhlcmVHZW9tZXRyeShyYWRpdXMsIDgwLCA2MCk7XHJcbiAgICB2YXIgZWFydGhNYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoUGhvbmdNYXRlcmlhbCh7XHJcbiAgICAgIG1hcDogdGhpcy5sb2FkVGV4dHVyZSgnZWFydGhfZGlmZnVzZV80ay5qcGcnKVxyXG4gICAgICAvLyBtYXA6IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX2RpZmZ1c2VfbmlnaHRfNGsuanBnJylcclxuICAgIH0pO1xyXG5cclxuICAgIGVhcnRoTWF0ZXJpYWwuYnVtcE1hcCA9IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX2J1bXBfMmsuanBnJyk7XHJcbiAgICBlYXJ0aE1hdGVyaWFsLmJ1bXBTY2FsZSA9IHJhZGl1cyAvIDIuMDtcclxuICAgIGVhcnRoTWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSB0aGlzLmxvYWRUZXh0dXJlKCdlYXJ0aF9zcGVjdWxhcl8yay5qcGcnKTtcclxuICAgIGVhcnRoTWF0ZXJpYWwuc3BlY3VsYXIgPSBuZXcgVEhSRUUuQ29sb3IoMHgzQTNBM0EpO1xyXG5cclxuICAgIHRoaXMuZWFydGhNZXNoID0gbmV3IFRIUkVFLk1lc2goZWFydGhHZW9tZXRyeSwgZWFydGhNYXRlcmlhbCk7XHJcbiAgICB0aGlzLmVhcnRoTWVzaC5yb3RhdGlvbi55ID0gTWF0aC5QSTtcclxuXHJcbiAgICB2YXIgYm91bmRhcmllc01hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtcclxuICAgICAgbWFwOiB0aGlzLmxvYWRUZXh0dXJlKCdlYXJ0aF9ib3VuZGFyaWVzXzJrLnBuZycpLFxyXG4gICAgICB0cmFuc3BhcmVudDogdHJ1ZSxcclxuICAgICAgb3BhY2l0eTogMC41XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmJvdW5kYXJpZXNNZXNoID0gbmV3IFRIUkVFLk1lc2goZWFydGhHZW9tZXRyeSwgYm91bmRhcmllc01hdGVyaWFsKTtcclxuICAgIHRoaXMuYm91bmRhcmllc01lc2gucm90YXRpb24ueSA9IE1hdGguUEk7XHJcbn07XHJcblxyXG5cclxuRWFydGgucHJvdG90eXBlLnNldFNjZW5lID0gZnVuY3Rpb24oc2NlbmUpIHtcclxuICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcclxuICAgIHNjZW5lLmFkZCh0aGlzLmVhcnRoTWVzaCk7XHJcbiAgICBzY2VuZS5hZGQodGhpcy5ib3VuZGFyaWVzTWVzaCk7XHJcbn07XHJcblxyXG5cclxuRWFydGgucHJvdG90eXBlLmxvYWRUZXh0dXJlID0gZnVuY3Rpb24odGV4dHVyZU5hbWUpIHtcclxuICAvLyBUT0RPOiBjdXN0b21pemUgcGF0aCBvciBpbWFnZXMsIHRoaXMgcmVsYXRpdmUgcGF0aCBpcyBuYXN0eS5cclxuICAgIHJldHVybiBUSFJFRS5JbWFnZVV0aWxzLmxvYWRUZXh0dXJlKCcuLi8uLi9kaXN0L2ltYWdlcy8nICsgdGV4dHVyZU5hbWUpO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRWFydGg7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBGb2xsb3dMaW5lID0gZnVuY3Rpb24oY2hyb25vRGF0YSwgcmFkaXVzKSB7XHJcbiAgICB0aGlzLmNocm9ub0RhdGEgPSBjaHJvbm9EYXRhO1xyXG4gICAgdGhpcy5yYWRpdXMgPSByYWRpdXM7XHJcbiAgICB0aGlzLm1heFBvaW50cyA9IDEwMDA7XHJcblxyXG4gICAgdGhpcy5jdXJ2ZSA9IG5ldyBUSFJFRS5TcGxpbmVDdXJ2ZTMoW1xyXG4gICAgICBuZXcgVEhSRUUuVmVjdG9yMygwLDAsMCksXHJcbiAgICAgIG5ldyBUSFJFRS5WZWN0b3IzKDAsMCwwKVxyXG4gICAgXSk7XHJcblxyXG4gICAgdGhpcy5jdXJ2ZVBvaW50cyA9IFtdO1xyXG5cclxuICAgIHRoaXMuY3VydmVHZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xyXG4gICAgdGhpcy5jdXJ2ZUdlb21ldHJ5LnZlcnRpY2VzID0gdGhpcy5jdXJ2ZS5nZXRQb2ludHMoMjAwKTtcclxuXHJcbiAgICB0aGlzLmN1cnZlTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoIHsgY29sb3I6IDB4Y2NjY2NjIH0gKTtcclxuXHJcbiAgICB0aGlzLmxpbmUgPSBuZXcgVEhSRUUuTGluZSh0aGlzLmN1cnZlR2VvbWV0cnksIHRoaXMuY3VydmVNYXRlcmlhbCk7XHJcblxyXG4gICAgdGhpcy5kYXRhID0gY2hyb25vRGF0YS5nZXREYXRhKCk7XHJcbiAgICB0aGlzLmxhc3RUaW1lID0gY2hyb25vRGF0YS5nZXRNaW5UaW1lKCk7XHJcbiAgICB0aGlzLmN1cnJlbnREYXRhSW5kZXggPSAwO1xyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLnNldFNjZW5lID0gZnVuY3Rpb24oc2NlbmUpIHtcclxuICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcclxuICAgIHNjZW5lLmFkZCh0aGlzLmxpbmUpO1xyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGN1cnJlbnRUaW1lID0gdGhpcy5jaHJvbm9EYXRhLmdldEN1cnJlbnRUaW1lKCk7XHJcblxyXG4gICAgaWYgKGN1cnJlbnRUaW1lIDwgdGhpcy5sYXN0VGltZSkge1xyXG4gICAgICAgIHRoaXMucmVzZXQoY3VycmVudFRpbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHdoaWxlIChjdXJyZW50VGltZSA+IHRoaXMuZGF0YVt0aGlzLmN1cnJlbnREYXRhSW5kZXhdLnRpbWUpIHtcclxuICAgICAgICB0aGlzLmN1cnJlbnREYXRhSW5kZXgrKztcclxuICAgICAgICB0aGlzLmFkZFBvaW50KCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5sYXN0VGltZSA9IGN1cnJlbnRUaW1lO1xyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oY3VycmVudFRpbWUpIHtcclxuICAgIHRoaXMuY3VydmVQb2ludHMgPSBbXTtcclxuICAgIHRoaXMuY3VycmVudERhdGFJbmRleCA9IDA7XHJcblxyXG4gICAgd2hpbGUgKGN1cnJlbnRUaW1lID4gdGhpcy5kYXRhW3RoaXMuY3VycmVudERhdGFJbmRleF0udGltZSkge1xyXG4gICAgICAgIHRoaXMuY3VycmVudERhdGFJbmRleCsrO1xyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLmFkZFBvaW50ID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgbmV4dFBvc2l0aW9uID0gdGhpcy5kYXRhW3RoaXMuY3VycmVudERhdGFJbmRleF0ucG9zaXRpb247XHJcbiAgICB0aGlzLmN1cnZlUG9pbnRzLnB1c2gobmV3IFRIUkVFLlZlY3RvcjMobmV4dFBvc2l0aW9uWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRQb3NpdGlvblsxXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXh0UG9zaXRpb25bMl0pKTtcclxuICAgIGlmICh0aGlzLmN1cnZlUG9pbnRzLmxlbmd0aCA+IHRoaXMubWF4UG9pbnRzKSB7XHJcbiAgICAgICAgdGhpcy5jdXJ2ZVBvaW50cy5zaGlmdCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY3VydmUgPSBuZXcgVEhSRUUuU3BsaW5lQ3VydmUzKHRoaXMuY3VydmVQb2ludHMpO1xyXG5cclxuICAgIHRoaXMuY3VydmVHZW9tZXRyeS52ZXJ0aWNlcyA9IHRoaXMuY3VydmUuZ2V0UG9pbnRzKHRoaXMubWF4UG9pbnRzICogMyk7XHJcbiAgICB0aGlzLmxpbmUuZ2VvbWV0cnkudmVydGljZXNOZWVkVXBkYXRlID0gdHJ1ZTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEZvbGxvd0xpbmU7XHJcbiIsIi8vIEVudHJ5IHBvaW50IGZvciBidWlsZGluZy5cclxuXHJcbnZhciBDaHJvbm9ncmFwaGVyID0gcmVxdWlyZSgnLi9DaHJvbm9ncmFwaGVyJyk7XHJcblxyXG53aW5kb3cuQ2hyb25vZ3JhcGhlciA9IENocm9ub2dyYXBoZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBjaHJvbm9kYXRhRnJhZ21lbnQgPSAnJyArXHJcbiAgICAndW5pZm9ybSBzYW1wbGVyMkQgcGFydGljbGVUZXh0dXJlOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndmFyeWluZyBmbG9hdCB0OyBcXG4nICtcclxuICAgICd2YXJ5aW5nIHZlYzMgdGltZUNvbG9yOyBcXG4nICtcclxuICAgICd2YXJ5aW5nIGZsb2F0IHRpbWVBbHBoYTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3ZvaWQgbWFpbigpIHsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHRleHR1cmVBbHBoYSA9IHRleHR1cmUyRChwYXJ0aWNsZVRleHR1cmUsIGdsX1BvaW50Q29vcmQpLmE7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBhbHBoYSA9IHRleHR1cmVBbHBoYSAqIHRpbWVBbHBoYTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICB2ZWMzIGNvbG9yID0gdGltZUNvbG9yOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoY29sb3IsIGFscGhhKTsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcnO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBjaHJvbm9kYXRhRnJhZ21lbnQ7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBjaHJvbm9kYXRhVmVydGV4ID0gJycgK1xyXG4gICAgJ2F0dHJpYnV0ZSBmbG9hdCBwb2ludFRpbWU7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1pblRpbWU7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWF4VGltZTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCB2aXN1YWxpemF0aW9uVGltZTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBwZXJjZW50SGlnaGxpZ2h0UmFuZ2U7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1pbkFscGhhOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1heEFscGhhOyBcXG4nICtcclxuICAgICd1bmlmb3JtIHZlYzMgbWluQ29sb3I7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gdmVjMyBtYXhDb2xvcjsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBtaW5TaXplOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1heFNpemU7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd2YXJ5aW5nIGZsb2F0IHQ7IFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgZmxvYXQgdGltZUFscGhhOyBcXG4nICtcclxuICAgICd2YXJ5aW5nIHZlYzMgdGltZUNvbG9yOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnZmxvYXQgbGVycChmbG9hdCBtaW5WYWx1ZSwgZmxvYXQgbWF4VmFsdWUsIGZsb2F0IHQpIHsgXFxuJyArXHJcbiAgICAnICAgIHJldHVybiAobWluVmFsdWUgKiAoMS4wIC0gdCkpICsgKG1heFZhbHVlICogdCk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ2Zsb2F0IGludmVyc2VMZXJwKGZsb2F0IHZhbHVlLCBmbG9hdCBtaW5WYWx1ZSwgZmxvYXQgbWF4VmFsdWUpIHsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHZhbHVlUmFuZ2UgPSBtYXhWYWx1ZSAtIG1pblZhbHVlOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgaW52ZXJzZUxlcnBlZCA9ICh2YWx1ZSAtIG1pblZhbHVlKSAvIHZhbHVlUmFuZ2U7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBjbGFtcGVkID0gY2xhbXAoaW52ZXJzZUxlcnBlZCwgMC4wLCAxLjApOyBcXG4nICtcclxuICAgICcgICAgcmV0dXJuIGludmVyc2VMZXJwZWQ7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJy8vIFJHQiB0byBIU1YgYW5kIEhTViB0byBSR0IgXFxuJyArXHJcbiAgICAnLy8gc291cmNlOiBodHRwOi8vbG9sZW5naW5lLm5ldC9ibG9nLzIwMTMvMDcvMjcvcmdiLXRvLWhzdi1pbi1nbHNsIFxcbicgK1xyXG4gICAgJ3ZlYzMgcmdiMmhzdih2ZWMzIGMpIHsgXFxuJyArXHJcbiAgICAnICAgIHZlYzQgSyA9IHZlYzQoMC4wLCAtMS4wIC8gMy4wLCAyLjAgLyAzLjAsIC0xLjApOyBcXG4nICtcclxuICAgICcgICAgdmVjNCBwID0gYy5nIDwgYy5iID8gdmVjNChjLmJnLCBLLnd6KSA6IHZlYzQoYy5nYiwgSy54eSk7IFxcbicgK1xyXG4gICAgJyAgICB2ZWM0IHEgPSBjLnIgPCBwLnggPyB2ZWM0KHAueHl3LCBjLnIpIDogdmVjNChjLnIsIHAueXp4KTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBkID0gcS54IC0gbWluKHEudywgcS55KTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGUgPSAxLjBlLTEwOyBcXG4nICtcclxuICAgICcgICAgcmV0dXJuIHZlYzMoYWJzKHEueiArIChxLncgLSBxLnkpIC8gKDYuMCAqIGQgKyBlKSksIGQgLyAocS54ICsgZSksIHEueCk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3ZlYzMgaHN2MnJnYih2ZWMzIGMpIHsgXFxuJyArXHJcbiAgICAnICAgIHZlYzQgSyA9IHZlYzQoMS4wLCAyLjAgLyAzLjAsIDEuMCAvIDMuMCwgMy4wKTsgXFxuJyArXHJcbiAgICAnICAgIHZlYzMgcCA9IGFicyhmcmFjdChjLnh4eCArIEsueHl6KSAqIDYuMCAtIEsud3d3KTsgXFxuJyArXHJcbiAgICAnICAgIHJldHVybiBjLnogKiBtaXgoSy54eHgsIGNsYW1wKHAgLSBLLnh4eCwgMC4wLCAxLjApLCBjLnkpOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndm9pZCBtYWluKCkgeyBcXG4nICtcclxuICAgICcgICAgdmVjNCBtdlBvc2l0aW9uID0gdmlld01hdHJpeCAqIHZlYzQocG9zaXRpb24sIDEuMCk7IFxcbicgK1xyXG4gICAgJyAgICBnbF9Qb3NpdGlvbiA9IHByb2plY3Rpb25NYXRyaXggKiBtdlBvc2l0aW9uOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHZlcnRleFBlcmNlbnQgPSBpbnZlcnNlTGVycChwb2ludFRpbWUsIG1pblRpbWUsIG1heFRpbWUpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdmlzUGVyY2VudCA9IGludmVyc2VMZXJwKHZpc3VhbGl6YXRpb25UaW1lLCBtaW5UaW1lLCBtYXhUaW1lKTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHBlcmNlbnREaWZmZXJlbmNlID0gYWJzKHZlcnRleFBlcmNlbnQgLSB2aXNQZXJjZW50KTsgXFxuJyArXHJcbiAgICAnICAgIC8vIFNjYWxlIGRpZmZlcmVuY2UgYmFzZWQgb24gaGlnaGxpZ2h0IHJhbmdlIGludG8gYW4gaW50ZXJwb2xhdGlvbiB0aW1lLiBcXG4nICtcclxuICAgICcgICAgdCA9IGNsYW1wKDEuMCAtIHBlcmNlbnREaWZmZXJlbmNlIC8gcGVyY2VudEhpZ2hsaWdodFJhbmdlLCAwLjAsIDEuMCk7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgZ2xfUG9pbnRTaXplID0gbGVycChtaW5TaXplLCBtYXhTaXplLCB0KTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICB0aW1lQWxwaGEgPSBsZXJwKG1pbkFscGhhLCBtYXhBbHBoYSwgdCk7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgdmVjMyBtaW5IU1YgPSByZ2IyaHN2KG1pbkNvbG9yKTsgXFxuJyArXHJcbiAgICAnICAgIHZlYzMgbWF4SFNWID0gcmdiMmhzdihtYXhDb2xvcik7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBoID0gbGVycChtaW5IU1YueCwgbWF4SFNWLngsIHQpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgcyA9IGxlcnAobWluSFNWLnksIG1heEhTVi55LCB0KTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHYgPSBsZXJwKG1pbkhTVi56LCBtYXhIU1YueiwgdCk7IFxcbicgK1xyXG4gICAgJyAgICB0aW1lQ29sb3IgPSBoc3YycmdiKHZlYzMoaCwgcywgdikpOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGNocm9ub2RhdGFWZXJ0ZXg7XHJcbiJdfQ==
