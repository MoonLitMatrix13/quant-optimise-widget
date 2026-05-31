/* ─── Quantisation math ─────────────────────────────────── */

function quantFP32(v) {
    return parseFloat(v.toFixed(7));
  }
  
  function quantINT8(v) {
    const scale = 255 / 4;
    const q = Math.round(v * scale);
    const clamped = Math.max(-128, Math.min(127, q));
    return parseFloat((clamped / scale).toFixed(4));
  }
  
  function quantINT4(v) {
    const scale = 15 / 4;
    const q = Math.round(v * scale);
    const clamped = Math.max(-8, Math.min(7, q));
    return parseFloat((clamped / scale).toFixed(3));
  }
  
  function toBinary(v, bits) {
    if (bits === 32) {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, v);
      const bytes = Array.from(new Uint8Array(buf))
        .map(b => b.toString(2).padStart(8, '0'));
      return bytes.join(' ').slice(0, 26) + '…';
    }
    if (bits === 8) {
      const n = Math.max(0, Math.min(255, Math.round((v + 2) / 4 * 255)));
      return n.toString(2).padStart(8, '0');
    }
    const n = Math.max(0, Math.min(15, Math.round((v + 2) / 4 * 15)));
    return n.toString(2).padStart(4, '0');
  }
  
  function memGB(params, bits) {
    return parseFloat(((params * 1e9 * bits / 8) / 1e9).toFixed(1));
  }
  
  function errClass(e) {
    return e < 0.005 ? 'good' : e < 0.05 ? 'warn' : 'bad';
  }
  
  /* ─── Slider fill ───────────────────────────────────────── */
  function updateFill(slider, fillEl) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min)) * 100;
    fillEl.style.width = pct + '%';
  }
  
  /* ─── Tick marks ────────────────────────────────────────── */
  function buildTicks(containerId, count) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i <= count; i++) {
      const tick = document.createElement('span');
      tick.className = 'tick';
      tick.style.left = (i / count * 100) + '%';
      el.appendChild(tick);
    }
  }
  
  /* ─── Format descriptors ────────────────────────────────── */
  const FORMATS = [
    { id: 'FP32', label: 'FP32', desc: '32-bit float',   bits: 32, color: 'var(--fp32)' },
    { id: 'INT8', label: 'INT8', desc: '8-bit integer',  bits: 8,  color: 'var(--int8)' },
    { id: 'INT4', label: 'INT4', desc: '4-bit integer',  bits: 4,  color: 'var(--int4)' },
  ];
  
  /* ─── Cards ─────────────────────────────────────────────── */
  function renderCards(fp, i8, i4, params, e8, e4) {
    const container = document.getElementById('cards');
    if (!container) return;
  
    const rows = [
      { fmt: FORMATS[0], val: fp, err: 0,  mem: memGB(params, 32), prec: 6 },
      { fmt: FORMATS[1], val: i8, err: e8, mem: memGB(params,  8), prec: 4 },
      { fmt: FORMATS[2], val: i4, err: e4, mem: memGB(params,  4), prec: 3 },
    ];
  
    container.innerHTML = rows.map((d, idx) => {
      const ec = d.err === 0 ? 'good' : errClass(d.err);
      const errText = d.err === 0 ? 'none' : d.err.toFixed(4);
      return `
      <article class="card" data-fmt="${d.fmt.id}" style="animation-delay:${idx * 70}ms">
        <div class="c-badge" style="color:${d.fmt.color}">
          <span class="c-dot" style="background:${d.fmt.color}"></span>
          ${d.fmt.label} · ${d.fmt.desc}
        </div>
        <div class="c-value">${d.val.toFixed(d.prec)}</div>
        <div class="c-bits">${toBinary(d.val, d.fmt.bits)}</div>
        <div class="c-divider"></div>
        <div class="c-stat">
          <span class="c-stat-key">Bits per weight</span>
          <span class="c-stat-val">${d.fmt.bits}</span>
        </div>
        <div class="c-stat">
          <span class="c-stat-key">Error vs FP32</span>
          <span class="c-stat-val ${ec}">${errText}</span>
        </div>
        <div class="c-stat">
          <span class="c-stat-key">Model memory</span>
          <span class="c-stat-val">${d.mem} GB</span>
        </div>
      </article>`;
    }).join('');
  }
  
  /* ─── Memory bars ───────────────────────────────────────── */
  function renderBars(params) {
    const barsEl = document.getElementById('bars');
    if (!barsEl) return;
  
    const fp32gb = memGB(params, 32);
    const barData = [
      { label: 'FP32', gb: fp32gb,            color: 'var(--fp32)' },
      { label: 'INT8', gb: memGB(params,  8), color: 'var(--int8)' },
      { label: 'INT4', gb: memGB(params,  4), color: 'var(--int4)' },
    ];
  
    barsEl.innerHTML = barData.map(b => {
      const pct = Math.round(b.gb / fp32gb * 100);
      return `
      <div class="bar-row">
        <span class="bar-name">${b.label}</span>
        <div class="bar-track">
          <div class="mem-bar-fill" style="width:${pct}%; background:${b.color}"></div>
        </div>
        <span class="bar-gb">${b.gb} GB</span>
      </div>`;
    }).join('');
  }
  
  /* ─── Insight ───────────────────────────────────────────── */
  function renderInsight(v, fp, e8, e4, params) {
    const el = document.getElementById('insight');
    if (!el) return;
  
    const fp32gb = memGB(params, 32);
    const int4gb = memGB(params,  4);
    const int8gb = memGB(params,  8);
    const save4  = Math.round((1 - int4gb / fp32gb) * 100);
    const save8  = Math.round((1 - int8gb / fp32gb) * 100);
  
    let text;
    if (e4 < 0.05) {
      text = `At <strong>${v.toFixed(3)}</strong>, INT4 rounding error is tiny (${e4.toFixed(4)}).
      For a <strong>${params}B</strong>-parameter model, INT4 recovers <strong>${save4}%</strong> of memory —
      that's ${(fp32gb - int4gb).toFixed(0)} GB back. Most real weights cluster near zero, so
      average INT4 error is well below worst-case.`;
    } else {
      text = `This weight (<strong>${v.toFixed(3)}</strong>) lies near the quantisation range boundary,
      so INT4 rounding is noticeable (error: <strong>${e4.toFixed(4)}</strong>).
      INT8 holds error to ${e8.toFixed(4)} — often a better tradeoff for quality-sensitive tasks,
      while still saving <strong>${save8}%</strong> memory vs FP32.`;
    }
  
    el.innerHTML = text;
    el.style.borderLeftColor = e4 < 0.05 ? 'var(--accent)' : 'var(--warn)';
  }
  
  /* ─── Main update ───────────────────────────────────────── */
  function update() {
    const wSlider = document.getElementById('wslider');
    const mSlider = document.getElementById('mslider');
    if (!wSlider || !mSlider) return;
  
    const v      = parseFloat(wSlider.value);
    const params = parseInt(mSlider.value, 10);
  
    document.getElementById('wval').textContent = v.toFixed(3);
    document.getElementById('mval').textContent = params + 'B';
  
    const sub = document.getElementById('mem-subtitle');
    if (sub) sub.textContent = params + 'B parameter model';
  
    updateFill(wSlider, document.getElementById('wfill'));
    updateFill(mSlider, document.getElementById('mfill'));
  
    const fp = quantFP32(v);
    const i8 = quantINT8(v);
    const i4 = quantINT4(v);
    const e8 = Math.abs(fp - i8);
    const e4 = Math.abs(fp - i4);
  
    renderCards(fp, i8, i4, params, e8, e4);
    renderBars(params);
    renderInsight(v, fp, e8, e4, params);
  }
  
  /* ─── Init — runs whether DOMContentLoaded already fired or not ── */
  function init() {
    buildTicks('wticks', 8);
    buildTicks('mticks', 6);
  
    const wSlider = document.getElementById('wslider');
    const mSlider = document.getElementById('mslider');
    if (wSlider) wSlider.addEventListener('input', update);
    if (mSlider) mSlider.addEventListener('input', update);
  
    update();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init(); // DOM already ready
  }