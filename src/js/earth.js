'use strict';

var Earth = function(scene, radius) {
    var earthGeometry = new THREE.SphereGeometry(radius, 80, 60);
    var earthMaterial = new THREE.MeshPhongMaterial({
      map: this.loadTexture('earthmap1k.jpg')
    });

    earthMaterial.bumpMap = this.loadTexture('earthbump1k.jpg');
    earthMaterial.bumpScale = radius;
    earthMaterial.specularMap = this.loadTexture('earthspec1k.jpg');
    earthMaterial.specular = new THREE.Color('grey');

    var earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthMesh.rotation.y = Math.PI;
    scene.add(earthMesh);
};


Earth.prototype.loadTexture = function(textureName) {
  // TODO: customize path or images, this relative path is nasty.
    return THREE.ImageUtils.loadTexture('../../dist/images/' + textureName);
};


module.exports = Earth;
