uniform sampler2D particleTexture;

varying float t;
varying vec3 timeColor;
varying float timeAlpha;

void main() {
    float textureAlpha = texture2D(particleTexture, gl_PointCoord).a;
    float alpha = textureAlpha * timeAlpha;

    vec3 color = timeColor;

    gl_FragColor = vec4(color, alpha);
}
