// 雪天 —— 复用 Heartfelt 玻璃框架，改造为落雪
const SNOW_FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  iResolution;
uniform float iTime;
uniform float uAmount;
uniform sampler2D iChannel0;

#define S(a, b, t) smoothstep(a, b, t)

vec3 N13(float p) {
    vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec3((p3.x + p3.y) * p3.z,
                      (p3.x + p3.z) * p3.y,
                      (p3.y + p3.z) * p3.x));
}

float N(float t) {
    return fract(sin(t * 12345.564) * 7658.76);
}

float Saw(float b, float t) {
    return S(0., b, t) * S(1., b, t);
}

vec2 SnowLayer(vec2 uv, float t) {
    vec2 UV = uv;
    uv.y += t * 0.15;
    vec2 a = vec2(6., 1.);
    vec2 grid = a * 2.;
    vec2 id = floor(uv * grid);
    float colShift = N(id.x);
    uv.y += colShift;
    id = floor(uv * grid);
    vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
    vec2 st = fract(uv * grid) - vec2(.5, 0);

    float x = n.x - .5;
    float y = UV.y * 20.;
    float wiggle = sin(y + sin(y));
    x += wiggle * (.5 - abs(x)) * (n.z - .5);
    x *= .7;
    float ti = fract(t * 0.5 + n.z);
    y = (Saw(.85, ti) - .5) * .9 + .5;
    vec2 p = vec2(x, y);
    float d = length((st - p) * a.yx);

    float mainDrop = S(.5, .0, d);

    float r = sqrt(S(1., y, st.y));
    float cd = abs(st.x - x);
    float trail = S(.30 * r, .20 * r * r, cd);
    float trailFront = S(-.05, .05, st.y - y);
    trail *= trailFront * r * r;

    return vec2(mainDrop, trail);
}

float StaticSnow(vec2 uv, float t) {
    uv *= 40.;
    vec2 id = floor(uv);
    uv = fract(uv) - .5;
    vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
    vec2 p = (n.xy - .5) * .7;
    float d = length(uv - p);
    float fade = Saw(.08, fract(t * 0.5 + n.z));
    return S(.4, 0., d) * fract(n.z * 10.) * fade;
}

vec2 Snow(vec2 uv, float t, float l0, float l1, float l2) {
    float s = StaticSnow(uv, t) * l0;
    vec2 m1 = SnowLayer(uv, t) * l1;
    vec2 m2 = SnowLayer(uv * 1.85, t) * l2;
    float c = s + m1.x + m2.x;
    c = S(.3, 1., c);
    return vec2(c, max(m1.y * l0, m2.y * l1));
}

void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = (fragCoord - .5 * iResolution.xy) / iResolution.y;
    vec2 UV = fragCoord / iResolution.xy;

    float T = iTime;
    float t = T * .15;
    float snowAmount = uAmount;

    float maxBlur = mix(2., 4., snowAmount);
    float minBlur = 2.;

    uv *= 1.5;

    float staticSnow = S(-.5, 1., snowAmount) * 2.;
    float layer1 = S(.25, .75, snowAmount);
    float layer2 = S(.0, .5, snowAmount);

    vec2 c = Snow(uv, t, staticSnow, layer1, layer2);
    vec2 n = vec2(dFdx(c.x), dFdy(c.x));

    float focus = mix(maxBlur - c.y, minBlur, S(.1, .2, c.x));
    vec3 col = textureLod(iChannel0, UV + n, focus).rgb;

    col *= vec3(.95, 1.0, 1.1);

    UV -= .5;
    col *= 1. - dot(UV, UV) * 0.5;

    fragColor = vec4(col, 1.);
}
`;
