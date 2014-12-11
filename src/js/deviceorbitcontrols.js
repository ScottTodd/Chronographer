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
    var theta = -(event.alpha * deg2rad);
    var phi = 0;
    if (event.gamma < 0) {
        phi = (event.gamma + 90) * deg2rad;
    } else {
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
