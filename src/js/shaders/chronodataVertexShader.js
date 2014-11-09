'use strict';

var chronodataVertexShader = '' +
    'attribute float pointTime; \n' +
    'varying float vertexTime; \n' +
    ' \n' +
    'void main() { \n' +
      'vertexTime = pointTime; \n' +
      'vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); \n' +
      'gl_PointSize = 32.0; \n' +
      'gl_Position = projectionMatrix * mvPosition; \n' +
    '}';

module.exports = chronodataVertexShader;
