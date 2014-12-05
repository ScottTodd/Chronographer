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

    this.chronoControls = new ChronoControls(this, container);
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
