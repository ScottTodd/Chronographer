'use strict';

var chronodataFragmentShader = '' +
    'uniform sampler2D particleTexture; \n' +
    'uniform float highlightTime; \n' +
    'uniform float minTime; \n' +
    'uniform float maxTime; \n' +
    'uniform float percentHighlightRange; \n' +
    'uniform float minAlphaScale; \n' +
    ' \n' +
    'varying float vertexTime; \n' +
    ' \n' +
    'float inverseLerp(float value, float minValue, float maxValue) { \n' +
      'float valueRange = maxValue - minValue; \n' +
      'float inverseLerped = (value - minValue) / valueRange; \n' +
      'float clamped = clamp(inverseLerped, 0.0, 1.0); \n' +
      'return inverseLerped; \n' +
    '} \n' +
    ' \n' +
    'void main() { \n' +
      'vec4 textureColor = texture2D(particleTexture, gl_PointCoord); \n' +
      ' \n' +
      'gl_FragColor = textureColor * vec4(0.66, 0.96, 0.96, 1.0); \n' +
      '// gl_FragColor = textureColor * vertexTime; \n' +
      ' \n' +
      '// Bolder, don\'t set alpha for texture areas with no original alpha. \n' +
      '// gl_FragColor.a = min(gl_FragColor.a, vertexTime); \n' +
      ' \n' +
      '// TODO: HSV lerp instead of just alpha scale \n' +
      ' \n' +
      'float vertexPercent    = inverseLerp(vertexTime,    minTime, maxTime); \n' +
      'float highlightPercent = inverseLerp(highlightTime, minTime, maxTime); \n' +
      'float percentDifference = abs(vertexPercent - highlightPercent); \n' +
      ' \n' +
      'float scaleFactor = 1.0 - percentDifference / percentHighlightRange; \n' +
      '// float scaleFactor = 1.0 - abs(vertexTime - highlightTime); \n' +
      'scaleFactor = max(minAlphaScale, scaleFactor); \n' +
      ' \n' +
      'gl_FragColor.a = gl_FragColor.a * scaleFactor; \n' +
    '}';

module.exports = chronodataFragmentShader;
