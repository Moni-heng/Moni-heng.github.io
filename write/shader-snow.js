// 雪天 —— 飘雪 + 雪山夜景（完全重写）
const SNOW_FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  iResolution;
uniform float iTime;
uniform float uAmount;

// 一维 hash
float hash1(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// 单层雪花
float snowLayer(vec2 uv, float t, float scale, float speed, float sizeMul, float density) {
    vec2 gv = uv * scale;
    gv.y += t * speed;

    vec2 id = floor(gv);
    vec2 f  = fract(gv) - 0.5;

    float rnd  = hash1(id);
    float rnd2 = hash1(id + 7.3);
    float rnd3 = hash1(id + 19.7);

    // 密度筛选
    float mask = step(1.0 - density, rnd);
    if (mask < 0.5) return 0.0;

    // 水平摆动
    float sway = sin(t * 0.5 + rnd3 * 6.283) * 0.18;
    vec2 offset = vec2((rnd2 - 0.5) * 0.7 + sway,
                       (rnd3 - 0.5) * 0.5);

    float d = length(f - offset);
    float sz = (0.035 + rnd2 * 0.07) * sizeMul;

    return smoothstep(sz, 0.0, d);
}

void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 UV = fragCoord / iResolution.xy;
    vec2 uv = UV;
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime;

    // ===== 背景：雪山夜景 =====
    // 天空渐变
    vec3 sky = mix(vec3(0.03, 0.05, 0.10),
                   vec3(0.14, 0.20, 0.32),
                   UV.y);

    // 远山轮廓（sin 波叠加）
    float mx = uv.x * 2.3 + 1.2;
    float mountainY = 0.52
                    + 0.09 * sin(mx * 1.0 + 1.2)
                    + 0.04 * sin(mx * 2.5 + 3.1)
                    + 0.02 * sin(mx * 5.7 + 0.6);
    float mountain = 1.0 - smoothstep(mountainY, mountainY + 0.03, UV.y);
    vec3  mCol = mix(vec3(0.10, 0.14, 0.22),
                     vec3(0.18, 0.24, 0.36),
                     UV.y);

    // 近景树林
    float forestY = 0.78 + 0.015 * sin(uv.x * 22.0)
                         + 0.01  * sin(uv.x * 41.0 + 1.3);
    float forest = 1.0 - smoothstep(forestY, forestY + 0.015, UV.y);
    vec3  fCol = vec3(0.02, 0.035, 0.06);

    vec3 col = sky;
    col = mix(col, mCol, mountain * 0.85);
    col = mix(col, fCol, forest * 0.9);

    // ===== 雪花 =====
    float amount = uAmount;
    float d1 = smoothstep(0.05, 0.6, amount);
    float d2 = smoothstep(0.15, 0.8, amount);
    float d3 = smoothstep(0.25, 0.95, amount);

    float snow = 0.0;
    snow += snowLayer(uv,        t, 3.0, 0.10, 1.6, d1 * 0.35) * 0.55;
    snow += snowLayer(uv + 17.0, t, 6.0, 0.20, 1.1, d1 * 0.55) * 0.75;
    snow += snowLayer(uv + 42.0, t, 12.0, 0.35, 0.8, d2 * 0.75) * 0.95;
    snow += snowLayer(uv + 88.0, t, 24.0, 0.55, 0.55, d3 * 0.85) * 0.9;
    snow += snowLayer(uv + 133.0, t, 48.0, 0.85, 0.35, d3) * 0.7;

    col += snow * vec3(0.95, 0.97, 1.0);

    // vignette
    UV -= 0.5;
    col *= 1.0 - dot(UV, UV) * 0.4;

    fragColor = vec4(col, 1.0);
}
`;
