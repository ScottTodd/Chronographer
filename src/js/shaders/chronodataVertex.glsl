attribute float pointTime;
varying float vertexTime;

void main() {
    vertexTime = pointTime;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 32.0;
    gl_Position = projectionMatrix * mvPosition;
}
