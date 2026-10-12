/* =========================================================
 *  WebGL 背景 + Quill 编辑器 + 天气切换 + 导出
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
/* 用 Canvas2D 生成一张渐变天空，作为玻璃后的“景物”纹理 */
function createSkyTexture(gl, type) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  if (type === 'rain') {
    grad.addColorStop(0.0, '#141a26');
    grad.addColorStop(0.5, '#222c40');
    grad.addColorStop(1.0, '#303c54');
  } else {
    grad.addColorStop(0.0, '#0e1420');
    grad.addColorStop(0.5, '#1a2438');
    grad.addColorStop(1.0, '#2a3650');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  // 加一点噪点让模糊采样更有质感
  const img = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 26;
    img.data[i]     = Math.max(0, Math.min(255, img.data[i]     + noise));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + noise));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + noise));
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
    this.program    = createProgram(gl, VERT, fragSrc);
    this.uResolution = gl.getUniformLocation(this.program, 'iResolution');
    this.uTime       = gl.getUniformLocation(this.program, 'iTime');
    this.uAmount     = gl.getUniformLocation(this.program, 'uAmount');
    this.uChannel0   = gl.getUniformLocation(this.program, 'iChannel0');
    // 全屏三角形对
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
    this.texture = createSkyTexture(gl, type);
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
    if (!this.visible) return;   // 不可见时不渲染，省性能
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
  // 初始化
  rain.setAmount(intensity.value / 100);
  snow.setAmount(intensity.value / 100);
  /* 3. Quill 编辑器 */
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
  /* 4. 字数 & 阅读时长 */
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
  /* 5. 导出 .md */
  const turndown = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });
  document.getElementById('export-btn').addEventListener('click', () => {
    const html = quill.getSemanticHTML ? quill.getSemanticHTML() : quill.root.innerHTML;
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
  /* 6. 退出：清空 + 回首页 */
  document.getElementById('exit-btn').addEventListener('click', () => {
    if (quill.getText().trim().length > 0) {
      if (!confirm('内容不会保存，确定退出？')) return;
    }
    quill.setContents([]);
    window.location.href = '/';
  });
  /* 7. 离开页面前提醒（不保存） */
  window.addEventListener('beforeunload', (e) => {
    if (quill.getText().trim().length > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
});
