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
    // var beta  = -((event.beta + 180)  * deg2rad);
    var gamma =  ((event.gamma + 90) * deg2rad);

    /*
    The DeviceOrientationEvent.alpha z axis, degrees  0 to 360.
    The DeviceOrientationEvent.beta  x axis, degrees  -180 to 180.
    front to back motion of the device.
    The DeviceOrientationEvent.gamma y axis, degrees  -90 to 90.
    left to right motion of the device.
    */

    var x = this.radius * Math.cos(gamma) * Math.cos(alpha);
    var y = this.radius * Math.sin(gamma);
    var z = this.radius * Math.cos(gamma) * Math.sin(alpha);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));
};


DeviceOrbitControls.prototype.update = function() {

};


module.exports = DeviceOrbitControls;
