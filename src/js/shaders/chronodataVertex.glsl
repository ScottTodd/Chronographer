attribute float pointTime;
varying float vertexTime;

void main() {
    vertexTime = pointTime;
    // vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * vec4(position, 1.0);
    gl_PointSize = 16.0;
    gl_Position = projectionMatrix * mvPosition;
}
