uniform sampler2D particleTexture;
uniform float highlightTime;
uniform float minTime;
uniform float maxTime;
uniform float percentHighlightRange;
uniform float minAlphaScale;

varying float vertexTime;

float inverseLerp(float value, float minValue, float maxValue) {
    float valueRange = maxValue - minValue;
    float inverseLerped = (value - minValue) / valueRange;
    float clamped = clamp(inverseLerped, 0.0, 1.0);
    return inverseLerped;
}

void main() {
    vec4 textureColor = texture2D(particleTexture, gl_PointCoord);

    gl_FragColor = textureColor * vec4(0.66, 0.96, 0.96, 1.0);
    // gl_FragColor = textureColor * vertexTime;

    // Bolder, don\'t set alpha for texture areas with no original alpha.
    // gl_FragColor.a = min(gl_FragColor.a, vertexTime);

    // TODO: HSV lerp instead of just alpha scale

    float vertexPercent    = inverseLerp(vertexTime,    minTime, maxTime);
    float highlightPercent = inverseLerp(highlightTime, minTime, maxTime);
    float percentDifference = abs(vertexPercent - highlightPercent);

    float scaleFactor = 1.0 - percentDifference / percentHighlightRange;
    // float scaleFactor = 1.0 - abs(vertexTime - highlightTime);
    scaleFactor = max(minAlphaScale, scaleFactor);

    gl_FragColor.a = gl_FragColor.a * scaleFactor;
}
