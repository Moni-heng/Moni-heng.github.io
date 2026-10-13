/* =========================================================
 *  WebGL 背景 + Quill 编辑器 + 天气切换 + 字体切换 + 导出
 * ========================================================= */

const VERT = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/* ---------- WebGL 工具 ---------- */

function createProgram(gl, vs, fs) {
  const v = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(v, vs);
  gl.compileShader(v);
  if (!gl.getShaderParameter(v, gl.COMPILE_STATUS)) {
    console.error('VS:', gl.getShaderInfoLog(v));
  }
  const f = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(f, fs);
  gl.compileShader(f);
  if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) {
    console.error('FS:', gl.getShaderInfoLog(f));
  }
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('LINK:', gl.getProgramInfoLog(p));
  }
  return p;
}

/* 雨景纹理：明亮南方雨季，青绿 + 树影 */
function createRainTexture(gl) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext('2d');

  // 天空到地面的明亮青绿渐变
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0.00, '#a8c0a6');  // 顶部淡灰绿（天光）
  grad.addColorStop(0.25, '#88a888');
  grad.addColorStop(0.55, '#5d8064');
  grad.addColorStop(0.80, '#3d5a45');
  grad.addColorStop(1.00, '#2a4232');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // 树影：暗绿色柔光斑点
  for (let i = 0; i < 55; i++) {
    const x = Math.random() * 1024;
    const y = 200 + Math.random() * 824;
    const r = 60 + Math.random() * 180;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(20, 45, 28, 0.45)');
    g.addColorStop(0.6, 'rgba(20, 45, 28, 0.15)');
    g.addColorStop(1, 'rgba(20, 45, 28, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
  }

  // 亮色光斑（透过树叶的天光）
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 600;
    const r = 40 + Math.random() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(230, 245, 210, 0.30)');
    g.addColorStop(1, 'rgba(230, 245, 210, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
  }

  // 轻微噪点，让玻璃模糊采样有质感
  const img = ctx.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i]     = Math.max(0, Math.min(255, img.data[i]     + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/* 雪景纹理：仅作占位（雪 shader 自己画背景） */
function createPlaceholderTexture(gl) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
                gl.RGBA, gl.UNSIGNED_BYTE,
                new Uint8Array([10, 15, 25, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

/* 单个天气渲染器 */
class WeatherCanvas {
  constructor(canvas, fragSrc, type) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    this.visible = false;
    this.amount = 0.6;
    this.startTime = performance.now();

    if (!this.gl) {
      console.error('WebGL2 不被支持');
      return;
    }
    const gl = this.gl;
    this.program     = createProgram(gl, VERT, fragSrc);
    this.uResolution = gl.getUniformLocation(this.program, 'iResolution');
    this.uTime       = gl.getUniformLocation(this.program, 'iTime');
    this.uAmount     = gl.getUniformLocation(this.program, 'uAmount');
    this.uChannel0   = gl.getUniformLocation(this.program, 'iChannel0');

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.texture = (type === 'rain')
      ? createRainTexture(gl)
      : createPlaceholderTexture(gl);

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(window.innerWidth  * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width  = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  setAmount(v) { this.amount = v; }

  loop(now) {
    requestAnimationFrame(this.loop);
    if (!this.visible) return;

    const gl = this.gl;
    const time = (now - this.startTime) / 1000;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uTime, time);
    gl.uniform1f(this.uAmount, this.amount);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uChannel0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

/* ---------- 主逻辑 ---------- */

document.addEventListener('DOMContentLoaded', () => {
  /* 0. 默认字体 */
  document.body.classList.add('font-sans');

  /* 1. 背景 */
  const rainCanvas = document.getElementById('bg-rain');
  const snowCanvas = document.getElementById('bg-snow');

  const rain = new WeatherCanvas(rainCanvas, RAIN_FRAG, 'rain');
  const snow = new WeatherCanvas(snowCanvas, SNOW_FRAG, 'snow');
  rain.visible = true;

  let currentWeather = 'rain';

  function switchWeather(w) {
    if (w === currentWeather) return;
    currentWeather = w;

    rainCanvas.classList.toggle('active', w === 'rain');
    snowCanvas.classList.toggle('active', w === 'snow');
    rain.visible = (w === 'rain');
    snow.visible = (w === 'snow');

    document.querySelectorAll('.weather-switch button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.weather === w);
    });
  }

  document.querySelectorAll('.weather-switch button').forEach(btn => {
    btn.addEventListener('click', () => switchWeather(btn.dataset.weather));
  });

  /* 2. 强度滑块 */
  const intensity = document.getElementById('intensity');
  intensity.addEventListener('input', () => {
    const v = intensity.value / 100;
    rain.setAmount(v);
    snow.setAmount(v);
  });
  rain.setAmount(intensity.value / 100);
  snow.setAmount(intensity.value / 100);

  /* 3. 字体切换 */
  const FONT_CLASSES = ['font-sans', 'font-serif', 'font-kai', 'font-xiao'];

  document.querySelectorAll('.font-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = 'font-' + btn.dataset.font;
      if (!FONT_CLASSES.includes(f)) return;

      document.body.classList.remove(...FONT_CLASSES);
      document.body.classList.add(f);

      document.querySelectorAll('.font-switch button').forEach(b => {
        b.classList.toggle('active', b === btn);
      });
    });
  });

  /* 4. Quill 编辑器 */
  const quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: '开始写点什么…',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ header: 1 }, { header: 2 }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block'],
        ['link'],
        ['clean'],
      ],
    },
  });

  /* 5. 字数 & 阅读时长 */
  const wordcountEl = document.getElementById('wordcount');
  const readtimeEl  = document.getElementById('readtime');

  function updateStats() {
    const text = quill.getText().trim();
    const count = text.length;
    const minutes = Math.max(1, Math.round(count / 400));
    wordcountEl.textContent = `${count} 字`;
    readtimeEl.textContent  = `${count === 0 ? 0 : minutes} 分钟阅读`;
  }
  quill.on('text-change', updateStats);
  updateStats();

  /* 6. 导出 .md */
  const turndown = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });

  document.getElementById('export-btn').addEventListener('click', () => {
    const html = quill.getSemanticHTML
      ? quill.getSemanticHTML()
      : quill.root.innerHTML;
    const md = turndown.turndown(html);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'draft.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* 7. 退出：清空 + 回首页 */
  document.getElementById('exit-btn').addEventListener('click', () => {
    if (quill.getText().trim().length > 0) {
      if (!confirm('内容不会保存，确定退出？')) return;
    }
    quill.setContents([]);
    const base = (window.__BASEURL__ || '').replace(/\/$/, '');
    window.location.href = base + '/';
  });

  /* 8. 离开页面前提醒（不保存） */
  window.addEventListener('beforeunload', (e) => {
    if (quill.getText().trim().length > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
});
