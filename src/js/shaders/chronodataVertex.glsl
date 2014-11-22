attribute float pointTime;

uniform float minTime;
uniform float maxTime;
uniform float visualizationTime;
uniform float percentHighlightRange;

uniform float minAlpha;
uniform float maxAlpha;
uniform vec3 minColor;
uniform vec3 maxColor;
uniform float minSize;
uniform float maxSize;

varying float t;
varying float timeAlpha;
varying vec3 timeColor;

float lerp(float minValue, float maxValue, float t) {
    return (minValue * (1.0 - t)) + (maxValue * t);
}

float inverseLerp(float value, float minValue, float maxValue) {
    float valueRange = maxValue - minValue;
    float inverseLerped = (value - minValue) / valueRange;
    float clamped = clamp(inverseLerped, 0.0, 1.0);
    return inverseLerped;
}

// RGB to HSV and HSV to RGB
// source: http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy);
    vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx);

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}


void main() {
    vec4 mvPosition = viewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float vertexPercent = inverseLerp(pointTime, minTime, maxTime);
    float visPercent = inverseLerp(visualizationTime, minTime, maxTime);
    float percentDifference = abs(vertexPercent - visPercent);
    // Scale difference based on highlight range into an interpolation time.
    t = clamp(1.0 - percentDifference / percentHighlightRange, 0.0, 1.0);

    gl_PointSize = lerp(minSize, maxSize, t);

    timeAlpha = lerp(minAlpha, maxAlpha, t);

    vec3 minHSV = rgb2hsv(minColor);
    vec3 maxHSV = rgb2hsv(maxColor);
    float h = lerp(minHSV.x, maxHSV.x, t);
    float s = lerp(minHSV.y, maxHSV.y, t);
    float v = lerp(minHSV.z, maxHSV.z, t);
    timeColor = hsv2rgb(vec3(h, s, v));
}
