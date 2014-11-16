'use strict';

var ChronoData = require('./ChronoData');
var ChronoControls = require('./ChronoControls');
var Earth = require('./Earth');


var Chronographer = function(container, data) {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.radius = 300;

    this.setupRenderer(container);
    this.setupScene();

    this.chronoData = new ChronoData(data, this.radius);
    this.chronoData.setScene(this.scene);
    var minTime = this.chronoData.getMinTime();
    var maxTime = this.chronoData.getMaxTime();

    this.chronoControls = new ChronoControls(container);
    this.chronoControls.setTimeRange(minTime, maxTime);

    this.earth = new Earth(this.radius);
    this.earth.setScene(this.scene);
};


Chronographer.prototype.setupRenderer = function(container) {
    this.renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = 'cgr-chronoData';

    // effect = new THREE.StereoEffect(renderer);
    // effect.setSize(window.innerWidth, window.innerHeight);
};


Chronographer.prototype.setupScene = function() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75,
      window.innerWidth / window.innerHeight, 1, 3000);
    this.camera.position.z = this.radius * 2.5;

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
};


Chronographer.prototype.update = function() {
    var dt = this.clock.getDelta();

    this.chronoControls.update(dt);
    this.chronoData.setTime(this.chronoControls.getTime());

    this.chronoData.update(dt);

    this.controls.update();
    this.render();
};


Chronographer.prototype.render = function() {
    this.renderer.render(this.scene, this.camera);
};


module.exports = Chronographer;
