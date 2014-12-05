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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwic3JjXFxqc1xcQ2hyb25vQ29udHJvbHMuanMiLCJzcmNcXGpzXFxDaHJvbm9EYXRhLmpzIiwic3JjXFxqc1xcQ2hyb25vZ3JhcGhlci5qcyIsInNyY1xcanNcXERldmljZU9yYml0Q29udHJvbHMuanMiLCJzcmNcXGpzXFxFYXJ0aC5qcyIsInNyY1xcanNcXEZvbGxvd0xpbmUuanMiLCJzcmNcXGpzXFxtYWluLmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YUZyYWdtZW50LmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YVZlcnRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIENocm9ub0NvbnRyb2xzID0gZnVuY3Rpb24oY2hyb25vZ3JhcGhlciwgY29udGFpbmVyLCBvcHRzKSB7XHJcbiAgICB0aGlzLmNocm9ub2dyYXBoZXIgPSBjaHJvbm9ncmFwaGVyO1xyXG4gICAgdGhpcy50b3RhbFBsYXlUaW1lID0gKG9wdHMgJiYgb3B0cy5wbGF5VGltZSkgfHwgMTAuMDtcclxuICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcclxuICAgIHRoaXMubG9vcCA9IHRydWU7XHJcbiAgICB0aGlzLmRhdGVGb3JtYXQgPSAob3B0cyAmJiBvcHRzLmRhdGVGb3JtYXQpIHx8ICdzdHJpbmcnO1xyXG5cclxuICAgIC8vIENyZWF0ZSBjb250cm9scyBmcm9tIGltcG9ydGVkIGh0bWwuXHJcbiAgICB2YXIgY29udGVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2xpbmtbcmVsPVwiaW1wb3J0XCJdJykuaW1wb3J0O1xyXG4gICAgdmFyIGNvbnRyb2xzID0gY29udGVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWNvbnRyb2xzLXJvb3QnKTtcclxuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChjb250cm9scyk7XHJcblxyXG4gICAgdGhpcy5jb250cm9scyAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby1jb250cm9scycpO1xyXG4gICAgdGhpcy52ckNvbnRyb2xzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby12ci1jb250cm9scycpO1xyXG5cclxuICAgIHRoaXMucGxheVBhdXNlICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tcGxheVBhdXNlQnV0dG9uJyk7XHJcbiAgICB0aGlzLmVudGVyVlIgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWVudGVyVlJCdXR0b24nKTtcclxuICAgIHRoaXMudGltZUlucHV0ICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tdGltZUlucHV0Jyk7XHJcbiAgICB0aGlzLmRhdGVCb3ggICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWRhdGVCb3gnKTtcclxuICAgIHRoaXMudnJEYXRlQm94MSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tdnItZGF0ZUJveC0xJyk7XHJcbiAgICB0aGlzLnZyRGF0ZUJveDIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLXZyLWRhdGVCb3gtMicpO1xyXG5cclxuICAgIC8vIExpc3RlbiB0byBwbGF5L3BhdXNlIGV2ZW50cyAoYnV0dG9uIGNsaWNrIGFuZCBzcGFjZSBiYXIpLlxyXG4gICAgdGhpcy5wbGF5UGF1c2UuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmhhbmRsZVBsYXlQYXVzZS5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSk7XHJcbiAgICBkb2N1bWVudC5vbmtleXByZXNzID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gMzIpIHtcclxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgdGhpcy5oYW5kbGVQbGF5UGF1c2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQodGhpcyk7XHJcblxyXG4gICAgLy8gQWxzbyB1cGRhdGUgaWYgdGhlIGlucHV0IHNsaWRlciBpcyBjaGFuZ2VkIGRpcmVjdGx5LlxyXG4gICAgdGhpcy50aW1lSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCB0aGlzLm1hbnVhbFVwZGF0ZVRpbWUuYmluZCh0aGlzKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UpO1xyXG5cclxuICAgIHRoaXMuZW50ZXJWUi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuaGFuZGxlRW50ZXJWUi5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UpO1xyXG5cclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdGZ1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vemZ1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuZ2V0VGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5zZXRUaW1lUmFuZ2UgPSBmdW5jdGlvbihtaW5UaW1lLCBtYXhUaW1lKSB7XHJcbiAgICB0aGlzLm1pblRpbWUgPSBtaW5UaW1lO1xyXG4gICAgdGhpcy5tYXhUaW1lID0gbWF4VGltZTtcclxuICAgIHRoaXMudGltZVJhbmdlID0gbWF4VGltZSAtIG1pblRpbWU7XHJcblxyXG4gICAgdGhpcy50aW1lSW5wdXQuc2V0QXR0cmlidXRlKCdtaW4nLCBtaW5UaW1lKTtcclxuICAgIHRoaXMudGltZUlucHV0LnNldEF0dHJpYnV0ZSgnbWF4JywgbWF4VGltZSk7XHJcbiAgICB0aGlzLnNldElucHV0VGltZShtaW5UaW1lKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUubWFudWFsVXBkYXRlVGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5zZXRQYXVzZWQodHJ1ZSk7XHJcbiAgICB0aGlzLnVwZGF0ZVRpbWVEaXNwbGF5KCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLnNldElucHV0VGltZSA9IGZ1bmN0aW9uKGlucHV0VGltZSkge1xyXG4gICAgdmFyIGNsYW1wZWRWYWx1ZSA9IE1hdGgubWF4KE1hdGgubWluKGlucHV0VGltZSwgdGhpcy5tYXhUaW1lKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1pblRpbWUpO1xyXG4gICAgdGhpcy50aW1lSW5wdXQudmFsdWUgPSBjbGFtcGVkVmFsdWU7XHJcblxyXG4gICAgdGhpcy51cGRhdGVUaW1lRGlzcGxheSgpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS51cGRhdGVUaW1lRGlzcGxheSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGRhdGVWYWx1ZSA9ICcnO1xyXG4gICAgaWYgKHRoaXMuZGF0ZUZvcm1hdCA9PT0gJ3RpbWVzdGFtcCcpIHtcclxuICAgICAgICB2YXIgZGF0ZSA9IG5ldyBEYXRlKHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpKTtcclxuICAgICAgICBkYXRlVmFsdWUgPSB0aGlzLmdldEZvcm1hdHRlZERhdGUoZGF0ZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRhdGVWYWx1ZSA9IE1hdGgucm91bmQocGFyc2VGbG9hdCh0aGlzLnRpbWVJbnB1dC52YWx1ZSkpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZGF0ZUJveC50ZXh0Q29udGVudCA9IGRhdGVWYWx1ZTtcclxuICAgIHRoaXMudnJEYXRlQm94MS50ZXh0Q29udGVudCA9IGRhdGVWYWx1ZTtcclxuICAgIHRoaXMudnJEYXRlQm94Mi50ZXh0Q29udGVudCA9IGRhdGVWYWx1ZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuZ2V0Rm9ybWF0dGVkRGF0ZSA9IGZ1bmN0aW9uKGRhdGUpIHtcclxuICAgIHZhciB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xyXG4gICAgdmFyIG1vbnRoID0gKDEgKyBkYXRlLmdldE1vbnRoKCkpLnRvU3RyaW5nKCk7XHJcbiAgICBtb250aCA9IG1vbnRoLmxlbmd0aCA+IDEgPyBtb250aCA6ICcwJyArIG1vbnRoO1xyXG4gICAgdmFyIGRheSA9IGRhdGUuZ2V0RGF0ZSgpLnRvU3RyaW5nKCk7XHJcbiAgICBkYXkgPSBkYXkubGVuZ3RoID4gMSA/IGRheSA6ICcwJyArIGRheTtcclxuICAgIHJldHVybiB5ZWFyICsgJy8nICsgbW9udGggKyAnLycgKyBkYXk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmhhbmRsZVBsYXlQYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5sb29wID0gZmFsc2U7XHJcbiAgICB0aGlzLnNldFBhdXNlZCghdGhpcy5wYXVzZWQpO1xyXG4gICAgaWYgKHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpID49IHRoaXMubWF4VGltZSkge1xyXG4gICAgICAgIHRoaXMuc2V0UGF1c2VkKHRydWUpO1xyXG4gICAgICAgIHRoaXMuc2V0SW5wdXRUaW1lKHRoaXMubWluVGltZSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLnNldFBhdXNlZCA9IGZ1bmN0aW9uKHBhdXNlZCkge1xyXG4gICAgdGhpcy5wYXVzZWQgPSBwYXVzZWQ7XHJcbiAgICB0aGlzLnBsYXlQYXVzZS52YWx1ZSA9IHRoaXMucGF1c2VkID8gJ1BsYXknIDogJ1BhdXNlJztcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuaGFuZGxlRW50ZXJWUiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5jaHJvbm9ncmFwaGVyLmVudGVyVlIoKTtcclxuXHJcbiAgICB0aGlzLnNldFBhdXNlZChmYWxzZSk7XHJcbiAgICB0aGlzLmxvb3AgPSB0cnVlO1xyXG5cclxuICAgIHRoaXMuY29udHJvbHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgIHRoaXMudnJDb250cm9scy5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmhhbmRsZUxlYXZlVlIgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY2hyb25vZ3JhcGhlci5sZWF2ZVZSKCk7XHJcblxyXG4gICAgdGhpcy5zZXRQYXVzZWQodHJ1ZSk7XHJcbiAgICB0aGlzLmxvb3AgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLmNvbnRyb2xzLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcclxuICAgIHRoaXMudnJDb250cm9scy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5mdWxsc2NyZWVuQ2hhbmdlSGFuZGxlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGZ1bGxzY3JlZW4gPSAoZG9jdW1lbnQud2Via2l0SXNGdWxsU2NyZWVuIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5tb3pGdWxsU2NyZWVuIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5tc0Z1bGxzY3JlZW5FbGVtZW50KTtcclxuXHJcbiAgICBpZiAoIWZ1bGxzY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmhhbmRsZUxlYXZlVlIoKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZHQpIHtcclxuICAgIGlmICghdGhpcy5wYXVzZWQpIHtcclxuICAgICAgICAvLyBTY2FsZSBkdCB0byBjb3ZlciB0aGlzLnRpbWVSYW5nZSBvdmVyIHRoaXMudG90YWxQbGF5dGltZS5cclxuICAgICAgICB2YXIgZGVsdGFUaW1lID0gdGhpcy50aW1lUmFuZ2UgLyB0aGlzLnRvdGFsUGxheVRpbWUgKiBkdDtcclxuICAgICAgICB2YXIgbmV3VGltZSA9IHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpICsgZGVsdGFUaW1lO1xyXG4gICAgICAgIHRoaXMuc2V0SW5wdXRUaW1lKG5ld1RpbWUpO1xyXG5cclxuICAgICAgICAvLyBFbmQgb2YgdGltZSByYW5nZT8gTG9vcCBiYWNrIHRvIHRoZSBzdGFydCBvciBwYXVzZS5cclxuICAgICAgICBpZiAobmV3VGltZSA+PSB0aGlzLm1heFRpbWUpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMubG9vcCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRJbnB1dFRpbWUodGhpcy5taW5UaW1lKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0UGF1c2VkKHRydWUpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5UGF1c2UudmFsdWUgPSAnUmVzdGFydCc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDaHJvbm9Db250cm9scztcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGNocm9ub2RhdGFWZXJ0ZXhTaGFkZXIgPSByZXF1aXJlKCcuL3NoYWRlcnMvY2hyb25vZGF0YVZlcnRleCcpO1xyXG52YXIgY2hyb25vZGF0YUZyYWdtZW50U2hhZGVyID0gcmVxdWlyZSgnLi9zaGFkZXJzL2Nocm9ub2RhdGFGcmFnbWVudCcpO1xyXG5cclxuXHJcbnZhciBDaHJvbm9EYXRhID0gZnVuY3Rpb24ocmFkaXVzLCBvcHRzKSB7XHJcbiAgICB0aGlzLnJhZGl1cyA9IHJhZGl1cztcclxuXHJcbiAgICBmdW5jdGlvbiBsb2FkVGV4dCh1cmwpIHtcclxuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgdXJsLCBmYWxzZSk7IC8vIFN5bmNocm9ub3VzLlxyXG4gICAgICAgIHJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZSgndGV4dC9wbGFpbicpO1xyXG4gICAgICAgIHJlcXVlc3Quc2VuZCgpO1xyXG5cclxuICAgICAgICByZXR1cm4gcmVxdWVzdC5yZXNwb25zZVRleHQ7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5kYXRhID0gW107XHJcbiAgICB2YXIgdGltZXMgPSBbXTtcclxuICAgIHRoaXMuZ2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcclxuICAgIHRoaXMubWluVGltZSA9IE51bWJlci5NQVhfVkFMVUU7XHJcbiAgICB0aGlzLm1heFRpbWUgPSAwO1xyXG5cclxuICAgIC8vIExvYWQgZGF0YSBmcm9tIGEganNvbiBmaWxlLlxyXG4gICAgdmFyIGxvY2F0aW9ucyA9IFtdO1xyXG4gICAgaWYgKG9wdHMgJiYgb3B0cy5kYXRhVVJMKSB7XHJcbiAgICAgICAgdmFyIGpzb25EYXRhID0gSlNPTi5wYXJzZShsb2FkVGV4dChvcHRzLmRhdGFVUkwpKTtcclxuICAgICAgICBsb2NhdGlvbnMgPSBqc29uRGF0YS5sb2NhdGlvbnM7XHJcbiAgICB9XHJcbiAgICBpZiAob3B0cyAmJiBvcHRzLmRhdGFKU09OKSB7XHJcbiAgICAgICAgbG9jYXRpb25zID0gb3B0cy5kYXRhSlNPTi5sb2NhdGlvbnM7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsb2NhdGlvbnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICB2YXIgdGltZXN0YW1wTXMgPSBwYXJzZUZsb2F0KGxvY2F0aW9uc1tpXS50aW1lc3RhbXBNcykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbnNbaV0uWWVhcjtcclxuXHJcbiAgICAgICAgdGhpcy5taW5UaW1lID0gTWF0aC5taW4odGltZXN0YW1wTXMsIHRoaXMubWluVGltZSk7XHJcbiAgICAgICAgdGhpcy5tYXhUaW1lID0gTWF0aC5tYXgodGltZXN0YW1wTXMsIHRoaXMubWF4VGltZSk7XHJcblxyXG4gICAgICAgIHZhciBsYXRpdHVkZSA9IGxvY2F0aW9uc1tpXS5sYXRpdHVkZUU3IC8gMTAwMDAwMDAuMCB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uc1tpXS5MYXRpdHVkZTtcclxuICAgICAgICB2YXIgbG9uZ2l0dWRlID0gbG9jYXRpb25zW2ldLmxvbmdpdHVkZUU3IC8gMTAwMDAwMDAuMCB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbnNbaV0uTG9uZ2l0dWRlO1xyXG5cclxuICAgICAgICB2YXIgZGVnMnJhZCA9IE1hdGguUEkgLyAxODAuMDtcclxuICAgICAgICB2YXIgcGhpID0gbGF0aXR1ZGUgKiBkZWcycmFkO1xyXG4gICAgICAgIHZhciB0aGV0YSA9ICgxODAgLSBsb25naXR1ZGUpICogZGVnMnJhZDtcclxuXHJcbiAgICAgICAgdmFyIHggPSAodGhpcy5yYWRpdXMgKiAxLjAxKSAqIE1hdGguY29zKHBoaSkgKiBNYXRoLmNvcyh0aGV0YSk7XHJcbiAgICAgICAgdmFyIHkgPSAodGhpcy5yYWRpdXMgKiAxLjAxKSAqIE1hdGguc2luKHBoaSk7XHJcbiAgICAgICAgdmFyIHogPSAodGhpcy5yYWRpdXMgKiAxLjAxKSAqIE1hdGguY29zKHBoaSkgKiBNYXRoLnNpbih0aGV0YSk7XHJcblxyXG4gICAgICAgIHRoaXMuZGF0YS5wdXNoKHtcclxuICAgICAgICAgICdsYXQnOiBsYXRpdHVkZSxcclxuICAgICAgICAgICdsb25nJzogbG9uZ2l0dWRlLFxyXG4gICAgICAgICAgJ3Bvc2l0aW9uJzogW3gsIHksIHpdLFxyXG4gICAgICAgICAgJ3RpbWUnOiB0aW1lc3RhbXBNc1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRpbWVzLnB1c2godGltZXN0YW1wTXMpO1xyXG5cclxuICAgICAgICB0aGlzLmdlb21ldHJ5LnZlcnRpY2VzLnB1c2gobmV3IFRIUkVFLlZlY3RvcjMoeCwgeSwgeikpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBhdHRyaWJ1dGVzID0ge1xyXG4gICAgICBwb2ludFRpbWU6IHsgdHlwZTogJ2YnLCB2YWx1ZTogdGltZXMgfVxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgdW5pZm9ybXMgPSB7XHJcbiAgICAgIHBhcnRpY2xlVGV4dHVyZToge1xyXG4gICAgICAgIHR5cGU6ICd0JyxcclxuICAgICAgICB2YWx1ZTogVEhSRUUuSW1hZ2VVdGlscy5sb2FkVGV4dHVyZSgnaW1hZ2VzL2NpcmNsZV9hbHBoYS5wbmcnKVxyXG4gICAgICB9LFxyXG4gICAgICB2aXN1YWxpemF0aW9uVGltZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogdGhpcy5taW5UaW1lXHJcbiAgICAgIH0sXHJcbiAgICAgIG1pblRpbWU6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IHRoaXMubWluVGltZVxyXG4gICAgICB9LFxyXG4gICAgICBtYXhUaW1lOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiB0aGlzLm1heFRpbWVcclxuICAgICAgfSxcclxuICAgICAgcGVyY2VudEhpZ2hsaWdodFJhbmdlOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLnBlcmNlbnRIaWdobGlnaHRSYW5nZSkgfHwgMC4xMFxyXG4gICAgICB9LFxyXG4gICAgICBtaW5BbHBoYToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5taW5BbHBoYSkgfHwgMS4wXHJcbiAgICAgIH0sXHJcbiAgICAgIG1heEFscGhhOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLm1heEFscGhhKSB8fCAxLjBcclxuICAgICAgfSxcclxuICAgICAgbWluQ29sb3I6IHtcclxuICAgICAgICB0eXBlOiAnYycsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWluQ29sb3IpIHx8IG5ldyBUSFJFRS5Db2xvcigweDIyMjIyMilcclxuICAgICAgfSxcclxuICAgICAgbWF4Q29sb3I6IHtcclxuICAgICAgICB0eXBlOiAnYycsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWF4Q29sb3IpIHx8IG5ldyBUSFJFRS5Db2xvcigweEVFRUVFRSlcclxuICAgICAgfSxcclxuICAgICAgbWluU2l6ZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5taW5TaXplKSB8fCAxMi4wXHJcbiAgICAgIH0sXHJcbiAgICAgIG1heFNpemU6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWF4U2l6ZSkgfHwgMzIuMFxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuU2hhZGVyTWF0ZXJpYWwoe1xyXG4gICAgICBhdHRyaWJ1dGVzOiAgICAgYXR0cmlidXRlcyxcclxuICAgICAgdW5pZm9ybXM6ICAgICAgIHVuaWZvcm1zLFxyXG4gICAgICB2ZXJ0ZXhTaGFkZXI6ICAgY2hyb25vZGF0YVZlcnRleFNoYWRlcixcclxuICAgICAgZnJhZ21lbnRTaGFkZXI6IGNocm9ub2RhdGFGcmFnbWVudFNoYWRlcixcclxuICAgICAgdHJhbnNwYXJlbnQ6ICAgIHRydWUsXHJcbiAgICAgIGJsZW5kaW5nOiAgICAgICBUSFJFRS5Ob3JtYWxCbGVuZGluZyxcclxuICAgICAgZGVwdGhXcml0ZTogICAgIGZhbHNlXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnBhcnRpY2xlcyA9IG5ldyBUSFJFRS5Qb2ludENsb3VkKHRoaXMuZ2VvbWV0cnksIHRoaXMubWF0ZXJpYWwpO1xyXG4gICAgLy8gcGFydGljbGVzLnNvcnRQYXJ0aWNsZXMgPSB0cnVlO1xyXG5cclxuICAgIGZ1bmN0aW9uIGNvbXBhcmUoYSwgYikge1xyXG4gICAgICAgIGlmIChhLnRpbWUgPCBiLnRpbWUpIHsgcmV0dXJuIC0xOyB9XHJcbiAgICAgICAgaWYgKGEudGltZSA+IGIudGltZSkgeyByZXR1cm4gMTsgfVxyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgfVxyXG4gICAgdGhpcy5kYXRhLnNvcnQoY29tcGFyZSk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuc2V0U2NlbmUgPSBmdW5jdGlvbihzY2VuZSkge1xyXG4gICAgdGhpcy5zY2VuZSA9IHNjZW5lO1xyXG4gICAgc2NlbmUuYWRkKHRoaXMucGFydGljbGVzKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcclxuXHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuc2V0VGltZSA9IGZ1bmN0aW9uKG5ld1RpbWUpIHtcclxuICAgIHRoaXMuY3VycmVudFRpbWUgPSBuZXdUaW1lO1xyXG4gICAgdGhpcy5tYXRlcmlhbC51bmlmb3Jtc1sndmlzdWFsaXphdGlvblRpbWUnXS52YWx1ZSA9IG5ld1RpbWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuZ2V0Q3VycmVudFRpbWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmN1cnJlbnRUaW1lO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLmdldE1pblRpbWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLm1pblRpbWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuZ2V0TWF4VGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMubWF4VGltZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5nZXREYXRhID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5kYXRhO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ2hyb25vRGF0YTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIENocm9ub0RhdGEgPSByZXF1aXJlKCcuL0Nocm9ub0RhdGEnKTtcclxudmFyIENocm9ub0NvbnRyb2xzID0gcmVxdWlyZSgnLi9DaHJvbm9Db250cm9scycpO1xyXG52YXIgRGV2aWNlT3JiaXRDb250cm9scyA9IHJlcXVpcmUoJy4vRGV2aWNlT3JiaXRDb250cm9scycpO1xyXG52YXIgRWFydGggPSByZXF1aXJlKCcuL0VhcnRoJyk7XHJcbnZhciBGb2xsb3dMaW5lID0gcmVxdWlyZSgnLi9Gb2xsb3dMaW5lJyk7XHJcblxyXG5cclxudmFyIENocm9ub2dyYXBoZXIgPSBmdW5jdGlvbihjb250YWluZXIsIG9wdHMpIHtcclxuICAgIGlmICghRGV0ZWN0b3Iud2ViZ2wpIHsgRGV0ZWN0b3IuYWRkR2V0V2ViR0xNZXNzYWdlKCk7IH1cclxuXHJcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcclxuICAgIHRoaXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcclxuICAgIHRoaXMuaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xyXG4gICAgdGhpcy5yYWRpdXMgPSAxMDAwO1xyXG5cclxuICAgIHRoaXMudnIgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLnNldHVwUmVuZGVyZXIoKTtcclxuICAgIHRoaXMuc2V0dXBTY2VuZSgpO1xyXG5cclxuICAgIHRoaXMuY2hyb25vRGF0YSA9IG5ldyBDaHJvbm9EYXRhKHRoaXMucmFkaXVzLCBvcHRzKTtcclxuICAgIHRoaXMuY2hyb25vRGF0YS5zZXRTY2VuZSh0aGlzLnNjZW5lKTtcclxuICAgIHZhciBtaW5UaW1lID0gdGhpcy5jaHJvbm9EYXRhLmdldE1pblRpbWUoKTtcclxuICAgIHZhciBtYXhUaW1lID0gdGhpcy5jaHJvbm9EYXRhLmdldE1heFRpbWUoKTtcclxuXHJcbiAgICB0aGlzLmNocm9ub0NvbnRyb2xzID0gbmV3IENocm9ub0NvbnRyb2xzKHRoaXMsIGNvbnRhaW5lciwgb3B0cyk7XHJcbiAgICB0aGlzLmNocm9ub0NvbnRyb2xzLnNldFRpbWVSYW5nZShtaW5UaW1lLCBtYXhUaW1lKTtcclxuXHJcbiAgICB0aGlzLmVhcnRoID0gbmV3IEVhcnRoKHRoaXMucmFkaXVzKTtcclxuICAgIHRoaXMuZWFydGguc2V0U2NlbmUodGhpcy5zY2VuZSk7XHJcblxyXG4gICAgaWYgKG9wdHMuZm9sbG93TGluZSkge1xyXG4gICAgICAgIHRoaXMuZm9sbG93TGluZSA9IG5ldyBGb2xsb3dMaW5lKHRoaXMuY2hyb25vRGF0YSwgdGhpcy5yYWRpdXMpO1xyXG4gICAgICAgIHRoaXMuZm9sbG93TGluZS5zZXRTY2VuZSh0aGlzLnNjZW5lKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5zZXR1cFJlbmRlcmVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoe2FscGhhOiB0cnVlLCBhbnRpYWxpYXM6IHRydWV9KTtcclxuICAgIHRoaXMucmVuZGVyZXIuc2V0U2l6ZSh3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcclxuICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCk7XHJcbiAgICB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuaWQgPSAnY2dyLWNocm9ub0RhdGEnO1xyXG5cclxuICAgIHRoaXMuZWZmZWN0ID0gbmV3IFRIUkVFLlN0ZXJlb0VmZmVjdCh0aGlzLnJlbmRlcmVyKTtcclxuICAgIHRoaXMuZWZmZWN0LnNldFNpemUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLm9uV2luZG93UmVzaXplID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLndpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XHJcbiAgICB0aGlzLmhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcclxuXHJcbiAgICB0aGlzLmNhbWVyYS5hc3BlY3QgPSB0aGlzLndpZHRoIC8gdGhpcy5oZWlnaHQ7XHJcbiAgICB0aGlzLmNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XHJcblxyXG4gICAgdGhpcy5yZW5kZXJlci5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcclxuICAgIHRoaXMuZWZmZWN0LnNldFNpemUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnNldE9yaWVudGF0aW9uQ29udHJvbHMgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY29udHJvbHMgPSB0aGlzLmRldmljZU9yYml0Q29udHJvbHM7XHJcbiAgICB0aGlzLm9yYml0Q29udHJvbHMuZW5hYmxlZCA9IGZhbHNlO1xyXG4gICAgdGhpcy5kZXZpY2VPcmJpdENvbnRyb2xzLmVuYWJsZWQgPSB0cnVlO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnNldE9yYml0Q29udHJvbHMgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY29udHJvbHMgPSB0aGlzLm9yYml0Q29udHJvbHM7XHJcbiAgICB0aGlzLm9yYml0Q29udHJvbHMuZW5hYmxlZCA9IHRydWU7XHJcbiAgICB0aGlzLmRldmljZU9yYml0Q29udHJvbHMuZW5hYmxlZCA9IGZhbHNlO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLmVudGVyVlIgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMudnIgPSB0cnVlO1xyXG4gICAgdGhpcy5mdWxsc2NyZWVuKCk7XHJcbiAgICB0aGlzLnNldE9yaWVudGF0aW9uQ29udHJvbHMoKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5sZWF2ZVZSID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnZyID0gZmFsc2U7XHJcbiAgICB0aGlzLnNldE9yYml0Q29udHJvbHMoKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5mdWxsc2NyZWVuID0gZnVuY3Rpb24oKSB7XHJcbiAgICBpZiAodGhpcy5jb250YWluZXIucmVxdWVzdEZ1bGxzY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lci5yZXF1ZXN0RnVsbHNjcmVlbigpO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnRhaW5lci5tc1JlcXVlc3RGdWxsc2NyZWVuKSB7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIubXNSZXF1ZXN0RnVsbHNjcmVlbigpO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnRhaW5lci5tb3pSZXF1ZXN0RnVsbFNjcmVlbikge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLm1velJlcXVlc3RGdWxsU2NyZWVuKCk7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29udGFpbmVyLndlYmtpdFJlcXVlc3RGdWxsc2NyZWVuKSB7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIud2Via2l0UmVxdWVzdEZ1bGxzY3JlZW4oKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgdGFyZ2V0T3JpZW50YXRpb24gPSBbJ2xhbmRzY2FwZSddO1xyXG4gICAgaWYgKHNjcmVlbi5sb2NrT3JpZW50YXRpb24pIHtcclxuICAgICAgICBzY3JlZW4ubG9ja09yaWVudGF0aW9uKHRhcmdldE9yaWVudGF0aW9uKTtcclxuICAgIH0gZWxzZSBpZiAoc2NyZWVuLm1vekxvY2tPcmllbnRhdGlvbikge1xyXG4gICAgICAgIHNjcmVlbi5tb3pMb2NrT3JpZW50YXRpb24odGFyZ2V0T3JpZW50YXRpb24pO1xyXG4gICAgfSBlbHNlIGlmIChzY3JlZW4ubXNMb2NrT3JpZW50YXRpb24pIHtcclxuICAgICAgICBzY3JlZW4ubXNMb2NrT3JpZW50YXRpb24odGFyZ2V0T3JpZW50YXRpb24pO1xyXG4gICAgfSBlbHNlIGlmIChzY3JlZW4ub3JpZW50YXRpb24ubG9jaykge1xyXG4gICAgICAgIHNjcmVlbi5vcmllbnRhdGlvbi5sb2NrKHRhcmdldE9yaWVudGF0aW9uKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5zZXR1cFNjZW5lID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XHJcblxyXG4gICAgdGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoNzUsXHJcbiAgICAgIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAxLCAzMDAwMCk7XHJcbiAgICB0aGlzLmNhbWVyYS5wb3NpdGlvbi56ID0gLSh0aGlzLnJhZGl1cyAqIDEuNSk7XHJcbiAgICB0aGlzLmNhbWVyYS5wb3NpdGlvbi55ID0gdGhpcy5yYWRpdXMgKiAxLjI7XHJcbiAgICB0aGlzLmNhbWVyYS5sb29rQXQodGhpcy5zY2VuZS5wb3NpdGlvbik7XHJcblxyXG4gICAgdGhpcy5kZXZpY2VPcmJpdENvbnRyb2xzID0gbmV3IERldmljZU9yYml0Q29udHJvbHModGhpcy5jYW1lcmEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJhZGl1cyAqIDIuMCk7XHJcblxyXG4gICAgdGhpcy5vcmJpdENvbnRyb2xzID0gbmV3IFRIUkVFLk9yYml0Q29udHJvbHModGhpcy5jYW1lcmEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQpO1xyXG4gICAgdGhpcy5vcmJpdENvbnRyb2xzLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xyXG4gICAgdGhpcy5vcmJpdENvbnRyb2xzLm5vUGFuID0gdHJ1ZTtcclxuICAgIHRoaXMub3JiaXRDb250cm9scy5yb3RhdGVTcGVlZCA9IDAuNTtcclxuXHJcbiAgICB0aGlzLnNldE9yYml0Q29udHJvbHMoKTtcclxuXHJcbiAgICB2YXIgYW1iaWVudExpZ2h0ID0gbmV3IFRIUkVFLkFtYmllbnRMaWdodCgweDg4ODg4OCk7XHJcbiAgICB0aGlzLnNjZW5lLmFkZChhbWJpZW50TGlnaHQpO1xyXG5cclxuICAgIHZhciBkaXJMaWdodCA9IG5ldyBUSFJFRS5EaXJlY3Rpb25hbExpZ2h0KDB4Y2NjY2NjLCAwLjIpO1xyXG4gICAgZGlyTGlnaHQucG9zaXRpb24uc2V0KDUsIDMsIDUpO1xyXG4gICAgdGhpcy5zY2VuZS5hZGQoZGlyTGlnaHQpO1xyXG5cclxuICAgIHRoaXMuY2xvY2sgPSBuZXcgVEhSRUUuQ2xvY2soKTtcclxuXHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgdGhpcy5vbldpbmRvd1Jlc2l6ZS5iaW5kKHRoaXMpLCBmYWxzZSk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgZHQgPSB0aGlzLmNsb2NrLmdldERlbHRhKCk7XHJcblxyXG4gICAgdGhpcy5jaHJvbm9Db250cm9scy51cGRhdGUoZHQpO1xyXG4gICAgdGhpcy5jaHJvbm9EYXRhLnNldFRpbWUodGhpcy5jaHJvbm9Db250cm9scy5nZXRUaW1lKCkpO1xyXG5cclxuICAgIHRoaXMuY2hyb25vRGF0YS51cGRhdGUoZHQpO1xyXG4gICAgaWYgKHRoaXMuZm9sbG93TGluZSkge1xyXG4gICAgICAgIHRoaXMuZm9sbG93TGluZS51cGRhdGUoZHQpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY29udHJvbHMudXBkYXRlKGR0KTtcclxuICAgIHRoaXMucmVuZGVyKCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnJlbmRlcmVyLmNsZWFyKCk7XHJcblxyXG4gICAgaWYgKHRoaXMudnIpIHtcclxuICAgICAgICB0aGlzLmVmZmVjdC5yZW5kZXIodGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLnJlbmRlcmVyLnJlbmRlcih0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDaHJvbm9ncmFwaGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRGV2aWNlT3JiaXRDb250cm9scyA9IGZ1bmN0aW9uKGNhbWVyYSwgcmFkaXVzKSB7XHJcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5jYW1lcmEgPSBjYW1lcmE7XHJcbiAgICB0aGlzLnJhZGl1cyA9IHJhZGl1cztcclxuXHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZGV2aWNlb3JpZW50YXRpb24nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0T3JpZW50YXRpb24uYmluZCh0aGlzKSwgZmFsc2UpO1xyXG59O1xyXG5cclxuXHJcbkRldmljZU9yYml0Q29udHJvbHMucHJvdG90eXBlLnNldE9yaWVudGF0aW9uID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgIGlmICghdGhpcy5lbmFibGVkKSB7IHJldHVybjsgfVxyXG5cclxuICAgIHZhciBkZWcycmFkID0gTWF0aC5QSSAvIDE4MC4wO1xyXG4gICAgdmFyIGFscGhhID0gLSgoZXZlbnQuYWxwaGEpICogZGVnMnJhZCk7XHJcbiAgICB2YXIgZ2FtbWEgPSAgKChldmVudC5nYW1tYSArIDkwKSAqIGRlZzJyYWQpO1xyXG5cclxuICAgIHZhciB4ID0gdGhpcy5yYWRpdXMgKiBNYXRoLmNvcyhnYW1tYSkgKiBNYXRoLmNvcyhhbHBoYSk7XHJcbiAgICB2YXIgeSA9IHRoaXMucmFkaXVzICogTWF0aC5zaW4oZ2FtbWEpO1xyXG4gICAgdmFyIHogPSB0aGlzLnJhZGl1cyAqIE1hdGguY29zKGdhbW1hKSAqIE1hdGguc2luKGFscGhhKTtcclxuXHJcbiAgICB0aGlzLmNhbWVyYS5wb3NpdGlvbi5zZXQoeCwgeSwgeik7XHJcbiAgICB0aGlzLmNhbWVyYS5sb29rQXQobmV3IFRIUkVFLlZlY3RvcjMoMC4wLCAwLjAsIDAuMCkpO1xyXG59O1xyXG5cclxuXHJcbkRldmljZU9yYml0Q29udHJvbHMucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IERldmljZU9yYml0Q29udHJvbHM7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBFYXJ0aCA9IGZ1bmN0aW9uKHJhZGl1cykge1xyXG4gICAgdmFyIGVhcnRoR2VvbWV0cnkgPSBuZXcgVEhSRUUuU3BoZXJlR2VvbWV0cnkocmFkaXVzLCA4MCwgNjApO1xyXG4gICAgdmFyIGVhcnRoTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaFBob25nTWF0ZXJpYWwoe1xyXG4gICAgICBtYXA6IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX2RpZmZ1c2VfNGsuanBnJylcclxuICAgICAgLy8gbWFwOiB0aGlzLmxvYWRUZXh0dXJlKCdlYXJ0aF9kaWZmdXNlX25pZ2h0XzRrLmpwZycpXHJcbiAgICB9KTtcclxuXHJcbiAgICBlYXJ0aE1hdGVyaWFsLmJ1bXBNYXAgPSB0aGlzLmxvYWRUZXh0dXJlKCdlYXJ0aF9idW1wXzRrLmpwZycpO1xyXG4gICAgZWFydGhNYXRlcmlhbC5idW1wU2NhbGUgPSByYWRpdXMgLyAyLjA7XHJcbiAgICBlYXJ0aE1hdGVyaWFsLnNwZWN1bGFyTWFwID0gdGhpcy5sb2FkVGV4dHVyZSgnZWFydGhfc3BlY3VsYXJfMmsuanBnJyk7XHJcbiAgICBlYXJ0aE1hdGVyaWFsLnNwZWN1bGFyID0gbmV3IFRIUkVFLkNvbG9yKDB4M0EzQTNBKTtcclxuXHJcbiAgICB0aGlzLmVhcnRoTWVzaCA9IG5ldyBUSFJFRS5NZXNoKGVhcnRoR2VvbWV0cnksIGVhcnRoTWF0ZXJpYWwpO1xyXG4gICAgdGhpcy5lYXJ0aE1lc2gucm90YXRpb24ueSA9IE1hdGguUEk7XHJcblxyXG4gICAgdmFyIGJvdW5kYXJpZXNNYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7XHJcbiAgICAgIG1hcDogdGhpcy5sb2FkVGV4dHVyZSgnZWFydGhfYm91bmRhcmllc18yay5wbmcnKSxcclxuICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXHJcbiAgICAgIG9wYWNpdHk6IDAuNVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5ib3VuZGFyaWVzTWVzaCA9IG5ldyBUSFJFRS5NZXNoKGVhcnRoR2VvbWV0cnksIGJvdW5kYXJpZXNNYXRlcmlhbCk7XHJcbiAgICB0aGlzLmJvdW5kYXJpZXNNZXNoLnJvdGF0aW9uLnkgPSBNYXRoLlBJO1xyXG59O1xyXG5cclxuXHJcbkVhcnRoLnByb3RvdHlwZS5zZXRTY2VuZSA9IGZ1bmN0aW9uKHNjZW5lKSB7XHJcbiAgICB0aGlzLnNjZW5lID0gc2NlbmU7XHJcbiAgICBzY2VuZS5hZGQodGhpcy5lYXJ0aE1lc2gpO1xyXG4gICAgc2NlbmUuYWRkKHRoaXMuYm91bmRhcmllc01lc2gpO1xyXG59O1xyXG5cclxuXHJcbkVhcnRoLnByb3RvdHlwZS5sb2FkVGV4dHVyZSA9IGZ1bmN0aW9uKHRleHR1cmVOYW1lKSB7XHJcbiAgICAvLyBUT0RPOiBjdXN0b21pemUgcGF0aCBvciBpbWFnZXMsIHRoaXMgcmVsYXRpdmUgcGF0aCBpcyBuYXN0eS5cclxuICAgIHJldHVybiBUSFJFRS5JbWFnZVV0aWxzLmxvYWRUZXh0dXJlKCcuLi8uLi9kaXN0L2ltYWdlcy8nICsgdGV4dHVyZU5hbWUpO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRWFydGg7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBGb2xsb3dMaW5lID0gZnVuY3Rpb24oY2hyb25vRGF0YSwgcmFkaXVzKSB7XHJcbiAgICB0aGlzLmNocm9ub0RhdGEgPSBjaHJvbm9EYXRhO1xyXG4gICAgdGhpcy5yYWRpdXMgPSByYWRpdXM7XHJcbiAgICB0aGlzLm1heFBvaW50cyA9IDEwMDA7XHJcblxyXG4gICAgdGhpcy5jdXJ2ZSA9IG5ldyBUSFJFRS5TcGxpbmVDdXJ2ZTMoW1xyXG4gICAgICBuZXcgVEhSRUUuVmVjdG9yMygwLDAsMCksXHJcbiAgICAgIG5ldyBUSFJFRS5WZWN0b3IzKDAsMCwwKVxyXG4gICAgXSk7XHJcblxyXG4gICAgdGhpcy5jdXJ2ZVBvaW50cyA9IFtdO1xyXG5cclxuICAgIHRoaXMuY3VydmVHZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xyXG4gICAgdGhpcy5jdXJ2ZUdlb21ldHJ5LnZlcnRpY2VzID0gdGhpcy5jdXJ2ZS5nZXRQb2ludHMoMjAwKTtcclxuXHJcbiAgICB0aGlzLmN1cnZlTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoIHsgY29sb3I6IDB4Y2NjY2NjIH0gKTtcclxuXHJcbiAgICB0aGlzLmxpbmUgPSBuZXcgVEhSRUUuTGluZSh0aGlzLmN1cnZlR2VvbWV0cnksIHRoaXMuY3VydmVNYXRlcmlhbCk7XHJcblxyXG4gICAgdGhpcy5kYXRhID0gY2hyb25vRGF0YS5nZXREYXRhKCk7XHJcbiAgICB0aGlzLmxhc3RUaW1lID0gY2hyb25vRGF0YS5nZXRNaW5UaW1lKCk7XHJcbiAgICB0aGlzLmN1cnJlbnREYXRhSW5kZXggPSAwO1xyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLnNldFNjZW5lID0gZnVuY3Rpb24oc2NlbmUpIHtcclxuICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcclxuICAgIHNjZW5lLmFkZCh0aGlzLmxpbmUpO1xyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGN1cnJlbnRUaW1lID0gdGhpcy5jaHJvbm9EYXRhLmdldEN1cnJlbnRUaW1lKCk7XHJcblxyXG4gICAgaWYgKGN1cnJlbnRUaW1lIDwgdGhpcy5sYXN0VGltZSkge1xyXG4gICAgICAgIHRoaXMucmVzZXQoY3VycmVudFRpbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHdoaWxlIChjdXJyZW50VGltZSA+IHRoaXMuZGF0YVt0aGlzLmN1cnJlbnREYXRhSW5kZXhdLnRpbWUpIHtcclxuICAgICAgICB0aGlzLmN1cnJlbnREYXRhSW5kZXgrKztcclxuICAgICAgICB0aGlzLmFkZFBvaW50KCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5sYXN0VGltZSA9IGN1cnJlbnRUaW1lO1xyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oY3VycmVudFRpbWUpIHtcclxuICAgIHRoaXMuY3VydmVQb2ludHMgPSBbXTtcclxuICAgIHRoaXMuY3VycmVudERhdGFJbmRleCA9IDA7XHJcblxyXG4gICAgd2hpbGUgKGN1cnJlbnRUaW1lID4gdGhpcy5kYXRhW3RoaXMuY3VycmVudERhdGFJbmRleF0udGltZSkge1xyXG4gICAgICAgIHRoaXMuY3VycmVudERhdGFJbmRleCsrO1xyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbkZvbGxvd0xpbmUucHJvdG90eXBlLmFkZFBvaW50ID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgbmV4dFBvc2l0aW9uID0gdGhpcy5kYXRhW3RoaXMuY3VycmVudERhdGFJbmRleF0ucG9zaXRpb247XHJcbiAgICB0aGlzLmN1cnZlUG9pbnRzLnB1c2gobmV3IFRIUkVFLlZlY3RvcjMobmV4dFBvc2l0aW9uWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRQb3NpdGlvblsxXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXh0UG9zaXRpb25bMl0pKTtcclxuICAgIGlmICh0aGlzLmN1cnZlUG9pbnRzLmxlbmd0aCA+IHRoaXMubWF4UG9pbnRzKSB7XHJcbiAgICAgICAgdGhpcy5jdXJ2ZVBvaW50cy5zaGlmdCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY3VydmUgPSBuZXcgVEhSRUUuU3BsaW5lQ3VydmUzKHRoaXMuY3VydmVQb2ludHMpO1xyXG5cclxuICAgIHRoaXMuY3VydmVHZW9tZXRyeS52ZXJ0aWNlcyA9IHRoaXMuY3VydmUuZ2V0UG9pbnRzKHRoaXMubWF4UG9pbnRzICogMyk7XHJcbiAgICB0aGlzLmxpbmUuZ2VvbWV0cnkudmVydGljZXNOZWVkVXBkYXRlID0gdHJ1ZTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEZvbGxvd0xpbmU7XHJcbiIsIi8vIEVudHJ5IHBvaW50IGZvciBidWlsZGluZy5cclxuXHJcbnZhciBDaHJvbm9ncmFwaGVyID0gcmVxdWlyZSgnLi9DaHJvbm9ncmFwaGVyJyk7XHJcblxyXG53aW5kb3cuQ2hyb25vZ3JhcGhlciA9IENocm9ub2dyYXBoZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBjaHJvbm9kYXRhRnJhZ21lbnQgPSAnJyArXHJcbiAgICAndW5pZm9ybSBzYW1wbGVyMkQgcGFydGljbGVUZXh0dXJlOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndmFyeWluZyBmbG9hdCB0OyBcXG4nICtcclxuICAgICd2YXJ5aW5nIHZlYzMgdGltZUNvbG9yOyBcXG4nICtcclxuICAgICd2YXJ5aW5nIGZsb2F0IHRpbWVBbHBoYTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3ZvaWQgbWFpbigpIHsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHRleHR1cmVBbHBoYSA9IHRleHR1cmUyRChwYXJ0aWNsZVRleHR1cmUsIGdsX1BvaW50Q29vcmQpLmE7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBhbHBoYSA9IHRleHR1cmVBbHBoYSAqIHRpbWVBbHBoYTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICB2ZWMzIGNvbG9yID0gdGltZUNvbG9yOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoY29sb3IsIGFscGhhKTsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcnO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBjaHJvbm9kYXRhRnJhZ21lbnQ7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBjaHJvbm9kYXRhVmVydGV4ID0gJycgK1xyXG4gICAgJ2F0dHJpYnV0ZSBmbG9hdCBwb2ludFRpbWU7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1pblRpbWU7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWF4VGltZTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCB2aXN1YWxpemF0aW9uVGltZTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBwZXJjZW50SGlnaGxpZ2h0UmFuZ2U7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1pbkFscGhhOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1heEFscGhhOyBcXG4nICtcclxuICAgICd1bmlmb3JtIHZlYzMgbWluQ29sb3I7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gdmVjMyBtYXhDb2xvcjsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBtaW5TaXplOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1heFNpemU7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd2YXJ5aW5nIGZsb2F0IHQ7IFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgZmxvYXQgdGltZUFscGhhOyBcXG4nICtcclxuICAgICd2YXJ5aW5nIHZlYzMgdGltZUNvbG9yOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnZmxvYXQgbGVycChmbG9hdCBtaW5WYWx1ZSwgZmxvYXQgbWF4VmFsdWUsIGZsb2F0IHQpIHsgXFxuJyArXHJcbiAgICAnICAgIHJldHVybiAobWluVmFsdWUgKiAoMS4wIC0gdCkpICsgKG1heFZhbHVlICogdCk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ2Zsb2F0IGludmVyc2VMZXJwKGZsb2F0IHZhbHVlLCBmbG9hdCBtaW5WYWx1ZSwgZmxvYXQgbWF4VmFsdWUpIHsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHZhbHVlUmFuZ2UgPSBtYXhWYWx1ZSAtIG1pblZhbHVlOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgaW52ZXJzZUxlcnBlZCA9ICh2YWx1ZSAtIG1pblZhbHVlKSAvIHZhbHVlUmFuZ2U7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBjbGFtcGVkID0gY2xhbXAoaW52ZXJzZUxlcnBlZCwgMC4wLCAxLjApOyBcXG4nICtcclxuICAgICcgICAgcmV0dXJuIGludmVyc2VMZXJwZWQ7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJy8vIFJHQiB0byBIU1YgYW5kIEhTViB0byBSR0IgXFxuJyArXHJcbiAgICAnLy8gc291cmNlOiBodHRwOi8vbG9sZW5naW5lLm5ldC9ibG9nLzIwMTMvMDcvMjcvcmdiLXRvLWhzdi1pbi1nbHNsIFxcbicgK1xyXG4gICAgJ3ZlYzMgcmdiMmhzdih2ZWMzIGMpIHsgXFxuJyArXHJcbiAgICAnICAgIHZlYzQgSyA9IHZlYzQoMC4wLCAtMS4wIC8gMy4wLCAyLjAgLyAzLjAsIC0xLjApOyBcXG4nICtcclxuICAgICcgICAgdmVjNCBwID0gYy5nIDwgYy5iID8gdmVjNChjLmJnLCBLLnd6KSA6IHZlYzQoYy5nYiwgSy54eSk7IFxcbicgK1xyXG4gICAgJyAgICB2ZWM0IHEgPSBjLnIgPCBwLnggPyB2ZWM0KHAueHl3LCBjLnIpIDogdmVjNChjLnIsIHAueXp4KTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBkID0gcS54IC0gbWluKHEudywgcS55KTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGUgPSAxLjBlLTEwOyBcXG4nICtcclxuICAgICcgICAgcmV0dXJuIHZlYzMoYWJzKHEueiArIChxLncgLSBxLnkpIC8gKDYuMCAqIGQgKyBlKSksIGQgLyAocS54ICsgZSksIHEueCk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3ZlYzMgaHN2MnJnYih2ZWMzIGMpIHsgXFxuJyArXHJcbiAgICAnICAgIHZlYzQgSyA9IHZlYzQoMS4wLCAyLjAgLyAzLjAsIDEuMCAvIDMuMCwgMy4wKTsgXFxuJyArXHJcbiAgICAnICAgIHZlYzMgcCA9IGFicyhmcmFjdChjLnh4eCArIEsueHl6KSAqIDYuMCAtIEsud3d3KTsgXFxuJyArXHJcbiAgICAnICAgIHJldHVybiBjLnogKiBtaXgoSy54eHgsIGNsYW1wKHAgLSBLLnh4eCwgMC4wLCAxLjApLCBjLnkpOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndm9pZCBtYWluKCkgeyBcXG4nICtcclxuICAgICcgICAgdmVjNCBtdlBvc2l0aW9uID0gdmlld01hdHJpeCAqIHZlYzQocG9zaXRpb24sIDEuMCk7IFxcbicgK1xyXG4gICAgJyAgICBnbF9Qb3NpdGlvbiA9IHByb2plY3Rpb25NYXRyaXggKiBtdlBvc2l0aW9uOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHZlcnRleFBlcmNlbnQgPSBpbnZlcnNlTGVycChwb2ludFRpbWUsIG1pblRpbWUsIG1heFRpbWUpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgdmlzUGVyY2VudCA9IGludmVyc2VMZXJwKHZpc3VhbGl6YXRpb25UaW1lLCBtaW5UaW1lLCBtYXhUaW1lKTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHBlcmNlbnREaWZmZXJlbmNlID0gYWJzKHZlcnRleFBlcmNlbnQgLSB2aXNQZXJjZW50KTsgXFxuJyArXHJcbiAgICAnICAgIC8vIFNjYWxlIGRpZmZlcmVuY2UgYmFzZWQgb24gaGlnaGxpZ2h0IHJhbmdlIGludG8gYW4gaW50ZXJwb2xhdGlvbiB0aW1lLiBcXG4nICtcclxuICAgICcgICAgdCA9IGNsYW1wKDEuMCAtIHBlcmNlbnREaWZmZXJlbmNlIC8gcGVyY2VudEhpZ2hsaWdodFJhbmdlLCAwLjAsIDEuMCk7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgZ2xfUG9pbnRTaXplID0gbGVycChtaW5TaXplLCBtYXhTaXplLCB0KTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICB0aW1lQWxwaGEgPSBsZXJwKG1pbkFscGhhLCBtYXhBbHBoYSwgdCk7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgdmVjMyBtaW5IU1YgPSByZ2IyaHN2KG1pbkNvbG9yKTsgXFxuJyArXHJcbiAgICAnICAgIHZlYzMgbWF4SFNWID0gcmdiMmhzdihtYXhDb2xvcik7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBoID0gbGVycChtaW5IU1YueCwgbWF4SFNWLngsIHQpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgcyA9IGxlcnAobWluSFNWLnksIG1heEhTVi55LCB0KTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHYgPSBsZXJwKG1pbkhTVi56LCBtYXhIU1YueiwgdCk7IFxcbicgK1xyXG4gICAgJyAgICB0aW1lQ29sb3IgPSBoc3YycmdiKHZlYzMoaCwgcywgdikpOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGNocm9ub2RhdGFWZXJ0ZXg7XHJcbiJdfQ==
