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
    this.timeInput.addEventListener('input', this.manualUpdateTime.bind(this),
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


ChronoControls.prototype.manualUpdateTime = function() {
    this.setPaused(true);
    this.updateTimeDisplay();
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
    this.setPaused(!this.paused);
    if (parseFloat(this.timeInput.value) >= this.maxTime) {
        this.setPaused(true);
        this.setInputTime(this.minTime);
    }
};


ChronoControls.prototype.setPaused = function(paused) {
    this.paused = paused;
    this.playPause.value = this.paused ? 'Play' : 'Pause';
};


ChronoControls.prototype.handleEnterVR = function() {
    this.chronographer.enterVR();

    this.setPaused(false);
    this.loop = true;

    this.controls.style.display = 'none';
    this.vrControls.style.display = 'inline-block';
};


ChronoControls.prototype.handleLeaveVR = function() {
    this.chronographer.leaveVR();

    this.setPaused(true);
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
                this.setPaused(true);
                this.playPause.value = 'Restart';
            }
        }
    }
};


module.exports = ChronoControls;

},{}],2:[function(require,module,exports){
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

},{"./shaders/chronodataFragment":8,"./shaders/chronodataVertex":9}],3:[function(require,module,exports){
'use strict';

var ChronoData = require('./ChronoData');
var ChronoControls = require('./ChronoControls');
var DeviceOrbitControls = require('./DeviceOrbitControls');
var Earth = require('./Earth');
var FollowLine = require('./FollowLine');


var Chronographer = function(container, opts) {
    if (!Detector.webgl) { Detector.addGetWebGLMessage(); }

    this.container = container;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.radius = 1000;

    this.vr = false;

    this.setupRenderer();
    this.setupScene();

    this.chronoData = new ChronoData(this.radius, opts);
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
    // this.effect = new THREE.OculusRiftEffect(this.renderer);
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

    var targetOrientation = ['landscape'];
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

    var theta = 0;
    var phi = 0;
    if (event.gamma < 0) {
        theta = -(event.alpha + 180) * deg2rad;
        phi = (event.gamma + 90) * deg2rad;
    } else {
        theta = -event.alpha * deg2rad;
        phi = (event.gamma - 90) * deg2rad;
    }

    var x = this.radius * Math.cos(phi) * Math.cos(theta);
    var y = this.radius * Math.sin(phi);
    var z = this.radius * Math.cos(phi) * Math.sin(theta);

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwic3JjXFxqc1xcQ2hyb25vQ29udHJvbHMuanMiLCJzcmNcXGpzXFxDaHJvbm9EYXRhLmpzIiwic3JjXFxqc1xcQ2hyb25vZ3JhcGhlci5qcyIsInNyY1xcanNcXERldmljZU9yYml0Q29udHJvbHMuanMiLCJzcmNcXGpzXFxFYXJ0aC5qcyIsInNyY1xcanNcXEZvbGxvd0xpbmUuanMiLCJzcmNcXGpzXFxtYWluLmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YUZyYWdtZW50LmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YVZlcnRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIENocm9ub0NvbnRyb2xzID0gZnVuY3Rpb24oY2hyb25vZ3JhcGhlciwgY29udGFpbmVyLCBvcHRzKSB7XHJcbiAgICB0aGlzLmNocm9ub2dyYXBoZXIgPSBjaHJvbm9ncmFwaGVyO1xyXG4gICAgdGhpcy50b3RhbFBsYXlUaW1lID0gKG9wdHMgJiYgb3B0cy5wbGF5VGltZSkgfHwgMTAuMDtcclxuICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcclxuICAgIHRoaXMubG9vcCA9IHRydWU7XHJcbiAgICB0aGlzLmRhdGVGb3JtYXQgPSAob3B0cyAmJiBvcHRzLmRhdGVGb3JtYXQpIHx8ICdzdHJpbmcnO1xyXG5cclxuICAgIC8vIENyZWF0ZSBjb250cm9scyBmcm9tIGltcG9ydGVkIGh0bWwuXHJcbiAgICB2YXIgY29udGVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2xpbmtbcmVsPVwiaW1wb3J0XCJdJykuaW1wb3J0O1xyXG4gICAgdmFyIGNvbnRyb2xzID0gY29udGVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWNvbnRyb2xzLXJvb3QnKTtcclxuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChjb250cm9scyk7XHJcblxyXG4gICAgdGhpcy5jb250cm9scyAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby1jb250cm9scycpO1xyXG4gICAgdGhpcy52ckNvbnRyb2xzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby12ci1jb250cm9scycpO1xyXG5cclxuICAgIHRoaXMucGxheVBhdXNlICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tcGxheVBhdXNlQnV0dG9uJyk7XHJcbiAgICB0aGlzLmVudGVyVlIgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWVudGVyVlJCdXR0b24nKTtcclxuICAgIHRoaXMudGltZUlucHV0ICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tdGltZUlucHV0Jyk7XHJcbiAgICB0aGlzLmRhdGVCb3ggICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWRhdGVCb3gnKTtcclxuICAgIHRoaXMudnJEYXRlQm94MSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tdnItZGF0ZUJveC0xJyk7XHJcbiAgICB0aGlzLnZyRGF0ZUJveDIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLXZyLWRhdGVCb3gtMicpO1xyXG5cclxuICAgIC8vIExpc3RlbiB0byBwbGF5L3BhdXNlIGV2ZW50cyAoYnV0dG9uIGNsaWNrIGFuZCBzcGFjZSBiYXIpLlxyXG4gICAgdGhpcy5wbGF5UGF1c2UuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmhhbmRsZVBsYXlQYXVzZS5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSk7XHJcbiAgICBkb2N1bWVudC5vbmtleXByZXNzID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gMzIpIHtcclxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgdGhpcy5oYW5kbGVQbGF5UGF1c2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQodGhpcyk7XHJcblxyXG4gICAgLy8gQWxzbyB1cGRhdGUgaWYgdGhlIGlucHV0IHNsaWRlciBpcyBjaGFuZ2VkIGRpcmVjdGx5LlxyXG4gICAgdGhpcy50aW1lSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCB0aGlzLm1hbnVhbFVwZGF0ZVRpbWUuYmluZCh0aGlzKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UpO1xyXG5cclxuICAgIHRoaXMuZW50ZXJWUi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuaGFuZGxlRW50ZXJWUi5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UpO1xyXG5cclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdGZ1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vemZ1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuZ2V0VGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5zZXRUaW1lUmFuZ2UgPSBmdW5jdGlvbihtaW5UaW1lLCBtYXhUaW1lKSB7XHJcbiAgICB0aGlzLm1pblRpbWUgPSBtaW5UaW1lO1xyXG4gICAgdGhpcy5tYXhUaW1lID0gbWF4VGltZTtcclxuICAgIHRoaXMudGltZVJhbmdlID0gbWF4VGltZSAtIG1pblRpbWU7XHJcblxyXG4gICAgdGhpcy50aW1lSW5wdXQuc2V0QXR0cmlidXRlKCdtaW4nLCBtaW5UaW1lKTtcclxuICAgIHRoaXMudGltZUlucHV0LnNldEF0dHJpYnV0ZSgnbWF4JywgbWF4VGltZSk7XHJcbiAgICB0aGlzLnNldElucHV0VGltZShtaW5UaW1lKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUubWFudWFsVXBkYXRlVGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5zZXRQYXVzZWQodHJ1ZSk7XHJcbiAgICB0aGlzLnVwZGF0ZVRpbWVEaXNwbGF5KCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLnNldElucHV0VGltZSA9IGZ1bmN0aW9uKGlucHV0VGltZSkge1xyXG4gICAgdmFyIGNsYW1wZWRWYWx1ZSA9IE1hdGgubWF4KE1hdGgubWluKGlucHV0VGltZSwgdGhpcy5tYXhUaW1lKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1pblRpbWUpO1xyXG4gICAgdGhpcy50aW1lSW5wdXQudmFsdWUgPSBjbGFtcGVkVmFsdWU7XHJcblxyXG4gICAgdGhpcy51cGRhdGVUaW1lRGlzcGxheSgpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS51cGRhdGVUaW1lRGlzcGxheSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGRhdGVWYWx1ZSA9ICcnO1xyXG4gICAgaWYgKHRoaXMuZGF0ZUZvcm1hdCA9PT0gJ3RpbWVzdGFtcCcpIHtcclxuICAgICAgICB2YXIgZGF0ZSA9IG5ldyBEYXRlKHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpKTtcclxuICAgICAgICBkYXRlVmFsdWUgPSB0aGlzLmdldEZvcm1hdHRlZERhdGUoZGF0ZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRhdGVWYWx1ZSA9IE1hdGgucm91bmQocGFyc2VGbG9hdCh0aGlzLnRpbWVJbnB1dC52YWx1ZSkpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZGF0ZUJveC50ZXh0Q29udGVudCA9IGRhdGVWYWx1ZTtcclxuICAgIHRoaXMudnJEYXRlQm94MS50ZXh0Q29udGVudCA9IGRhdGVWYWx1ZTtcclxuICAgIHRoaXMudnJEYXRlQm94Mi50ZXh0Q29udGVudCA9IGRhdGVWYWx1ZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuZ2V0Rm9ybWF0dGVkRGF0ZSA9IGZ1bmN0aW9uKGRhdGUpIHtcclxuICAgIHZhciB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xyXG4gICAgdmFyIG1vbnRoID0gKDEgKyBkYXRlLmdldE1vbnRoKCkpLnRvU3RyaW5nKCk7XHJcbiAgICBtb250aCA9IG1vbnRoLmxlbmd0aCA+IDEgPyBtb250aCA6ICcwJyArIG1vbnRoO1xyXG4gICAgdmFyIGRheSA9IGRhdGUuZ2V0RGF0ZSgpLnRvU3RyaW5nKCk7XHJcbiAgICBkYXkgPSBkYXkubGVuZ3RoID4gMSA/IGRheSA6ICcwJyArIGRheTtcclxuICAgIHJldHVybiB5ZWFyICsgJy8nICsgbW9udGggKyAnLycgKyBkYXk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmhhbmRsZVBsYXlQYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5sb29wID0gZmFsc2U7XHJcbiAgICB0aGlzLnNldFBhdXNlZCghdGhpcy5wYXVzZWQpO1xyXG4gICAgaWYgKHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpID49IHRoaXMubWF4VGltZSkge1xyXG4gICAgICAgIHRoaXMuc2V0UGF1c2VkKHRydWUpO1xyXG4gICAgICAgIHRoaXMuc2V0SW5wdXRUaW1lKHRoaXMubWluVGltZSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLnNldFBhdXNlZCA9IGZ1bmN0aW9uKHBhdXNlZCkge1xyXG4gICAgdGhpcy5wYXVzZWQgPSBwYXVzZWQ7XHJcbiAgICB0aGlzLnBsYXlQYXVzZS52YWx1ZSA9IHRoaXMucGF1c2VkID8gJ1BsYXknIDogJ1BhdXNlJztcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuaGFuZGxlRW50ZXJWUiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5jaHJvbm9ncmFwaGVyLmVudGVyVlIoKTtcclxuXHJcbiAgICB0aGlzLnNldFBhdXNlZChmYWxzZSk7XHJcbiAgICB0aGlzLmxvb3AgPSB0cnVlO1xyXG5cclxuICAgIHRoaXMuY29udHJvbHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgIHRoaXMudnJDb250cm9scy5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmhhbmRsZUxlYXZlVlIgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY2hyb25vZ3JhcGhlci5sZWF2ZVZSKCk7XHJcblxyXG4gICAgdGhpcy5zZXRQYXVzZWQodHJ1ZSk7XHJcbiAgICB0aGlzLmxvb3AgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLmNvbnRyb2xzLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcclxuICAgIHRoaXMudnJDb250cm9scy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5mdWxsc2NyZWVuQ2hhbmdlSGFuZGxlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGZ1bGxzY3JlZW4gPSAoZG9jdW1lbnQud2Via2l0SXNGdWxsU2NyZWVuIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5tb3pGdWxsU2NyZWVuIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5tc0Z1bGxzY3JlZW5FbGVtZW50KTtcclxuXHJcbiAgICBpZiAoIWZ1bGxzY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmhhbmRsZUxlYXZlVlIoKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZHQpIHtcclxuICAgIGlmICghdGhpcy5wYXVzZWQpIHtcclxuICAgICAgICAvLyBTY2FsZSBkdCB0byBjb3ZlciB0aGlzLnRpbWVSYW5nZSBvdmVyIHRoaXMudG90YWxQbGF5dGltZS5cclxuICAgICAgICB2YXIgZGVsdGFUaW1lID0gdGhpcy50aW1lUmFuZ2UgLyB0aGlzLnRvdGFsUGxheVRpbWUgKiBkdDtcclxuICAgICAgICB2YXIgbmV3VGltZSA9IHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpICsgZGVsdGFUaW1lO1xyXG4gICAgICAgIHRoaXMuc2V0SW5wdXRUaW1lKG5ld1RpbWUpO1xyXG5cclxuICAgICAgICAvLyBFbmQgb2YgdGltZSByYW5nZT8gTG9vcCBiYWNrIHRvIHRoZSBzdGFydCBvciBwYXVzZS5cclxuICAgICAgICBpZiAobmV3VGltZSA+PSB0aGlzLm1heFRpbWUpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMubG9vcCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRJbnB1dFRpbWUodGhpcy5taW5UaW1lKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0UGF1c2VkKHRydWUpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5UGF1c2UudmFsdWUgPSAnUmVzdGFydCc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDaHJvbm9Db250cm9scztcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGNocm9ub2RhdGFWZXJ0ZXhTaGFkZXIgPSByZXF1aXJlKCcuL3NoYWRlcnMvY2hyb25vZGF0YVZlcnRleCcpO1xyXG52YXIgY2hyb25vZGF0YUZyYWdtZW50U2hhZGVyID0gcmVxdWlyZSgnLi9zaGFkZXJzL2Nocm9ub2RhdGFGcmFnbWVudCcpO1xyXG5cclxuXHJcbnZhciBDaHJvbm9EYXRhID0gZnVuY3Rpb24ocmFkaXVzLCBvcHRzKSB7XHJcbiAgICB0aGlzLnJhZGl1cyA9IHJhZGl1cztcclxuXHJcbiAgICBmdW5jdGlvbiBsb2FkVGV4dCh1cmwpIHtcclxuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgdXJsLCBmYWxzZSk7IC8vIFN5bmNocm9ub3VzLlxyXG4gICAgICAgIHJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZSgndGV4dC9wbGFpbicpO1xyXG4gICAgICAgIHJlcXVlc3Quc2VuZCgpO1xyXG5cclxuICAgICAgICByZXR1cm4gcmVxdWVzdC5yZXNwb25zZVRleHQ7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5kYXRhID0gW107XHJcbiAgICB2YXIgdGltZXMgPSBbXTtcclxuICAgIHRoaXMuZ2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcclxuICAgIHRoaXMubWluVGltZSA9IE51bWJlci5NQVhfVkFMVUU7XHJcbiAgICB0aGlzLm1heFRpbWUgPSAwO1xyXG5cclxuICAgIC8vIExvYWQgZGF0YSBmcm9tIGEganNvbiBmaWxlLlxyXG4gICAgdmFyIGxvY2F0aW9ucyA9IFtdO1xyXG4gICAgaWYgKG9wdHMgJiYgb3B0cy5kYXRhVVJMKSB7XHJcbiAgICAgICAgdmFyIGpzb25EYXRhID0gSlNPTi5wYXJzZShsb2FkVGV4dChvcHRzLmRhdGFVUkwpKTtcclxuICAgICAgICBsb2NhdGlvbnMgPSBqc29uRGF0YS5sb2NhdGlvbnM7XHJcbiAgICB9XHJcbiAgICBpZiAob3B0cyAmJiBvcHRzLmRhdGFKU09OKSB7XHJcbiAgICAgICAgbG9jYXRpb25zID0gb3B0cy5kYXRhSlNPTi5sb2NhdGlvbnM7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsb2NhdGlvbnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICB2YXIgdGltZXN0YW1wTXMgPSBwYXJzZUZsb2F0KGxvY2F0aW9uc1tpXS50aW1lc3RhbXBNcykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbnNbaV0uWWVhcjtcclxuXHJcbiAgICAgICAgdGhpcy5taW5UaW1lID0gTWF0aC5taW4odGltZXN0YW1wTXMsIHRoaXMubWluVGltZSk7XHJcbiAgICAgICAgdGhpcy5tYXhUaW1lID0gTWF0aC5tYXgodGltZXN0YW1wTXMsIHRoaXMubWF4VGltZSk7XHJcblxyXG4gICAgICAgIHZhciBsYXRpdHVkZSA9IGxvY2F0aW9uc1tpXS5sYXRpdHVkZUU3IC8gMTAwMDAwMDAuMCB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uc1tpXS5MYXRpdHVkZTtcclxuICAgICAgICB2YXIgbG9uZ2l0dWRlID0gbG9jYXRpb25zW2ldLmxvbmdpdHVkZUU3IC8gMTAwMDAwMDAuMCB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbnNbaV0uTG9uZ2l0dWRlO1xyXG5cclxuICAgICAgICB2YXIgZGVnMnJhZCA9IE1hdGguUEkgLyAxODAuMDtcclxuICAgICAgICB2YXIgcGhpID0gbGF0aXR1ZGUgKiBkZWcycmFkO1xyXG4gICAgICAgIHZhciB0aGV0YSA9ICgxODAgLSBsb25naXR1ZGUpICogZGVnMnJhZDtcclxuXHJcbiAgICAgICAgdmFyIHggPSAodGhpcy5yYWRpdXMgKiAxLjAxKSAqIE1hdGguY29zKHBoaSkgKiBNYXRoLmNvcyh0aGV0YSk7XHJcbiAgICAgICAgdmFyIHkgPSAodGhpcy5yYWRpdXMgKiAxLjAxKSAqIE1hdGguc2luKHBoaSk7XHJcbiAgICAgICAgdmFyIHogPSAodGhpcy5yYWRpdXMgKiAxLjAxKSAqIE1hdGguY29zKHBoaSkgKiBNYXRoLnNpbih0aGV0YSk7XHJcblxyXG4gICAgICAgIHRoaXMuZGF0YS5wdXNoKHtcclxuICAgICAgICAgICdsYXQnOiBsYXRpdHVkZSxcclxuICAgICAgICAgICdsb25nJzogbG9uZ2l0dWRlLFxyXG4gICAgICAgICAgJ3Bvc2l0aW9uJzogW3gsIHksIHpdLFxyXG4gICAgICAgICAgJ3RpbWUnOiB0aW1lc3RhbXBNc1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRpbWVzLnB1c2godGltZXN0YW1wTXMpO1xyXG5cclxuICAgICAgICB0aGlzLmdlb21ldHJ5LnZlcnRpY2VzLnB1c2gobmV3IFRIUkVFLlZlY3RvcjMoeCwgeSwgeikpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBhdHRyaWJ1dGVzID0ge1xyXG4gICAgICBwb2ludFRpbWU6IHsgdHlwZTogJ2YnLCB2YWx1ZTogdGltZXMgfVxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgdW5pZm9ybXMgPSB7XHJcbiAgICAgIHBhcnRpY2xlVGV4dHVyZToge1xyXG4gICAgICAgIHR5cGU6ICd0JyxcclxuICAgICAgICB2YWx1ZTogVEhSRUUuSW1hZ2VVdGlscy5sb2FkVGV4dHVyZSgnaW1hZ2VzL2NpcmNsZV9hbHBoYS5wbmcnKVxyXG4gICAgICB9LFxyXG4gICAgICB2aXN1YWxpemF0aW9uVGltZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogdGhpcy5taW5UaW1lXHJcbiAgICAgIH0sXHJcbiAgICAgIG1pblRpbWU6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IHRoaXMubWluVGltZVxyXG4gICAgICB9LFxyXG4gICAgICBtYXhUaW1lOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiB0aGlzLm1heFRpbWVcclxuICAgICAgfSxcclxuICAgICAgcGVyY2VudEhpZ2hsaWdodFJhbmdlOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLnBlcmNlbnRIaWdobGlnaHRSYW5nZSkgfHwgMC4xMFxyXG4gICAgICB9LFxyXG4gICAgICBtaW5BbHBoYToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5taW5BbHBoYSkgfHwgMS4wXHJcbiAgICAgIH0sXHJcbiAgICAgIG1heEFscGhhOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLm1heEFscGhhKSB8fCAxLjBcclxuICAgICAgfSxcclxuICAgICAgbWluQ29sb3I6IHtcclxuICAgICAgICB0eXBlOiAnYycsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWluQ29sb3IpIHx8IG5ldyBUSFJFRS5Db2xvcigweDIyMjIyMilcclxuICAgICAgfSxcclxuICAgICAgbWF4Q29sb3I6IHtcclxuICAgICAgICB0eXBlOiAnYycsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWF4Q29sb3IpIHx8IG5ldyBUSFJFRS5Db2xvcigweEVFRUVFRSlcclxuICAgICAgfSxcclxuICAgICAgbWluU2l6ZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5taW5TaXplKSB8fCAxMi4wXHJcbiAgICAgIH0sXHJcbiAgICAgIG1heFNpemU6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWF4U2l6ZSkgfHwgMzIuMFxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuU2hhZGVyTWF0ZXJpYWwoe1xyXG4gICAgICBhdHRyaWJ1dGVzOiAgICAgYXR0cmlidXRlcyxcclxuICAgICAgdW5pZm9ybXM6ICAgICAgIHVuaWZvcm1zLFxyXG4gICAgICB2ZXJ0ZXhTaGFkZXI6ICAgY2hyb25vZGF0YVZlcnRleFNoYWRlcixcclxuICAgICAgZnJhZ21lbnRTaGFkZXI6IGNocm9ub2RhdGFGcmFnbWVudFNoYWRlcixcclxuICAgICAgdHJhbnNwYXJlbnQ6ICAgIHRydWUsXHJcbiAgICAgIGJsZW5kaW5nOiAgICAgICBUSFJFRS5Ob3JtYWxCbGVuZGluZyxcclxuICAgICAgZGVwdGhXcml0ZTogICAgIGZhbHNlXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnBhcnRpY2xlcyA9IG5ldyBUSFJFRS5Qb2ludENsb3VkKHRoaXMuZ2VvbWV0cnksIHRoaXMubWF0ZXJpYWwpO1xyXG4gICAgLy8gcGFydGljbGVzLnNvcnRQYXJ0aWNsZXMgPSB0cnVlO1xyXG5cclxuICAgIGZ1bmN0aW9uIGNvbXBhcmUoYSwgYikge1xyXG4gICAgICAgIGlmIChhLnRpbWUgPCBiLnRpbWUpIHsgcmV0dXJuIC0xOyB9XHJcbiAgICAgICAgaWYgKGEudGltZSA+IGIudGltZSkgeyByZXR1cm4gMTsgfVxyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgfVxyXG4gICAgdGhpcy5kYXRhLnNvcnQoY29tcGFyZSk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuc2V0U2NlbmUgPSBmdW5jdGlvbihzY2VuZSkge1xyXG4gICAgdGhpcy5zY2VuZSA9IHNjZW5lO1xyXG4gICAgc2NlbmUuYWRkKHRoaXMucGFydGljbGVzKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcclxuXHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuc2V0VGltZSA9IGZ1bmN0aW9uKG5ld1RpbWUpIHtcclxuICAgIHRoaXMuY3VycmVudFRpbWUgPSBuZXdUaW1lO1xyXG4gICAgdGhpcy5tYXRlcmlhbC51bmlmb3Jtc1sndmlzdWFsaXphdGlvblRpbWUnXS52YWx1ZSA9IG5ld1RpbWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuZ2V0Q3VycmVudFRpbWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmN1cnJlbnRUaW1lO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLmdldE1pblRpbWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLm1pblRpbWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuZ2V0TWF4VGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMubWF4VGltZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5nZXREYXRhID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5kYXRhO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ2hyb25vRGF0YTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIENocm9ub0RhdGEgPSByZXF1aXJlKCcuL0Nocm9ub0RhdGEnKTtcclxudmFyIENocm9ub0NvbnRyb2xzID0gcmVxdWlyZSgnLi9DaHJvbm9Db250cm9scycpO1xyXG52YXIgRGV2aWNlT3JiaXRDb250cm9scyA9IHJlcXVpcmUoJy4vRGV2aWNlT3JiaXRDb250cm9scycpO1xyXG52YXIgRWFydGggPSByZXF1aXJlKCcuL0VhcnRoJyk7XHJcbnZhciBGb2xsb3dMaW5lID0gcmVxdWlyZSgnLi9Gb2xsb3dMaW5lJyk7XHJcblxyXG5cclxudmFyIENocm9ub2dyYXBoZXIgPSBmdW5jdGlvbihjb250YWluZXIsIG9wdHMpIHtcclxuICAgIGlmICghRGV0ZWN0b3Iud2ViZ2wpIHsgRGV0ZWN0b3IuYWRkR2V0V2ViR0xNZXNzYWdlKCk7IH1cclxuXHJcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcclxuICAgIHRoaXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcclxuICAgIHRoaXMuaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xyXG4gICAgdGhpcy5yYWRpdXMgPSAxMDAwO1xyXG5cclxuICAgIHRoaXMudnIgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLnNldHVwUmVuZGVyZXIoKTtcclxuICAgIHRoaXMuc2V0dXBTY2VuZSgpO1xyXG5cclxuICAgIHRoaXMuY2hyb25vRGF0YSA9IG5ldyBDaHJvbm9EYXRhKHRoaXMucmFkaXVzLCBvcHRzKTtcclxuICAgIHRoaXMuY2hyb25vRGF0YS5zZXRTY2VuZSh0aGlzLnNjZW5lKTtcclxuICAgIHZhciBtaW5UaW1lID0gdGhpcy5jaHJvbm9EYXRhLmdldE1pblRpbWUoKTtcclxuICAgIHZhciBtYXhUaW1lID0gdGhpcy5jaHJvbm9EYXRhLmdldE1heFRpbWUoKTtcclxuXHJcbiAgICB0aGlzLmNocm9ub0NvbnRyb2xzID0gbmV3IENocm9ub0NvbnRyb2xzKHRoaXMsIGNvbnRhaW5lciwgb3B0cyk7XHJcbiAgICB0aGlzLmNocm9ub0NvbnRyb2xzLnNldFRpbWVSYW5nZShtaW5UaW1lLCBtYXhUaW1lKTtcclxuXHJcbiAgICB0aGlzLmVhcnRoID0gbmV3IEVhcnRoKHRoaXMucmFkaXVzKTtcclxuICAgIHRoaXMuZWFydGguc2V0U2NlbmUodGhpcy5zY2VuZSk7XHJcblxyXG4gICAgaWYgKG9wdHMuZm9sbG93TGluZSkge1xyXG4gICAgICAgIHRoaXMuZm9sbG93TGluZSA9IG5ldyBGb2xsb3dMaW5lKHRoaXMuY2hyb25vRGF0YSwgdGhpcy5yYWRpdXMpO1xyXG4gICAgICAgIHRoaXMuZm9sbG93TGluZS5zZXRTY2VuZSh0aGlzLnNjZW5lKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5zZXR1cFJlbmRlcmVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoe2FscGhhOiB0cnVlLCBhbnRpYWxpYXM6IHRydWV9KTtcclxuICAgIHRoaXMucmVuZGVyZXIuc2V0U2l6ZSh3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcclxuICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCk7XHJcbiAgICB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuaWQgPSAnY2dyLWNocm9ub0RhdGEnO1xyXG5cclxuICAgIHRoaXMuZWZmZWN0ID0gbmV3IFRIUkVFLlN0ZXJlb0VmZmVjdCh0aGlzLnJlbmRlcmVyKTtcclxuICAgIC8vIHRoaXMuZWZmZWN0ID0gbmV3IFRIUkVFLk9jdWx1c1JpZnRFZmZlY3QodGhpcy5yZW5kZXJlcik7XHJcbiAgICB0aGlzLmVmZmVjdC5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5vbldpbmRvd1Jlc2l6ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy53aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xyXG4gICAgdGhpcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcblxyXG4gICAgdGhpcy5jYW1lcmEuYXNwZWN0ID0gdGhpcy53aWR0aCAvIHRoaXMuaGVpZ2h0O1xyXG4gICAgdGhpcy5jYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xyXG5cclxuICAgIHRoaXMucmVuZGVyZXIuc2V0U2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XHJcbiAgICB0aGlzLmVmZmVjdC5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5zZXRPcmllbnRhdGlvbkNvbnRyb2xzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmNvbnRyb2xzID0gdGhpcy5kZXZpY2VPcmJpdENvbnRyb2xzO1xyXG4gICAgdGhpcy5vcmJpdENvbnRyb2xzLmVuYWJsZWQgPSBmYWxzZTtcclxuICAgIHRoaXMuZGV2aWNlT3JiaXRDb250cm9scy5lbmFibGVkID0gdHJ1ZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5zZXRPcmJpdENvbnRyb2xzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmNvbnRyb2xzID0gdGhpcy5vcmJpdENvbnRyb2xzO1xyXG4gICAgdGhpcy5vcmJpdENvbnRyb2xzLmVuYWJsZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5kZXZpY2VPcmJpdENvbnRyb2xzLmVuYWJsZWQgPSBmYWxzZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5lbnRlclZSID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnZyID0gdHJ1ZTtcclxuICAgIHRoaXMuZnVsbHNjcmVlbigpO1xyXG4gICAgdGhpcy5zZXRPcmllbnRhdGlvbkNvbnRyb2xzKCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUubGVhdmVWUiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy52ciA9IGZhbHNlO1xyXG4gICAgdGhpcy5zZXRPcmJpdENvbnRyb2xzKCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUuZnVsbHNjcmVlbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYgKHRoaXMuY29udGFpbmVyLnJlcXVlc3RGdWxsc2NyZWVuKSB7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIucmVxdWVzdEZ1bGxzY3JlZW4oKTtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5jb250YWluZXIubXNSZXF1ZXN0RnVsbHNjcmVlbikge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLm1zUmVxdWVzdEZ1bGxzY3JlZW4oKTtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5jb250YWluZXIubW96UmVxdWVzdEZ1bGxTY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lci5tb3pSZXF1ZXN0RnVsbFNjcmVlbigpO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnRhaW5lci53ZWJraXRSZXF1ZXN0RnVsbHNjcmVlbikge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLndlYmtpdFJlcXVlc3RGdWxsc2NyZWVuKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHRhcmdldE9yaWVudGF0aW9uID0gWydsYW5kc2NhcGUnXTtcclxuICAgIGlmIChzY3JlZW4ubG9ja09yaWVudGF0aW9uKSB7XHJcbiAgICAgICAgc2NyZWVuLmxvY2tPcmllbnRhdGlvbih0YXJnZXRPcmllbnRhdGlvbik7XHJcbiAgICB9IGVsc2UgaWYgKHNjcmVlbi5tb3pMb2NrT3JpZW50YXRpb24pIHtcclxuICAgICAgICBzY3JlZW4ubW96TG9ja09yaWVudGF0aW9uKHRhcmdldE9yaWVudGF0aW9uKTtcclxuICAgIH0gZWxzZSBpZiAoc2NyZWVuLm1zTG9ja09yaWVudGF0aW9uKSB7XHJcbiAgICAgICAgc2NyZWVuLm1zTG9ja09yaWVudGF0aW9uKHRhcmdldE9yaWVudGF0aW9uKTtcclxuICAgIH0gZWxzZSBpZiAoc2NyZWVuLm9yaWVudGF0aW9uLmxvY2spIHtcclxuICAgICAgICBzY3JlZW4ub3JpZW50YXRpb24ubG9jayh0YXJnZXRPcmllbnRhdGlvbik7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUuc2V0dXBTY2VuZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xyXG5cclxuICAgIHRoaXMuY2FtZXJhID0gbmV3IFRIUkVFLlBlcnNwZWN0aXZlQ2FtZXJhKDc1LFxyXG4gICAgICB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgMSwgMzAwMDApO1xyXG4gICAgdGhpcy5jYW1lcmEucG9zaXRpb24ueiA9IC0odGhpcy5yYWRpdXMgKiAxLjUpO1xyXG4gICAgdGhpcy5jYW1lcmEucG9zaXRpb24ueSA9IHRoaXMucmFkaXVzICogMS4yO1xyXG4gICAgdGhpcy5jYW1lcmEubG9va0F0KHRoaXMuc2NlbmUucG9zaXRpb24pO1xyXG5cclxuICAgIHRoaXMuZGV2aWNlT3JiaXRDb250cm9scyA9IG5ldyBEZXZpY2VPcmJpdENvbnRyb2xzKHRoaXMuY2FtZXJhLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yYWRpdXMgKiAyLjApO1xyXG5cclxuICAgIHRoaXMub3JiaXRDb250cm9scyA9IG5ldyBUSFJFRS5PcmJpdENvbnRyb2xzKHRoaXMuY2FtZXJhLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5kb21FbGVtZW50KTtcclxuICAgIHRoaXMub3JiaXRDb250cm9scy5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLnJlbmRlci5iaW5kKHRoaXMpKTtcclxuICAgIHRoaXMub3JiaXRDb250cm9scy5ub1BhbiA9IHRydWU7XHJcbiAgICB0aGlzLm9yYml0Q29udHJvbHMucm90YXRlU3BlZWQgPSAwLjU7XHJcblxyXG4gICAgdGhpcy5zZXRPcmJpdENvbnRyb2xzKCk7XHJcblxyXG4gICAgdmFyIGFtYmllbnRMaWdodCA9IG5ldyBUSFJFRS5BbWJpZW50TGlnaHQoMHg4ODg4ODgpO1xyXG4gICAgdGhpcy5zY2VuZS5hZGQoYW1iaWVudExpZ2h0KTtcclxuXHJcbiAgICB2YXIgZGlyTGlnaHQgPSBuZXcgVEhSRUUuRGlyZWN0aW9uYWxMaWdodCgweGNjY2NjYywgMC4yKTtcclxuICAgIGRpckxpZ2h0LnBvc2l0aW9uLnNldCg1LCAzLCA1KTtcclxuICAgIHRoaXMuc2NlbmUuYWRkKGRpckxpZ2h0KTtcclxuXHJcbiAgICB0aGlzLmNsb2NrID0gbmV3IFRIUkVFLkNsb2NrKCk7XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHRoaXMub25XaW5kb3dSZXNpemUuYmluZCh0aGlzKSwgZmFsc2UpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGR0ID0gdGhpcy5jbG9jay5nZXREZWx0YSgpO1xyXG5cclxuICAgIHRoaXMuY2hyb25vQ29udHJvbHMudXBkYXRlKGR0KTtcclxuICAgIHRoaXMuY2hyb25vRGF0YS5zZXRUaW1lKHRoaXMuY2hyb25vQ29udHJvbHMuZ2V0VGltZSgpKTtcclxuXHJcbiAgICB0aGlzLmNocm9ub0RhdGEudXBkYXRlKGR0KTtcclxuICAgIGlmICh0aGlzLmZvbGxvd0xpbmUpIHtcclxuICAgICAgICB0aGlzLmZvbGxvd0xpbmUudXBkYXRlKGR0KTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNvbnRyb2xzLnVwZGF0ZShkdCk7XHJcbiAgICB0aGlzLnJlbmRlcigpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5yZW5kZXJlci5jbGVhcigpO1xyXG5cclxuICAgIGlmICh0aGlzLnZyKSB7XHJcbiAgICAgICAgdGhpcy5lZmZlY3QucmVuZGVyKHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5yZW5kZXJlci5yZW5kZXIodGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ2hyb25vZ3JhcGhlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIERldmljZU9yYml0Q29udHJvbHMgPSBmdW5jdGlvbihjYW1lcmEsIHJhZGl1cykge1xyXG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcclxuICAgIHRoaXMuY2FtZXJhID0gY2FtZXJhO1xyXG4gICAgdGhpcy5yYWRpdXMgPSByYWRpdXM7XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZW9yaWVudGF0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNldE9yaWVudGF0aW9uLmJpbmQodGhpcyksIGZhbHNlKTtcclxufTtcclxuXHJcblxyXG5EZXZpY2VPcmJpdENvbnRyb2xzLnByb3RvdHlwZS5zZXRPcmllbnRhdGlvbiA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICBpZiAoIXRoaXMuZW5hYmxlZCkgeyByZXR1cm47IH1cclxuXHJcbiAgICB2YXIgZGVnMnJhZCA9IE1hdGguUEkgLyAxODAuMDtcclxuXHJcbiAgICB2YXIgdGhldGEgPSAwO1xyXG4gICAgdmFyIHBoaSA9IDA7XHJcbiAgICBpZiAoZXZlbnQuZ2FtbWEgPCAwKSB7XHJcbiAgICAgICAgdGhldGEgPSAtKGV2ZW50LmFscGhhICsgMTgwKSAqIGRlZzJyYWQ7XHJcbiAgICAgICAgcGhpID0gKGV2ZW50LmdhbW1hICsgOTApICogZGVnMnJhZDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhldGEgPSAtZXZlbnQuYWxwaGEgKiBkZWcycmFkO1xyXG4gICAgICAgIHBoaSA9IChldmVudC5nYW1tYSAtIDkwKSAqIGRlZzJyYWQ7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHggPSB0aGlzLnJhZGl1cyAqIE1hdGguY29zKHBoaSkgKiBNYXRoLmNvcyh0aGV0YSk7XHJcbiAgICB2YXIgeSA9IHRoaXMucmFkaXVzICogTWF0aC5zaW4ocGhpKTtcclxuICAgIHZhciB6ID0gdGhpcy5yYWRpdXMgKiBNYXRoLmNvcyhwaGkpICogTWF0aC5zaW4odGhldGEpO1xyXG5cclxuICAgIHRoaXMuY2FtZXJhLnBvc2l0aW9uLnNldCh4LCB5LCB6KTtcclxuICAgIHRoaXMuY2FtZXJhLmxvb2tBdChuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMCwgMC4wKSk7XHJcbn07XHJcblxyXG5cclxuRGV2aWNlT3JiaXRDb250cm9scy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcblxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRGV2aWNlT3JiaXRDb250cm9scztcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEVhcnRoID0gZnVuY3Rpb24ocmFkaXVzKSB7XHJcbiAgICB2YXIgZWFydGhHZW9tZXRyeSA9IG5ldyBUSFJFRS5TcGhlcmVHZW9tZXRyeShyYWRpdXMsIDgwLCA2MCk7XHJcbiAgICB2YXIgZWFydGhNYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoUGhvbmdNYXRlcmlhbCh7XHJcbiAgICAgIG1hcDogdGhpcy5sb2FkVGV4dHVyZSgnZWFydGhfZGlmZnVzZV80ay5qcGcnKVxyXG4gICAgICAvLyBtYXA6IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX2RpZmZ1c2VfbmlnaHRfNGsuanBnJylcclxuICAgIH0pO1xyXG5cclxuICAgIGVhcnRoTWF0ZXJpYWwuYnVtcE1hcCA9IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX2J1bXBfNGsuanBnJyk7XHJcbiAgICBlYXJ0aE1hdGVyaWFsLmJ1bXBTY2FsZSA9IHJhZGl1cyAvIDIuMDtcclxuICAgIGVhcnRoTWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSB0aGlzLmxvYWRUZXh0dXJlKCdlYXJ0aF9zcGVjdWxhcl8yay5qcGcnKTtcclxuICAgIGVhcnRoTWF0ZXJpYWwuc3BlY3VsYXIgPSBuZXcgVEhSRUUuQ29sb3IoMHgzQTNBM0EpO1xyXG5cclxuICAgIHRoaXMuZWFydGhNZXNoID0gbmV3IFRIUkVFLk1lc2goZWFydGhHZW9tZXRyeSwgZWFydGhNYXRlcmlhbCk7XHJcbiAgICB0aGlzLmVhcnRoTWVzaC5yb3RhdGlvbi55ID0gTWF0aC5QSTtcclxuXHJcbiAgICB2YXIgYm91bmRhcmllc01hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtcclxuICAgICAgbWFwOiB0aGlzLmxvYWRUZXh0dXJlKCdlYXJ0aF9ib3VuZGFyaWVzXzJrLnBuZycpLFxyXG4gICAgICB0cmFuc3BhcmVudDogdHJ1ZSxcclxuICAgICAgb3BhY2l0eTogMC41XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmJvdW5kYXJpZXNNZXNoID0gbmV3IFRIUkVFLk1lc2goZWFydGhHZW9tZXRyeSwgYm91bmRhcmllc01hdGVyaWFsKTtcclxuICAgIHRoaXMuYm91bmRhcmllc01lc2gucm90YXRpb24ueSA9IE1hdGguUEk7XHJcbn07XHJcblxyXG5cclxuRWFydGgucHJvdG90eXBlLnNldFNjZW5lID0gZnVuY3Rpb24oc2NlbmUpIHtcclxuICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcclxuICAgIHNjZW5lLmFkZCh0aGlzLmVhcnRoTWVzaCk7XHJcbiAgICBzY2VuZS5hZGQodGhpcy5ib3VuZGFyaWVzTWVzaCk7XHJcbn07XHJcblxyXG5cclxuRWFydGgucHJvdG90eXBlLmxvYWRUZXh0dXJlID0gZnVuY3Rpb24odGV4dHVyZU5hbWUpIHtcclxuICAgIC8vIFRPRE86IGN1c3RvbWl6ZSBwYXRoIG9yIGltYWdlcywgdGhpcyByZWxhdGl2ZSBwYXRoIGlzIG5hc3R5LlxyXG4gICAgcmV0dXJuIFRIUkVFLkltYWdlVXRpbHMubG9hZFRleHR1cmUoJy4uLy4uL2Rpc3QvaW1hZ2VzLycgKyB0ZXh0dXJlTmFtZSk7XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFYXJ0aDtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEZvbGxvd0xpbmUgPSBmdW5jdGlvbihjaHJvbm9EYXRhLCByYWRpdXMpIHtcclxuICAgIHRoaXMuY2hyb25vRGF0YSA9IGNocm9ub0RhdGE7XHJcbiAgICB0aGlzLnJhZGl1cyA9IHJhZGl1cztcclxuICAgIHRoaXMubWF4UG9pbnRzID0gMTAwMDtcclxuXHJcbiAgICB0aGlzLmN1cnZlID0gbmV3IFRIUkVFLlNwbGluZUN1cnZlMyhbXHJcbiAgICAgIG5ldyBUSFJFRS5WZWN0b3IzKDAsMCwwKSxcclxuICAgICAgbmV3IFRIUkVFLlZlY3RvcjMoMCwwLDApXHJcbiAgICBdKTtcclxuXHJcbiAgICB0aGlzLmN1cnZlUG9pbnRzID0gW107XHJcblxyXG4gICAgdGhpcy5jdXJ2ZUdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XHJcbiAgICB0aGlzLmN1cnZlR2VvbWV0cnkudmVydGljZXMgPSB0aGlzLmN1cnZlLmdldFBvaW50cygyMDApO1xyXG5cclxuICAgIHRoaXMuY3VydmVNYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCggeyBjb2xvcjogMHhjY2NjY2MgfSApO1xyXG5cclxuICAgIHRoaXMubGluZSA9IG5ldyBUSFJFRS5MaW5lKHRoaXMuY3VydmVHZW9tZXRyeSwgdGhpcy5jdXJ2ZU1hdGVyaWFsKTtcclxuXHJcbiAgICB0aGlzLmRhdGEgPSBjaHJvbm9EYXRhLmdldERhdGEoKTtcclxuICAgIHRoaXMubGFzdFRpbWUgPSBjaHJvbm9EYXRhLmdldE1pblRpbWUoKTtcclxuICAgIHRoaXMuY3VycmVudERhdGFJbmRleCA9IDA7XHJcbn07XHJcblxyXG5cclxuRm9sbG93TGluZS5wcm90b3R5cGUuc2V0U2NlbmUgPSBmdW5jdGlvbihzY2VuZSkge1xyXG4gICAgdGhpcy5zY2VuZSA9IHNjZW5lO1xyXG4gICAgc2NlbmUuYWRkKHRoaXMubGluZSk7XHJcbn07XHJcblxyXG5cclxuRm9sbG93TGluZS5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgY3VycmVudFRpbWUgPSB0aGlzLmNocm9ub0RhdGEuZ2V0Q3VycmVudFRpbWUoKTtcclxuXHJcbiAgICBpZiAoY3VycmVudFRpbWUgPCB0aGlzLmxhc3RUaW1lKSB7XHJcbiAgICAgICAgdGhpcy5yZXNldChjdXJyZW50VGltZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd2hpbGUgKGN1cnJlbnRUaW1lID4gdGhpcy5kYXRhW3RoaXMuY3VycmVudERhdGFJbmRleF0udGltZSkge1xyXG4gICAgICAgIHRoaXMuY3VycmVudERhdGFJbmRleCsrO1xyXG4gICAgICAgIHRoaXMuYWRkUG9pbnQoKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmxhc3RUaW1lID0gY3VycmVudFRpbWU7XHJcbn07XHJcblxyXG5cclxuRm9sbG93TGluZS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbihjdXJyZW50VGltZSkge1xyXG4gICAgdGhpcy5jdXJ2ZVBvaW50cyA9IFtdO1xyXG4gICAgdGhpcy5jdXJyZW50RGF0YUluZGV4ID0gMDtcclxuXHJcbiAgICB3aGlsZSAoY3VycmVudFRpbWUgPiB0aGlzLmRhdGFbdGhpcy5jdXJyZW50RGF0YUluZGV4XS50aW1lKSB7XHJcbiAgICAgICAgdGhpcy5jdXJyZW50RGF0YUluZGV4Kys7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuRm9sbG93TGluZS5wcm90b3R5cGUuYWRkUG9pbnQgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBuZXh0UG9zaXRpb24gPSB0aGlzLmRhdGFbdGhpcy5jdXJyZW50RGF0YUluZGV4XS5wb3NpdGlvbjtcclxuICAgIHRoaXMuY3VydmVQb2ludHMucHVzaChuZXcgVEhSRUUuVmVjdG9yMyhuZXh0UG9zaXRpb25bMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dFBvc2l0aW9uWzFdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRQb3NpdGlvblsyXSkpO1xyXG4gICAgaWYgKHRoaXMuY3VydmVQb2ludHMubGVuZ3RoID4gdGhpcy5tYXhQb2ludHMpIHtcclxuICAgICAgICB0aGlzLmN1cnZlUG9pbnRzLnNoaWZ0KCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5jdXJ2ZSA9IG5ldyBUSFJFRS5TcGxpbmVDdXJ2ZTModGhpcy5jdXJ2ZVBvaW50cyk7XHJcblxyXG4gICAgdGhpcy5jdXJ2ZUdlb21ldHJ5LnZlcnRpY2VzID0gdGhpcy5jdXJ2ZS5nZXRQb2ludHModGhpcy5tYXhQb2ludHMgKiAzKTtcclxuICAgIHRoaXMubGluZS5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRm9sbG93TGluZTtcclxuIiwiLy8gRW50cnkgcG9pbnQgZm9yIGJ1aWxkaW5nLlxyXG5cclxudmFyIENocm9ub2dyYXBoZXIgPSByZXF1aXJlKCcuL0Nocm9ub2dyYXBoZXInKTtcclxuXHJcbndpbmRvdy5DaHJvbm9ncmFwaGVyID0gQ2hyb25vZ3JhcGhlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGNocm9ub2RhdGFGcmFnbWVudCA9ICcnICtcclxuICAgICd1bmlmb3JtIHNhbXBsZXIyRCBwYXJ0aWNsZVRleHR1cmU7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd2YXJ5aW5nIGZsb2F0IHQ7IFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgdmVjMyB0aW1lQ29sb3I7IFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgZmxvYXQgdGltZUFscGhhOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndm9pZCBtYWluKCkgeyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdGV4dHVyZUFscGhhID0gdGV4dHVyZTJEKHBhcnRpY2xlVGV4dHVyZSwgZ2xfUG9pbnRDb29yZCkuYTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGFscGhhID0gdGV4dHVyZUFscGhhICogdGltZUFscGhhOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIHZlYzMgY29sb3IgPSB0aW1lQ29sb3I7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChjb2xvciwgYWxwaGEpOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGNocm9ub2RhdGFGcmFnbWVudDtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGNocm9ub2RhdGFWZXJ0ZXggPSAnJyArXHJcbiAgICAnYXR0cmlidXRlIGZsb2F0IHBvaW50VGltZTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWluVGltZTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBtYXhUaW1lOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IHZpc3VhbGl6YXRpb25UaW1lOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IHBlcmNlbnRIaWdobGlnaHRSYW5nZTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWluQWxwaGE7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWF4QWxwaGE7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gdmVjMyBtaW5Db2xvcjsgXFxuJyArXHJcbiAgICAndW5pZm9ybSB2ZWMzIG1heENvbG9yOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1pblNpemU7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWF4U2l6ZTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgZmxvYXQgdDsgXFxuJyArXHJcbiAgICAndmFyeWluZyBmbG9hdCB0aW1lQWxwaGE7IFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgdmVjMyB0aW1lQ29sb3I7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICdmbG9hdCBsZXJwKGZsb2F0IG1pblZhbHVlLCBmbG9hdCBtYXhWYWx1ZSwgZmxvYXQgdCkgeyBcXG4nICtcclxuICAgICcgICAgcmV0dXJuIChtaW5WYWx1ZSAqICgxLjAgLSB0KSkgKyAobWF4VmFsdWUgKiB0KTsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnZmxvYXQgaW52ZXJzZUxlcnAoZmxvYXQgdmFsdWUsIGZsb2F0IG1pblZhbHVlLCBmbG9hdCBtYXhWYWx1ZSkgeyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdmFsdWVSYW5nZSA9IG1heFZhbHVlIC0gbWluVmFsdWU7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBpbnZlcnNlTGVycGVkID0gKHZhbHVlIC0gbWluVmFsdWUpIC8gdmFsdWVSYW5nZTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGNsYW1wZWQgPSBjbGFtcChpbnZlcnNlTGVycGVkLCAwLjAsIDEuMCk7IFxcbicgK1xyXG4gICAgJyAgICByZXR1cm4gaW52ZXJzZUxlcnBlZDsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnLy8gUkdCIHRvIEhTViBhbmQgSFNWIHRvIFJHQiBcXG4nICtcclxuICAgICcvLyBzb3VyY2U6IGh0dHA6Ly9sb2xlbmdpbmUubmV0L2Jsb2cvMjAxMy8wNy8yNy9yZ2ItdG8taHN2LWluLWdsc2wgXFxuJyArXHJcbiAgICAndmVjMyByZ2IyaHN2KHZlYzMgYykgeyBcXG4nICtcclxuICAgICcgICAgdmVjNCBLID0gdmVjNCgwLjAsIC0xLjAgLyAzLjAsIDIuMCAvIDMuMCwgLTEuMCk7IFxcbicgK1xyXG4gICAgJyAgICB2ZWM0IHAgPSBjLmcgPCBjLmIgPyB2ZWM0KGMuYmcsIEsud3opIDogdmVjNChjLmdiLCBLLnh5KTsgXFxuJyArXHJcbiAgICAnICAgIHZlYzQgcSA9IGMuciA8IHAueCA/IHZlYzQocC54eXcsIGMucikgOiB2ZWM0KGMuciwgcC55engpOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGQgPSBxLnggLSBtaW4ocS53LCBxLnkpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgZSA9IDEuMGUtMTA7IFxcbicgK1xyXG4gICAgJyAgICByZXR1cm4gdmVjMyhhYnMocS56ICsgKHEudyAtIHEueSkgLyAoNi4wICogZCArIGUpKSwgZCAvIChxLnggKyBlKSwgcS54KTsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndmVjMyBoc3YycmdiKHZlYzMgYykgeyBcXG4nICtcclxuICAgICcgICAgdmVjNCBLID0gdmVjNCgxLjAsIDIuMCAvIDMuMCwgMS4wIC8gMy4wLCAzLjApOyBcXG4nICtcclxuICAgICcgICAgdmVjMyBwID0gYWJzKGZyYWN0KGMueHh4ICsgSy54eXopICogNi4wIC0gSy53d3cpOyBcXG4nICtcclxuICAgICcgICAgcmV0dXJuIGMueiAqIG1peChLLnh4eCwgY2xhbXAocCAtIEsueHh4LCAwLjAsIDEuMCksIGMueSk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd2b2lkIG1haW4oKSB7IFxcbicgK1xyXG4gICAgJyAgICB2ZWM0IG12UG9zaXRpb24gPSB2aWV3TWF0cml4ICogdmVjNChwb3NpdGlvbiwgMS4wKTsgXFxuJyArXHJcbiAgICAnICAgIGdsX1Bvc2l0aW9uID0gcHJvamVjdGlvbk1hdHJpeCAqIG12UG9zaXRpb247IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdmVydGV4UGVyY2VudCA9IGludmVyc2VMZXJwKHBvaW50VGltZSwgbWluVGltZSwgbWF4VGltZSk7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCB2aXNQZXJjZW50ID0gaW52ZXJzZUxlcnAodmlzdWFsaXphdGlvblRpbWUsIG1pblRpbWUsIG1heFRpbWUpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgcGVyY2VudERpZmZlcmVuY2UgPSBhYnModmVydGV4UGVyY2VudCAtIHZpc1BlcmNlbnQpOyBcXG4nICtcclxuICAgICcgICAgLy8gU2NhbGUgZGlmZmVyZW5jZSBiYXNlZCBvbiBoaWdobGlnaHQgcmFuZ2UgaW50byBhbiBpbnRlcnBvbGF0aW9uIHRpbWUuIFxcbicgK1xyXG4gICAgJyAgICB0ID0gY2xhbXAoMS4wIC0gcGVyY2VudERpZmZlcmVuY2UgLyBwZXJjZW50SGlnaGxpZ2h0UmFuZ2UsIDAuMCwgMS4wKTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICBnbF9Qb2ludFNpemUgPSBsZXJwKG1pblNpemUsIG1heFNpemUsIHQpOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIHRpbWVBbHBoYSA9IGxlcnAobWluQWxwaGEsIG1heEFscGhhLCB0KTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICB2ZWMzIG1pbkhTViA9IHJnYjJoc3YobWluQ29sb3IpOyBcXG4nICtcclxuICAgICcgICAgdmVjMyBtYXhIU1YgPSByZ2IyaHN2KG1heENvbG9yKTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGggPSBsZXJwKG1pbkhTVi54LCBtYXhIU1YueCwgdCk7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBzID0gbGVycChtaW5IU1YueSwgbWF4SFNWLnksIHQpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdiA9IGxlcnAobWluSFNWLnosIG1heEhTVi56LCB0KTsgXFxuJyArXHJcbiAgICAnICAgIHRpbWVDb2xvciA9IGhzdjJyZ2IodmVjMyhoLCBzLCB2KSk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnJztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gY2hyb25vZGF0YVZlcnRleDtcclxuIl19
