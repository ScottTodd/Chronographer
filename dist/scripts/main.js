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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwic3JjXFxqc1xcQ2hyb25vQ29udHJvbHMuanMiLCJzcmNcXGpzXFxDaHJvbm9EYXRhLmpzIiwic3JjXFxqc1xcQ2hyb25vZ3JhcGhlci5qcyIsInNyY1xcanNcXERldmljZU9yYml0Q29udHJvbHMuanMiLCJzcmNcXGpzXFxFYXJ0aC5qcyIsInNyY1xcanNcXEZvbGxvd0xpbmUuanMiLCJzcmNcXGpzXFxtYWluLmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YUZyYWdtZW50LmpzIiwic3JjXFxqc1xcc2hhZGVyc1xcY2hyb25vZGF0YVZlcnRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIENocm9ub0NvbnRyb2xzID0gZnVuY3Rpb24oY2hyb25vZ3JhcGhlciwgY29udGFpbmVyLCBvcHRzKSB7XHJcbiAgICB0aGlzLmNocm9ub2dyYXBoZXIgPSBjaHJvbm9ncmFwaGVyO1xyXG4gICAgdGhpcy50b3RhbFBsYXlUaW1lID0gKG9wdHMgJiYgb3B0cy5wbGF5VGltZSkgfHwgMTAuMDtcclxuICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcclxuICAgIHRoaXMubG9vcCA9IHRydWU7XHJcbiAgICB0aGlzLmRhdGVGb3JtYXQgPSAob3B0cyAmJiBvcHRzLmRhdGVGb3JtYXQpIHx8ICdzdHJpbmcnO1xyXG5cclxuICAgIC8vIENyZWF0ZSBjb250cm9scyBmcm9tIGltcG9ydGVkIGh0bWwuXHJcbiAgICB2YXIgY29udGVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2xpbmtbcmVsPVwiaW1wb3J0XCJdJykuaW1wb3J0O1xyXG4gICAgdmFyIGNvbnRyb2xzID0gY29udGVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWNvbnRyb2xzLXJvb3QnKTtcclxuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChjb250cm9scyk7XHJcblxyXG4gICAgdGhpcy5jb250cm9scyAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby1jb250cm9scycpO1xyXG4gICAgdGhpcy52ckNvbnRyb2xzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nocm9uby12ci1jb250cm9scycpO1xyXG5cclxuICAgIHRoaXMucGxheVBhdXNlICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tcGxheVBhdXNlQnV0dG9uJyk7XHJcbiAgICB0aGlzLmVudGVyVlIgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWVudGVyVlJCdXR0b24nKTtcclxuICAgIHRoaXMudGltZUlucHV0ICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tdGltZUlucHV0Jyk7XHJcbiAgICB0aGlzLmRhdGVCb3ggICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLWRhdGVCb3gnKTtcclxuICAgIHRoaXMudnJEYXRlQm94MSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaHJvbm8tdnItZGF0ZUJveC0xJyk7XHJcbiAgICB0aGlzLnZyRGF0ZUJveDIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hyb25vLXZyLWRhdGVCb3gtMicpO1xyXG5cclxuICAgIC8vIExpc3RlbiB0byBwbGF5L3BhdXNlIGV2ZW50cyAoYnV0dG9uIGNsaWNrIGFuZCBzcGFjZSBiYXIpLlxyXG4gICAgdGhpcy5wbGF5UGF1c2UuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmhhbmRsZVBsYXlQYXVzZS5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSk7XHJcbiAgICBkb2N1bWVudC5vbmtleXByZXNzID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gMzIpIHtcclxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgdGhpcy5oYW5kbGVQbGF5UGF1c2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQodGhpcyk7XHJcblxyXG4gICAgLy8gQWxzbyB1cGRhdGUgaWYgdGhlIGlucHV0IHNsaWRlciBpcyBjaGFuZ2VkIGRpcmVjdGx5LlxyXG4gICAgdGhpcy50aW1lSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCB0aGlzLm1hbnVhbFVwZGF0ZVRpbWUuYmluZCh0aGlzKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UpO1xyXG5cclxuICAgIHRoaXMuZW50ZXJWUi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuaGFuZGxlRW50ZXJWUi5iaW5kKHRoaXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UpO1xyXG5cclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdGZ1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vemZ1bGxzY3JlZW5jaGFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyLmJpbmQodGhpcyksIGZhbHNlKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuZ2V0VGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5zZXRUaW1lUmFuZ2UgPSBmdW5jdGlvbihtaW5UaW1lLCBtYXhUaW1lKSB7XHJcbiAgICB0aGlzLm1pblRpbWUgPSBtaW5UaW1lO1xyXG4gICAgdGhpcy5tYXhUaW1lID0gbWF4VGltZTtcclxuICAgIHRoaXMudGltZVJhbmdlID0gbWF4VGltZSAtIG1pblRpbWU7XHJcblxyXG4gICAgdGhpcy50aW1lSW5wdXQuc2V0QXR0cmlidXRlKCdtaW4nLCBtaW5UaW1lKTtcclxuICAgIHRoaXMudGltZUlucHV0LnNldEF0dHJpYnV0ZSgnbWF4JywgbWF4VGltZSk7XHJcbiAgICB0aGlzLnNldElucHV0VGltZShtaW5UaW1lKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUubWFudWFsVXBkYXRlVGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5zZXRQYXVzZWQodHJ1ZSk7XHJcbiAgICB0aGlzLnVwZGF0ZVRpbWVEaXNwbGF5KCk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLnNldElucHV0VGltZSA9IGZ1bmN0aW9uKGlucHV0VGltZSkge1xyXG4gICAgdmFyIGNsYW1wZWRWYWx1ZSA9IE1hdGgubWF4KE1hdGgubWluKGlucHV0VGltZSwgdGhpcy5tYXhUaW1lKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1pblRpbWUpO1xyXG4gICAgdGhpcy50aW1lSW5wdXQudmFsdWUgPSBjbGFtcGVkVmFsdWU7XHJcblxyXG4gICAgdGhpcy51cGRhdGVUaW1lRGlzcGxheSgpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS51cGRhdGVUaW1lRGlzcGxheSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGRhdGVWYWx1ZSA9ICcnO1xyXG4gICAgaWYgKHRoaXMuZGF0ZUZvcm1hdCA9PT0gJ3RpbWVzdGFtcCcpIHtcclxuICAgICAgICB2YXIgZGF0ZSA9IG5ldyBEYXRlKHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpKTtcclxuICAgICAgICBkYXRlVmFsdWUgPSB0aGlzLmdldEZvcm1hdHRlZERhdGUoZGF0ZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRhdGVWYWx1ZSA9IE1hdGgucm91bmQocGFyc2VGbG9hdCh0aGlzLnRpbWVJbnB1dC52YWx1ZSkpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZGF0ZUJveC50ZXh0Q29udGVudCA9IGRhdGVWYWx1ZTtcclxuICAgIHRoaXMudnJEYXRlQm94MS50ZXh0Q29udGVudCA9IGRhdGVWYWx1ZTtcclxuICAgIHRoaXMudnJEYXRlQm94Mi50ZXh0Q29udGVudCA9IGRhdGVWYWx1ZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuZ2V0Rm9ybWF0dGVkRGF0ZSA9IGZ1bmN0aW9uKGRhdGUpIHtcclxuICAgIHZhciB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xyXG4gICAgdmFyIG1vbnRoID0gKDEgKyBkYXRlLmdldE1vbnRoKCkpLnRvU3RyaW5nKCk7XHJcbiAgICBtb250aCA9IG1vbnRoLmxlbmd0aCA+IDEgPyBtb250aCA6ICcwJyArIG1vbnRoO1xyXG4gICAgdmFyIGRheSA9IGRhdGUuZ2V0RGF0ZSgpLnRvU3RyaW5nKCk7XHJcbiAgICBkYXkgPSBkYXkubGVuZ3RoID4gMSA/IGRheSA6ICcwJyArIGRheTtcclxuICAgIHJldHVybiB5ZWFyICsgJy8nICsgbW9udGggKyAnLycgKyBkYXk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmhhbmRsZVBsYXlQYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5sb29wID0gZmFsc2U7XHJcbiAgICB0aGlzLnNldFBhdXNlZCghdGhpcy5wYXVzZWQpO1xyXG4gICAgaWYgKHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpID49IHRoaXMubWF4VGltZSkge1xyXG4gICAgICAgIHRoaXMuc2V0UGF1c2VkKHRydWUpO1xyXG4gICAgICAgIHRoaXMuc2V0SW5wdXRUaW1lKHRoaXMubWluVGltZSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLnNldFBhdXNlZCA9IGZ1bmN0aW9uKHBhdXNlZCkge1xyXG4gICAgdGhpcy5wYXVzZWQgPSBwYXVzZWQ7XHJcbiAgICB0aGlzLnBsYXlQYXVzZS52YWx1ZSA9IHRoaXMucGF1c2VkID8gJ1BsYXknIDogJ1BhdXNlJztcclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUuaGFuZGxlRW50ZXJWUiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5jaHJvbm9ncmFwaGVyLmVudGVyVlIoKTtcclxuXHJcbiAgICB0aGlzLnNldFBhdXNlZChmYWxzZSk7XHJcbiAgICB0aGlzLmxvb3AgPSB0cnVlO1xyXG5cclxuICAgIHRoaXMuY29udHJvbHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgIHRoaXMudnJDb250cm9scy5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vQ29udHJvbHMucHJvdG90eXBlLmhhbmRsZUxlYXZlVlIgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY2hyb25vZ3JhcGhlci5sZWF2ZVZSKCk7XHJcblxyXG4gICAgdGhpcy5zZXRQYXVzZWQodHJ1ZSk7XHJcbiAgICB0aGlzLmxvb3AgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLmNvbnRyb2xzLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcclxuICAgIHRoaXMudnJDb250cm9scy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0NvbnRyb2xzLnByb3RvdHlwZS5mdWxsc2NyZWVuQ2hhbmdlSGFuZGxlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGZ1bGxzY3JlZW4gPSAoZG9jdW1lbnQud2Via2l0SXNGdWxsU2NyZWVuIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5tb3pGdWxsU2NyZWVuIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5tc0Z1bGxzY3JlZW5FbGVtZW50KTtcclxuXHJcbiAgICBpZiAoIWZ1bGxzY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmhhbmRsZUxlYXZlVlIoKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DaHJvbm9Db250cm9scy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZHQpIHtcclxuICAgIGlmICghdGhpcy5wYXVzZWQpIHtcclxuICAgICAgICAvLyBTY2FsZSBkdCB0byBjb3ZlciB0aGlzLnRpbWVSYW5nZSBvdmVyIHRoaXMudG90YWxQbGF5dGltZS5cclxuICAgICAgICB2YXIgZGVsdGFUaW1lID0gdGhpcy50aW1lUmFuZ2UgLyB0aGlzLnRvdGFsUGxheVRpbWUgKiBkdDtcclxuICAgICAgICB2YXIgbmV3VGltZSA9IHBhcnNlRmxvYXQodGhpcy50aW1lSW5wdXQudmFsdWUpICsgZGVsdGFUaW1lO1xyXG4gICAgICAgIHRoaXMuc2V0SW5wdXRUaW1lKG5ld1RpbWUpO1xyXG5cclxuICAgICAgICAvLyBFbmQgb2YgdGltZSByYW5nZT8gTG9vcCBiYWNrIHRvIHRoZSBzdGFydCBvciBwYXVzZS5cclxuICAgICAgICBpZiAobmV3VGltZSA+PSB0aGlzLm1heFRpbWUpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMubG9vcCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRJbnB1dFRpbWUodGhpcy5taW5UaW1lKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0UGF1c2VkKHRydWUpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5UGF1c2UudmFsdWUgPSAnUmVzdGFydCc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDaHJvbm9Db250cm9scztcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGNocm9ub2RhdGFWZXJ0ZXhTaGFkZXIgPSByZXF1aXJlKCcuL3NoYWRlcnMvY2hyb25vZGF0YVZlcnRleCcpO1xyXG52YXIgY2hyb25vZGF0YUZyYWdtZW50U2hhZGVyID0gcmVxdWlyZSgnLi9zaGFkZXJzL2Nocm9ub2RhdGFGcmFnbWVudCcpO1xyXG5cclxuXHJcbnZhciBDaHJvbm9EYXRhID0gZnVuY3Rpb24ocmFkaXVzLCBvcHRzKSB7XHJcbiAgICB0aGlzLnJhZGl1cyA9IHJhZGl1cztcclxuXHJcbiAgICBmdW5jdGlvbiBsb2FkVGV4dCh1cmwpIHtcclxuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgdXJsLCBmYWxzZSk7IC8vIFN5bmNocm9ub3VzLlxyXG4gICAgICAgIHJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZSgndGV4dC9wbGFpbicpO1xyXG4gICAgICAgIHJlcXVlc3Quc2VuZCgpO1xyXG5cclxuICAgICAgICByZXR1cm4gcmVxdWVzdC5yZXNwb25zZVRleHQ7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5kYXRhID0gW107XHJcbiAgICB2YXIgdGltZXMgPSBbXTtcclxuICAgIHRoaXMuZ2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcclxuICAgIHRoaXMubWluVGltZSA9IE51bWJlci5NQVhfVkFMVUU7XHJcbiAgICB0aGlzLm1heFRpbWUgPSAwO1xyXG5cclxuICAgIC8vIExvYWQgZGF0YSBmcm9tIGEganNvbiBmaWxlLlxyXG4gICAgdmFyIGxvY2F0aW9ucyA9IFtdO1xyXG4gICAgaWYgKG9wdHMgJiYgb3B0cy5kYXRhVVJMKSB7XHJcbiAgICAgICAgdmFyIGpzb25EYXRhID0gSlNPTi5wYXJzZShsb2FkVGV4dChvcHRzLmRhdGFVUkwpKTtcclxuICAgICAgICBsb2NhdGlvbnMgPSBqc29uRGF0YS5sb2NhdGlvbnM7XHJcbiAgICB9XHJcbiAgICBpZiAob3B0cyAmJiBvcHRzLmRhdGFKU09OKSB7XHJcbiAgICAgICAgbG9jYXRpb25zID0gb3B0cy5kYXRhSlNPTi5sb2NhdGlvbnM7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsb2NhdGlvbnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICB2YXIgdGltZXN0YW1wTXMgPSBwYXJzZUZsb2F0KGxvY2F0aW9uc1tpXS50aW1lc3RhbXBNcykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbnNbaV0uWWVhcjtcclxuXHJcbiAgICAgICAgdGhpcy5taW5UaW1lID0gTWF0aC5taW4odGltZXN0YW1wTXMsIHRoaXMubWluVGltZSk7XHJcbiAgICAgICAgdGhpcy5tYXhUaW1lID0gTWF0aC5tYXgodGltZXN0YW1wTXMsIHRoaXMubWF4VGltZSk7XHJcblxyXG4gICAgICAgIHZhciBsYXRpdHVkZSA9IGxvY2F0aW9uc1tpXS5sYXRpdHVkZUU3IC8gMTAwMDAwMDAuMCB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uc1tpXS5MYXRpdHVkZTtcclxuICAgICAgICB2YXIgbG9uZ2l0dWRlID0gbG9jYXRpb25zW2ldLmxvbmdpdHVkZUU3IC8gMTAwMDAwMDAuMCB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbnNbaV0uTG9uZ2l0dWRlO1xyXG5cclxuICAgICAgICB2YXIgZGVnMnJhZCA9IE1hdGguUEkgLyAxODAuMDtcclxuICAgICAgICB2YXIgcGhpID0gbGF0aXR1ZGUgKiBkZWcycmFkO1xyXG4gICAgICAgIHZhciB0aGV0YSA9ICgxODAgLSBsb25naXR1ZGUpICogZGVnMnJhZDtcclxuXHJcbiAgICAgICAgdmFyIHggPSAodGhpcy5yYWRpdXMgKiAxLjAxKSAqIE1hdGguY29zKHBoaSkgKiBNYXRoLmNvcyh0aGV0YSk7XHJcbiAgICAgICAgdmFyIHkgPSAodGhpcy5yYWRpdXMgKiAxLjAxKSAqIE1hdGguc2luKHBoaSk7XHJcbiAgICAgICAgdmFyIHogPSAodGhpcy5yYWRpdXMgKiAxLjAxKSAqIE1hdGguY29zKHBoaSkgKiBNYXRoLnNpbih0aGV0YSk7XHJcblxyXG4gICAgICAgIHRoaXMuZGF0YS5wdXNoKHtcclxuICAgICAgICAgICdsYXQnOiBsYXRpdHVkZSxcclxuICAgICAgICAgICdsb25nJzogbG9uZ2l0dWRlLFxyXG4gICAgICAgICAgJ3Bvc2l0aW9uJzogW3gsIHksIHpdLFxyXG4gICAgICAgICAgJ3RpbWUnOiB0aW1lc3RhbXBNc1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRpbWVzLnB1c2godGltZXN0YW1wTXMpO1xyXG5cclxuICAgICAgICB0aGlzLmdlb21ldHJ5LnZlcnRpY2VzLnB1c2gobmV3IFRIUkVFLlZlY3RvcjMoeCwgeSwgeikpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBhdHRyaWJ1dGVzID0ge1xyXG4gICAgICBwb2ludFRpbWU6IHsgdHlwZTogJ2YnLCB2YWx1ZTogdGltZXMgfVxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgdW5pZm9ybXMgPSB7XHJcbiAgICAgIHBhcnRpY2xlVGV4dHVyZToge1xyXG4gICAgICAgIHR5cGU6ICd0JyxcclxuICAgICAgICB2YWx1ZTogVEhSRUUuSW1hZ2VVdGlscy5sb2FkVGV4dHVyZSgnaW1hZ2VzL2NpcmNsZV9hbHBoYS5wbmcnKVxyXG4gICAgICB9LFxyXG4gICAgICB2aXN1YWxpemF0aW9uVGltZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogdGhpcy5taW5UaW1lXHJcbiAgICAgIH0sXHJcbiAgICAgIG1pblRpbWU6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IHRoaXMubWluVGltZVxyXG4gICAgICB9LFxyXG4gICAgICBtYXhUaW1lOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiB0aGlzLm1heFRpbWVcclxuICAgICAgfSxcclxuICAgICAgcGVyY2VudEhpZ2hsaWdodFJhbmdlOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLnBlcmNlbnRIaWdobGlnaHRSYW5nZSkgfHwgMC4xMFxyXG4gICAgICB9LFxyXG4gICAgICBtaW5BbHBoYToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5taW5BbHBoYSkgfHwgMS4wXHJcbiAgICAgIH0sXHJcbiAgICAgIG1heEFscGhhOiB7XHJcbiAgICAgICAgdHlwZTogJ2YnLFxyXG4gICAgICAgIHZhbHVlOiAob3B0cyAmJiBvcHRzLm1heEFscGhhKSB8fCAxLjBcclxuICAgICAgfSxcclxuICAgICAgbWluQ29sb3I6IHtcclxuICAgICAgICB0eXBlOiAnYycsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWluQ29sb3IpIHx8IG5ldyBUSFJFRS5Db2xvcigweDIyMjIyMilcclxuICAgICAgfSxcclxuICAgICAgbWF4Q29sb3I6IHtcclxuICAgICAgICB0eXBlOiAnYycsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWF4Q29sb3IpIHx8IG5ldyBUSFJFRS5Db2xvcigweEVFRUVFRSlcclxuICAgICAgfSxcclxuICAgICAgbWluU2l6ZToge1xyXG4gICAgICAgIHR5cGU6ICdmJyxcclxuICAgICAgICB2YWx1ZTogKG9wdHMgJiYgb3B0cy5taW5TaXplKSB8fCAxMi4wXHJcbiAgICAgIH0sXHJcbiAgICAgIG1heFNpemU6IHtcclxuICAgICAgICB0eXBlOiAnZicsXHJcbiAgICAgICAgdmFsdWU6IChvcHRzICYmIG9wdHMubWF4U2l6ZSkgfHwgMzIuMFxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuU2hhZGVyTWF0ZXJpYWwoe1xyXG4gICAgICBhdHRyaWJ1dGVzOiAgICAgYXR0cmlidXRlcyxcclxuICAgICAgdW5pZm9ybXM6ICAgICAgIHVuaWZvcm1zLFxyXG4gICAgICB2ZXJ0ZXhTaGFkZXI6ICAgY2hyb25vZGF0YVZlcnRleFNoYWRlcixcclxuICAgICAgZnJhZ21lbnRTaGFkZXI6IGNocm9ub2RhdGFGcmFnbWVudFNoYWRlcixcclxuICAgICAgdHJhbnNwYXJlbnQ6ICAgIHRydWUsXHJcbiAgICAgIGJsZW5kaW5nOiAgICAgICBUSFJFRS5Ob3JtYWxCbGVuZGluZyxcclxuICAgICAgZGVwdGhXcml0ZTogICAgIGZhbHNlXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnBhcnRpY2xlcyA9IG5ldyBUSFJFRS5Qb2ludENsb3VkKHRoaXMuZ2VvbWV0cnksIHRoaXMubWF0ZXJpYWwpO1xyXG4gICAgLy8gcGFydGljbGVzLnNvcnRQYXJ0aWNsZXMgPSB0cnVlO1xyXG5cclxuICAgIGZ1bmN0aW9uIGNvbXBhcmUoYSwgYikge1xyXG4gICAgICAgIGlmIChhLnRpbWUgPCBiLnRpbWUpIHsgcmV0dXJuIC0xOyB9XHJcbiAgICAgICAgaWYgKGEudGltZSA+IGIudGltZSkgeyByZXR1cm4gMTsgfVxyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgfVxyXG4gICAgdGhpcy5kYXRhLnNvcnQoY29tcGFyZSk7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuc2V0U2NlbmUgPSBmdW5jdGlvbihzY2VuZSkge1xyXG4gICAgdGhpcy5zY2VuZSA9IHNjZW5lO1xyXG4gICAgc2NlbmUuYWRkKHRoaXMucGFydGljbGVzKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcclxuXHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuc2V0VGltZSA9IGZ1bmN0aW9uKG5ld1RpbWUpIHtcclxuICAgIHRoaXMuY3VycmVudFRpbWUgPSBuZXdUaW1lO1xyXG4gICAgdGhpcy5tYXRlcmlhbC51bmlmb3Jtc1sndmlzdWFsaXphdGlvblRpbWUnXS52YWx1ZSA9IG5ld1RpbWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuZ2V0Q3VycmVudFRpbWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmN1cnJlbnRUaW1lO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub0RhdGEucHJvdG90eXBlLmdldE1pblRpbWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLm1pblRpbWU7XHJcbn07XHJcblxyXG5cclxuQ2hyb25vRGF0YS5wcm90b3R5cGUuZ2V0TWF4VGltZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMubWF4VGltZTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9EYXRhLnByb3RvdHlwZS5nZXREYXRhID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5kYXRhO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ2hyb25vRGF0YTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIENocm9ub0RhdGEgPSByZXF1aXJlKCcuL0Nocm9ub0RhdGEnKTtcclxudmFyIENocm9ub0NvbnRyb2xzID0gcmVxdWlyZSgnLi9DaHJvbm9Db250cm9scycpO1xyXG52YXIgRGV2aWNlT3JiaXRDb250cm9scyA9IHJlcXVpcmUoJy4vRGV2aWNlT3JiaXRDb250cm9scycpO1xyXG52YXIgRWFydGggPSByZXF1aXJlKCcuL0VhcnRoJyk7XHJcbnZhciBGb2xsb3dMaW5lID0gcmVxdWlyZSgnLi9Gb2xsb3dMaW5lJyk7XHJcblxyXG5cclxudmFyIENocm9ub2dyYXBoZXIgPSBmdW5jdGlvbihjb250YWluZXIsIG9wdHMpIHtcclxuICAgIGlmICghRGV0ZWN0b3Iud2ViZ2wpIHsgRGV0ZWN0b3IuYWRkR2V0V2ViR0xNZXNzYWdlKCk7IH1cclxuXHJcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcclxuICAgIHRoaXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcclxuICAgIHRoaXMuaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xyXG4gICAgdGhpcy5yYWRpdXMgPSAxMDAwO1xyXG5cclxuICAgIHRoaXMudnIgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLnNldHVwUmVuZGVyZXIoKTtcclxuICAgIHRoaXMuc2V0dXBTY2VuZSgpO1xyXG5cclxuICAgIHRoaXMuY2hyb25vRGF0YSA9IG5ldyBDaHJvbm9EYXRhKHRoaXMucmFkaXVzLCBvcHRzKTtcclxuICAgIHRoaXMuY2hyb25vRGF0YS5zZXRTY2VuZSh0aGlzLnNjZW5lKTtcclxuICAgIHZhciBtaW5UaW1lID0gdGhpcy5jaHJvbm9EYXRhLmdldE1pblRpbWUoKTtcclxuICAgIHZhciBtYXhUaW1lID0gdGhpcy5jaHJvbm9EYXRhLmdldE1heFRpbWUoKTtcclxuXHJcbiAgICB0aGlzLmNocm9ub0NvbnRyb2xzID0gbmV3IENocm9ub0NvbnRyb2xzKHRoaXMsIGNvbnRhaW5lciwgb3B0cyk7XHJcbiAgICB0aGlzLmNocm9ub0NvbnRyb2xzLnNldFRpbWVSYW5nZShtaW5UaW1lLCBtYXhUaW1lKTtcclxuXHJcbiAgICB0aGlzLmVhcnRoID0gbmV3IEVhcnRoKHRoaXMucmFkaXVzKTtcclxuICAgIHRoaXMuZWFydGguc2V0U2NlbmUodGhpcy5zY2VuZSk7XHJcblxyXG4gICAgaWYgKG9wdHMuZm9sbG93TGluZSkge1xyXG4gICAgICAgIHRoaXMuZm9sbG93TGluZSA9IG5ldyBGb2xsb3dMaW5lKHRoaXMuY2hyb25vRGF0YSwgdGhpcy5yYWRpdXMpO1xyXG4gICAgICAgIHRoaXMuZm9sbG93TGluZS5zZXRTY2VuZSh0aGlzLnNjZW5lKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5zZXR1cFJlbmRlcmVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoe2FscGhhOiB0cnVlLCBhbnRpYWxpYXM6IHRydWV9KTtcclxuICAgIHRoaXMucmVuZGVyZXIuc2V0U2l6ZSh3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcclxuICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCk7XHJcbiAgICB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuaWQgPSAnY2dyLWNocm9ub0RhdGEnO1xyXG5cclxuICAgIHRoaXMuZWZmZWN0ID0gbmV3IFRIUkVFLlN0ZXJlb0VmZmVjdCh0aGlzLnJlbmRlcmVyKTtcclxuICAgIHRoaXMuZWZmZWN0LnNldFNpemUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLm9uV2luZG93UmVzaXplID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLndpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XHJcbiAgICB0aGlzLmhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcclxuXHJcbiAgICB0aGlzLmNhbWVyYS5hc3BlY3QgPSB0aGlzLndpZHRoIC8gdGhpcy5oZWlnaHQ7XHJcbiAgICB0aGlzLmNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XHJcblxyXG4gICAgdGhpcy5yZW5kZXJlci5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcclxuICAgIHRoaXMuZWZmZWN0LnNldFNpemUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnNldE9yaWVudGF0aW9uQ29udHJvbHMgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY29udHJvbHMgPSB0aGlzLmRldmljZU9yYml0Q29udHJvbHM7XHJcbiAgICB0aGlzLm9yYml0Q29udHJvbHMuZW5hYmxlZCA9IGZhbHNlO1xyXG4gICAgdGhpcy5kZXZpY2VPcmJpdENvbnRyb2xzLmVuYWJsZWQgPSB0cnVlO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnNldE9yYml0Q29udHJvbHMgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY29udHJvbHMgPSB0aGlzLm9yYml0Q29udHJvbHM7XHJcbiAgICB0aGlzLm9yYml0Q29udHJvbHMuZW5hYmxlZCA9IHRydWU7XHJcbiAgICB0aGlzLmRldmljZU9yYml0Q29udHJvbHMuZW5hYmxlZCA9IGZhbHNlO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLmVudGVyVlIgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMudnIgPSB0cnVlO1xyXG4gICAgdGhpcy5mdWxsc2NyZWVuKCk7XHJcbiAgICB0aGlzLnNldE9yaWVudGF0aW9uQ29udHJvbHMoKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5sZWF2ZVZSID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnZyID0gZmFsc2U7XHJcbiAgICB0aGlzLnNldE9yYml0Q29udHJvbHMoKTtcclxufTtcclxuXHJcblxyXG5DaHJvbm9ncmFwaGVyLnByb3RvdHlwZS5mdWxsc2NyZWVuID0gZnVuY3Rpb24oKSB7XHJcbiAgICBpZiAodGhpcy5jb250YWluZXIucmVxdWVzdEZ1bGxzY3JlZW4pIHtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lci5yZXF1ZXN0RnVsbHNjcmVlbigpO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnRhaW5lci5tc1JlcXVlc3RGdWxsc2NyZWVuKSB7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIubXNSZXF1ZXN0RnVsbHNjcmVlbigpO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnRhaW5lci5tb3pSZXF1ZXN0RnVsbFNjcmVlbikge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLm1velJlcXVlc3RGdWxsU2NyZWVuKCk7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29udGFpbmVyLndlYmtpdFJlcXVlc3RGdWxsc2NyZWVuKSB7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIud2Via2l0UmVxdWVzdEZ1bGxzY3JlZW4oKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgdGFyZ2V0T3JpZW50YXRpb24gPSBbJ2xhbmRzY2FwZS1wcmltYXJ5JywgJ2xhbmRzY2FwZS1zZWNvbmRhcnknXTtcclxuICAgIGlmIChzY3JlZW4ubG9ja09yaWVudGF0aW9uKSB7XHJcbiAgICAgICAgc2NyZWVuLmxvY2tPcmllbnRhdGlvbih0YXJnZXRPcmllbnRhdGlvbik7XHJcbiAgICB9IGVsc2UgaWYgKHNjcmVlbi5tb3pMb2NrT3JpZW50YXRpb24pIHtcclxuICAgICAgICBzY3JlZW4ubW96TG9ja09yaWVudGF0aW9uKHRhcmdldE9yaWVudGF0aW9uKTtcclxuICAgIH0gZWxzZSBpZiAoc2NyZWVuLm1zTG9ja09yaWVudGF0aW9uKSB7XHJcbiAgICAgICAgc2NyZWVuLm1zTG9ja09yaWVudGF0aW9uKHRhcmdldE9yaWVudGF0aW9uKTtcclxuICAgIH0gZWxzZSBpZiAoc2NyZWVuLm9yaWVudGF0aW9uLmxvY2spIHtcclxuICAgICAgICBzY3JlZW4ub3JpZW50YXRpb24ubG9jayh0YXJnZXRPcmllbnRhdGlvbik7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuQ2hyb25vZ3JhcGhlci5wcm90b3R5cGUuc2V0dXBTY2VuZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xyXG5cclxuICAgIHRoaXMuY2FtZXJhID0gbmV3IFRIUkVFLlBlcnNwZWN0aXZlQ2FtZXJhKDc1LFxyXG4gICAgICB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgMSwgMzAwMDApO1xyXG4gICAgdGhpcy5jYW1lcmEucG9zaXRpb24ueiA9IC0odGhpcy5yYWRpdXMgKiAxLjUpO1xyXG4gICAgdGhpcy5jYW1lcmEucG9zaXRpb24ueSA9IHRoaXMucmFkaXVzICogMS4yO1xyXG4gICAgdGhpcy5jYW1lcmEubG9va0F0KHRoaXMuc2NlbmUucG9zaXRpb24pO1xyXG5cclxuICAgIHRoaXMuZGV2aWNlT3JiaXRDb250cm9scyA9IG5ldyBEZXZpY2VPcmJpdENvbnRyb2xzKHRoaXMuY2FtZXJhLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yYWRpdXMgKiAyLjApO1xyXG5cclxuICAgIHRoaXMub3JiaXRDb250cm9scyA9IG5ldyBUSFJFRS5PcmJpdENvbnRyb2xzKHRoaXMuY2FtZXJhLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5kb21FbGVtZW50KTtcclxuICAgIHRoaXMub3JiaXRDb250cm9scy5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLnJlbmRlci5iaW5kKHRoaXMpKTtcclxuICAgIHRoaXMub3JiaXRDb250cm9scy5ub1BhbiA9IHRydWU7XHJcbiAgICB0aGlzLm9yYml0Q29udHJvbHMucm90YXRlU3BlZWQgPSAwLjU7XHJcblxyXG4gICAgdGhpcy5zZXRPcmJpdENvbnRyb2xzKCk7XHJcblxyXG4gICAgdmFyIGFtYmllbnRMaWdodCA9IG5ldyBUSFJFRS5BbWJpZW50TGlnaHQoMHg4ODg4ODgpO1xyXG4gICAgdGhpcy5zY2VuZS5hZGQoYW1iaWVudExpZ2h0KTtcclxuXHJcbiAgICB2YXIgZGlyTGlnaHQgPSBuZXcgVEhSRUUuRGlyZWN0aW9uYWxMaWdodCgweGNjY2NjYywgMC4yKTtcclxuICAgIGRpckxpZ2h0LnBvc2l0aW9uLnNldCg1LCAzLCA1KTtcclxuICAgIHRoaXMuc2NlbmUuYWRkKGRpckxpZ2h0KTtcclxuXHJcbiAgICB0aGlzLmNsb2NrID0gbmV3IFRIUkVFLkNsb2NrKCk7XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHRoaXMub25XaW5kb3dSZXNpemUuYmluZCh0aGlzKSwgZmFsc2UpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGR0ID0gdGhpcy5jbG9jay5nZXREZWx0YSgpO1xyXG5cclxuICAgIHRoaXMuY2hyb25vQ29udHJvbHMudXBkYXRlKGR0KTtcclxuICAgIHRoaXMuY2hyb25vRGF0YS5zZXRUaW1lKHRoaXMuY2hyb25vQ29udHJvbHMuZ2V0VGltZSgpKTtcclxuXHJcbiAgICB0aGlzLmNocm9ub0RhdGEudXBkYXRlKGR0KTtcclxuICAgIGlmICh0aGlzLmZvbGxvd0xpbmUpIHtcclxuICAgICAgICB0aGlzLmZvbGxvd0xpbmUudXBkYXRlKGR0KTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNvbnRyb2xzLnVwZGF0ZShkdCk7XHJcbiAgICB0aGlzLnJlbmRlcigpO1xyXG59O1xyXG5cclxuXHJcbkNocm9ub2dyYXBoZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5yZW5kZXJlci5jbGVhcigpO1xyXG5cclxuICAgIGlmICh0aGlzLnZyKSB7XHJcbiAgICAgICAgdGhpcy5lZmZlY3QucmVuZGVyKHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5yZW5kZXJlci5yZW5kZXIodGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ2hyb25vZ3JhcGhlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIERldmljZU9yYml0Q29udHJvbHMgPSBmdW5jdGlvbihjYW1lcmEsIHJhZGl1cykge1xyXG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcclxuICAgIHRoaXMuY2FtZXJhID0gY2FtZXJhO1xyXG4gICAgdGhpcy5yYWRpdXMgPSByYWRpdXM7XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZW9yaWVudGF0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNldE9yaWVudGF0aW9uLmJpbmQodGhpcyksIGZhbHNlKTtcclxufTtcclxuXHJcblxyXG5EZXZpY2VPcmJpdENvbnRyb2xzLnByb3RvdHlwZS5zZXRPcmllbnRhdGlvbiA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICBpZiAoIXRoaXMuZW5hYmxlZCkgeyByZXR1cm47IH1cclxuXHJcbiAgICB2YXIgZGVnMnJhZCA9IE1hdGguUEkgLyAxODAuMDtcclxuICAgIHZhciBhbHBoYSA9IC0oKGV2ZW50LmFscGhhKSAqIGRlZzJyYWQpO1xyXG4gICAgdmFyIGdhbW1hID0gICgoZXZlbnQuZ2FtbWEgKyA5MCkgKiBkZWcycmFkKTtcclxuXHJcbiAgICB2YXIgeCA9IHRoaXMucmFkaXVzICogTWF0aC5jb3MoZ2FtbWEpICogTWF0aC5jb3MoYWxwaGEpO1xyXG4gICAgdmFyIHkgPSB0aGlzLnJhZGl1cyAqIE1hdGguc2luKGdhbW1hKTtcclxuICAgIHZhciB6ID0gdGhpcy5yYWRpdXMgKiBNYXRoLmNvcyhnYW1tYSkgKiBNYXRoLnNpbihhbHBoYSk7XHJcblxyXG4gICAgdGhpcy5jYW1lcmEucG9zaXRpb24uc2V0KHgsIHksIHopO1xyXG4gICAgdGhpcy5jYW1lcmEubG9va0F0KG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wLCAwLjApKTtcclxufTtcclxuXHJcblxyXG5EZXZpY2VPcmJpdENvbnRyb2xzLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcclxuXHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBEZXZpY2VPcmJpdENvbnRyb2xzO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRWFydGggPSBmdW5jdGlvbihyYWRpdXMpIHtcclxuICAgIHZhciBlYXJ0aEdlb21ldHJ5ID0gbmV3IFRIUkVFLlNwaGVyZUdlb21ldHJ5KHJhZGl1cywgODAsIDYwKTtcclxuICAgIHZhciBlYXJ0aE1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hQaG9uZ01hdGVyaWFsKHtcclxuICAgICAgbWFwOiB0aGlzLmxvYWRUZXh0dXJlKCdlYXJ0aF9kaWZmdXNlXzRrLmpwZycpXHJcbiAgICAgIC8vIG1hcDogdGhpcy5sb2FkVGV4dHVyZSgnZWFydGhfZGlmZnVzZV9uaWdodF80ay5qcGcnKVxyXG4gICAgfSk7XHJcblxyXG4gICAgZWFydGhNYXRlcmlhbC5idW1wTWFwID0gdGhpcy5sb2FkVGV4dHVyZSgnZWFydGhfYnVtcF80ay5qcGcnKTtcclxuICAgIGVhcnRoTWF0ZXJpYWwuYnVtcFNjYWxlID0gcmFkaXVzIC8gMi4wO1xyXG4gICAgZWFydGhNYXRlcmlhbC5zcGVjdWxhck1hcCA9IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX3NwZWN1bGFyXzJrLmpwZycpO1xyXG4gICAgZWFydGhNYXRlcmlhbC5zcGVjdWxhciA9IG5ldyBUSFJFRS5Db2xvcigweDNBM0EzQSk7XHJcblxyXG4gICAgdGhpcy5lYXJ0aE1lc2ggPSBuZXcgVEhSRUUuTWVzaChlYXJ0aEdlb21ldHJ5LCBlYXJ0aE1hdGVyaWFsKTtcclxuICAgIHRoaXMuZWFydGhNZXNoLnJvdGF0aW9uLnkgPSBNYXRoLlBJO1xyXG5cclxuICAgIHZhciBib3VuZGFyaWVzTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe1xyXG4gICAgICBtYXA6IHRoaXMubG9hZFRleHR1cmUoJ2VhcnRoX2JvdW5kYXJpZXNfMmsucG5nJyksXHJcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxyXG4gICAgICBvcGFjaXR5OiAwLjVcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYm91bmRhcmllc01lc2ggPSBuZXcgVEhSRUUuTWVzaChlYXJ0aEdlb21ldHJ5LCBib3VuZGFyaWVzTWF0ZXJpYWwpO1xyXG4gICAgdGhpcy5ib3VuZGFyaWVzTWVzaC5yb3RhdGlvbi55ID0gTWF0aC5QSTtcclxufTtcclxuXHJcblxyXG5FYXJ0aC5wcm90b3R5cGUuc2V0U2NlbmUgPSBmdW5jdGlvbihzY2VuZSkge1xyXG4gICAgdGhpcy5zY2VuZSA9IHNjZW5lO1xyXG4gICAgc2NlbmUuYWRkKHRoaXMuZWFydGhNZXNoKTtcclxuICAgIHNjZW5lLmFkZCh0aGlzLmJvdW5kYXJpZXNNZXNoKTtcclxufTtcclxuXHJcblxyXG5FYXJ0aC5wcm90b3R5cGUubG9hZFRleHR1cmUgPSBmdW5jdGlvbih0ZXh0dXJlTmFtZSkge1xyXG4gICAgLy8gVE9ETzogY3VzdG9taXplIHBhdGggb3IgaW1hZ2VzLCB0aGlzIHJlbGF0aXZlIHBhdGggaXMgbmFzdHkuXHJcbiAgICByZXR1cm4gVEhSRUUuSW1hZ2VVdGlscy5sb2FkVGV4dHVyZSgnLi4vLi4vZGlzdC9pbWFnZXMvJyArIHRleHR1cmVOYW1lKTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEVhcnRoO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRm9sbG93TGluZSA9IGZ1bmN0aW9uKGNocm9ub0RhdGEsIHJhZGl1cykge1xyXG4gICAgdGhpcy5jaHJvbm9EYXRhID0gY2hyb25vRGF0YTtcclxuICAgIHRoaXMucmFkaXVzID0gcmFkaXVzO1xyXG4gICAgdGhpcy5tYXhQb2ludHMgPSAxMDAwO1xyXG5cclxuICAgIHRoaXMuY3VydmUgPSBuZXcgVEhSRUUuU3BsaW5lQ3VydmUzKFtcclxuICAgICAgbmV3IFRIUkVFLlZlY3RvcjMoMCwwLDApLFxyXG4gICAgICBuZXcgVEhSRUUuVmVjdG9yMygwLDAsMClcclxuICAgIF0pO1xyXG5cclxuICAgIHRoaXMuY3VydmVQb2ludHMgPSBbXTtcclxuXHJcbiAgICB0aGlzLmN1cnZlR2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcclxuICAgIHRoaXMuY3VydmVHZW9tZXRyeS52ZXJ0aWNlcyA9IHRoaXMuY3VydmUuZ2V0UG9pbnRzKDIwMCk7XHJcblxyXG4gICAgdGhpcy5jdXJ2ZU1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKCB7IGNvbG9yOiAweGNjY2NjYyB9ICk7XHJcblxyXG4gICAgdGhpcy5saW5lID0gbmV3IFRIUkVFLkxpbmUodGhpcy5jdXJ2ZUdlb21ldHJ5LCB0aGlzLmN1cnZlTWF0ZXJpYWwpO1xyXG5cclxuICAgIHRoaXMuZGF0YSA9IGNocm9ub0RhdGEuZ2V0RGF0YSgpO1xyXG4gICAgdGhpcy5sYXN0VGltZSA9IGNocm9ub0RhdGEuZ2V0TWluVGltZSgpO1xyXG4gICAgdGhpcy5jdXJyZW50RGF0YUluZGV4ID0gMDtcclxufTtcclxuXHJcblxyXG5Gb2xsb3dMaW5lLnByb3RvdHlwZS5zZXRTY2VuZSA9IGZ1bmN0aW9uKHNjZW5lKSB7XHJcbiAgICB0aGlzLnNjZW5lID0gc2NlbmU7XHJcbiAgICBzY2VuZS5hZGQodGhpcy5saW5lKTtcclxufTtcclxuXHJcblxyXG5Gb2xsb3dMaW5lLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBjdXJyZW50VGltZSA9IHRoaXMuY2hyb25vRGF0YS5nZXRDdXJyZW50VGltZSgpO1xyXG5cclxuICAgIGlmIChjdXJyZW50VGltZSA8IHRoaXMubGFzdFRpbWUpIHtcclxuICAgICAgICB0aGlzLnJlc2V0KGN1cnJlbnRUaW1lKTtcclxuICAgIH1cclxuXHJcbiAgICB3aGlsZSAoY3VycmVudFRpbWUgPiB0aGlzLmRhdGFbdGhpcy5jdXJyZW50RGF0YUluZGV4XS50aW1lKSB7XHJcbiAgICAgICAgdGhpcy5jdXJyZW50RGF0YUluZGV4Kys7XHJcbiAgICAgICAgdGhpcy5hZGRQb2ludCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMubGFzdFRpbWUgPSBjdXJyZW50VGltZTtcclxufTtcclxuXHJcblxyXG5Gb2xsb3dMaW5lLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKGN1cnJlbnRUaW1lKSB7XHJcbiAgICB0aGlzLmN1cnZlUG9pbnRzID0gW107XHJcbiAgICB0aGlzLmN1cnJlbnREYXRhSW5kZXggPSAwO1xyXG5cclxuICAgIHdoaWxlIChjdXJyZW50VGltZSA+IHRoaXMuZGF0YVt0aGlzLmN1cnJlbnREYXRhSW5kZXhdLnRpbWUpIHtcclxuICAgICAgICB0aGlzLmN1cnJlbnREYXRhSW5kZXgrKztcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5Gb2xsb3dMaW5lLnByb3RvdHlwZS5hZGRQb2ludCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG5leHRQb3NpdGlvbiA9IHRoaXMuZGF0YVt0aGlzLmN1cnJlbnREYXRhSW5kZXhdLnBvc2l0aW9uO1xyXG4gICAgdGhpcy5jdXJ2ZVBvaW50cy5wdXNoKG5ldyBUSFJFRS5WZWN0b3IzKG5leHRQb3NpdGlvblswXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXh0UG9zaXRpb25bMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dFBvc2l0aW9uWzJdKSk7XHJcbiAgICBpZiAodGhpcy5jdXJ2ZVBvaW50cy5sZW5ndGggPiB0aGlzLm1heFBvaW50cykge1xyXG4gICAgICAgIHRoaXMuY3VydmVQb2ludHMuc2hpZnQoKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmN1cnZlID0gbmV3IFRIUkVFLlNwbGluZUN1cnZlMyh0aGlzLmN1cnZlUG9pbnRzKTtcclxuXHJcbiAgICB0aGlzLmN1cnZlR2VvbWV0cnkudmVydGljZXMgPSB0aGlzLmN1cnZlLmdldFBvaW50cyh0aGlzLm1heFBvaW50cyAqIDMpO1xyXG4gICAgdGhpcy5saW5lLmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWU7XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBGb2xsb3dMaW5lO1xyXG4iLCIvLyBFbnRyeSBwb2ludCBmb3IgYnVpbGRpbmcuXHJcblxyXG52YXIgQ2hyb25vZ3JhcGhlciA9IHJlcXVpcmUoJy4vQ2hyb25vZ3JhcGhlcicpO1xyXG5cclxud2luZG93LkNocm9ub2dyYXBoZXIgPSBDaHJvbm9ncmFwaGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgY2hyb25vZGF0YUZyYWdtZW50ID0gJycgK1xyXG4gICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHBhcnRpY2xlVGV4dHVyZTsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3ZhcnlpbmcgZmxvYXQgdDsgXFxuJyArXHJcbiAgICAndmFyeWluZyB2ZWMzIHRpbWVDb2xvcjsgXFxuJyArXHJcbiAgICAndmFyeWluZyBmbG9hdCB0aW1lQWxwaGE7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd2b2lkIG1haW4oKSB7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCB0ZXh0dXJlQWxwaGEgPSB0ZXh0dXJlMkQocGFydGljbGVUZXh0dXJlLCBnbF9Qb2ludENvb3JkKS5hOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgYWxwaGEgPSB0ZXh0dXJlQWxwaGEgKiB0aW1lQWxwaGE7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgdmVjMyBjb2xvciA9IHRpbWVDb2xvcjsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGNvbG9yLCBhbHBoYSk7IFxcbicgK1xyXG4gICAgJ30gXFxuJyArXHJcbiAgICAnJztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gY2hyb25vZGF0YUZyYWdtZW50O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgY2hyb25vZGF0YVZlcnRleCA9ICcnICtcclxuICAgICdhdHRyaWJ1dGUgZmxvYXQgcG9pbnRUaW1lOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBtaW5UaW1lOyBcXG4nICtcclxuICAgICd1bmlmb3JtIGZsb2F0IG1heFRpbWU7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgdmlzdWFsaXphdGlvblRpbWU7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgcGVyY2VudEhpZ2hsaWdodFJhbmdlOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBtaW5BbHBoYTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBtYXhBbHBoYTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSB2ZWMzIG1pbkNvbG9yOyBcXG4nICtcclxuICAgICd1bmlmb3JtIHZlYzMgbWF4Q29sb3I7IFxcbicgK1xyXG4gICAgJ3VuaWZvcm0gZmxvYXQgbWluU2l6ZTsgXFxuJyArXHJcbiAgICAndW5pZm9ybSBmbG9hdCBtYXhTaXplOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAndmFyeWluZyBmbG9hdCB0OyBcXG4nICtcclxuICAgICd2YXJ5aW5nIGZsb2F0IHRpbWVBbHBoYTsgXFxuJyArXHJcbiAgICAndmFyeWluZyB2ZWMzIHRpbWVDb2xvcjsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ2Zsb2F0IGxlcnAoZmxvYXQgbWluVmFsdWUsIGZsb2F0IG1heFZhbHVlLCBmbG9hdCB0KSB7IFxcbicgK1xyXG4gICAgJyAgICByZXR1cm4gKG1pblZhbHVlICogKDEuMCAtIHQpKSArIChtYXhWYWx1ZSAqIHQpOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICdmbG9hdCBpbnZlcnNlTGVycChmbG9hdCB2YWx1ZSwgZmxvYXQgbWluVmFsdWUsIGZsb2F0IG1heFZhbHVlKSB7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCB2YWx1ZVJhbmdlID0gbWF4VmFsdWUgLSBtaW5WYWx1ZTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IGludmVyc2VMZXJwZWQgPSAodmFsdWUgLSBtaW5WYWx1ZSkgLyB2YWx1ZVJhbmdlOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgY2xhbXBlZCA9IGNsYW1wKGludmVyc2VMZXJwZWQsIDAuMCwgMS4wKTsgXFxuJyArXHJcbiAgICAnICAgIHJldHVybiBpbnZlcnNlTGVycGVkOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcvLyBSR0IgdG8gSFNWIGFuZCBIU1YgdG8gUkdCIFxcbicgK1xyXG4gICAgJy8vIHNvdXJjZTogaHR0cDovL2xvbGVuZ2luZS5uZXQvYmxvZy8yMDEzLzA3LzI3L3JnYi10by1oc3YtaW4tZ2xzbCBcXG4nICtcclxuICAgICd2ZWMzIHJnYjJoc3YodmVjMyBjKSB7IFxcbicgK1xyXG4gICAgJyAgICB2ZWM0IEsgPSB2ZWM0KDAuMCwgLTEuMCAvIDMuMCwgMi4wIC8gMy4wLCAtMS4wKTsgXFxuJyArXHJcbiAgICAnICAgIHZlYzQgcCA9IGMuZyA8IGMuYiA/IHZlYzQoYy5iZywgSy53eikgOiB2ZWM0KGMuZ2IsIEsueHkpOyBcXG4nICtcclxuICAgICcgICAgdmVjNCBxID0gYy5yIDwgcC54ID8gdmVjNChwLnh5dywgYy5yKSA6IHZlYzQoYy5yLCBwLnl6eCk7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgZCA9IHEueCAtIG1pbihxLncsIHEueSk7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBlID0gMS4wZS0xMDsgXFxuJyArXHJcbiAgICAnICAgIHJldHVybiB2ZWMzKGFicyhxLnogKyAocS53IC0gcS55KSAvICg2LjAgKiBkICsgZSkpLCBkIC8gKHEueCArIGUpLCBxLngpOyBcXG4nICtcclxuICAgICd9IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICd2ZWMzIGhzdjJyZ2IodmVjMyBjKSB7IFxcbicgK1xyXG4gICAgJyAgICB2ZWM0IEsgPSB2ZWM0KDEuMCwgMi4wIC8gMy4wLCAxLjAgLyAzLjAsIDMuMCk7IFxcbicgK1xyXG4gICAgJyAgICB2ZWMzIHAgPSBhYnMoZnJhY3QoYy54eHggKyBLLnh5eikgKiA2LjAgLSBLLnd3dyk7IFxcbicgK1xyXG4gICAgJyAgICByZXR1cm4gYy56ICogbWl4KEsueHh4LCBjbGFtcChwIC0gSy54eHgsIDAuMCwgMS4wKSwgYy55KTsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJ3ZvaWQgbWFpbigpIHsgXFxuJyArXHJcbiAgICAnICAgIHZlYzQgbXZQb3NpdGlvbiA9IHZpZXdNYXRyaXggKiB2ZWM0KHBvc2l0aW9uLCAxLjApOyBcXG4nICtcclxuICAgICcgICAgZ2xfUG9zaXRpb24gPSBwcm9qZWN0aW9uTWF0cml4ICogbXZQb3NpdGlvbjsgXFxuJyArXHJcbiAgICAnIFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCB2ZXJ0ZXhQZXJjZW50ID0gaW52ZXJzZUxlcnAocG9pbnRUaW1lLCBtaW5UaW1lLCBtYXhUaW1lKTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHZpc1BlcmNlbnQgPSBpbnZlcnNlTGVycCh2aXN1YWxpemF0aW9uVGltZSwgbWluVGltZSwgbWF4VGltZSk7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCBwZXJjZW50RGlmZmVyZW5jZSA9IGFicyh2ZXJ0ZXhQZXJjZW50IC0gdmlzUGVyY2VudCk7IFxcbicgK1xyXG4gICAgJyAgICAvLyBTY2FsZSBkaWZmZXJlbmNlIGJhc2VkIG9uIGhpZ2hsaWdodCByYW5nZSBpbnRvIGFuIGludGVycG9sYXRpb24gdGltZS4gXFxuJyArXHJcbiAgICAnICAgIHQgPSBjbGFtcCgxLjAgLSBwZXJjZW50RGlmZmVyZW5jZSAvIHBlcmNlbnRIaWdobGlnaHRSYW5nZSwgMC4wLCAxLjApOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIGdsX1BvaW50U2l6ZSA9IGxlcnAobWluU2l6ZSwgbWF4U2l6ZSwgdCk7IFxcbicgK1xyXG4gICAgJyBcXG4nICtcclxuICAgICcgICAgdGltZUFscGhhID0gbGVycChtaW5BbHBoYSwgbWF4QWxwaGEsIHQpOyBcXG4nICtcclxuICAgICcgXFxuJyArXHJcbiAgICAnICAgIHZlYzMgbWluSFNWID0gcmdiMmhzdihtaW5Db2xvcik7IFxcbicgK1xyXG4gICAgJyAgICB2ZWMzIG1heEhTViA9IHJnYjJoc3YobWF4Q29sb3IpOyBcXG4nICtcclxuICAgICcgICAgZmxvYXQgaCA9IGxlcnAobWluSFNWLngsIG1heEhTVi54LCB0KTsgXFxuJyArXHJcbiAgICAnICAgIGZsb2F0IHMgPSBsZXJwKG1pbkhTVi55LCBtYXhIU1YueSwgdCk7IFxcbicgK1xyXG4gICAgJyAgICBmbG9hdCB2ID0gbGVycChtaW5IU1YueiwgbWF4SFNWLnosIHQpOyBcXG4nICtcclxuICAgICcgICAgdGltZUNvbG9yID0gaHN2MnJnYih2ZWMzKGgsIHMsIHYpKTsgXFxuJyArXHJcbiAgICAnfSBcXG4nICtcclxuICAgICcnO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBjaHJvbm9kYXRhVmVydGV4O1xyXG4iXX0=
