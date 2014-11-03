'use strict';

var WorldMap = require('./WorldMap');

var Chronographer = function(container, data, mapData) {
    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(800, 600);
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(
        35,             // Field of view
        800 / 600,      // Aspect ratio
        0.1,            // Near plane
        10000           // Far plane
    );
    camera.position.set(-15, 10, 10);
    camera.lookAt(scene.position);

    var geometry = new THREE.CubeGeometry(5, 5, 5);
    var material = new THREE.MeshLambertMaterial({ color: 0xCC4444 });
    var mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    var light = new THREE.PointLight(0xFFFF00);
    light.position.set(10, 0, 10);
    scene.add(light);

    renderer.render(scene, camera);

    var worldMap = new WorldMap(container, mapData);
};

module.exports = Chronographer;
