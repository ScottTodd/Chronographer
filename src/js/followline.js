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
