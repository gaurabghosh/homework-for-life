/* Tiny SVG chart helpers with hover tooltips.
   Colors come from CSS custom properties so light/dark both validate. */
const Charts = (() => {
  const NS = "http://www.w3.org/2000/svg";

  function el(name, attrs = {}, children = []) {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    for (const c of children) n.appendChild(c);
    return n;
  }
  function txt(name, attrs, content) {
    const n = el(name, attrs);
    n.textContent = content;
    return n;
  }

  /* --- shared tooltip --- */
  let tip;
  function ensureTip() {
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "tip";
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(evt, html) {
    const t = ensureTip();
    t.innerHTML = html;
    t.style.display = "block";
    const pad = 14;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    const r = t.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
    t.style.left = x + "px";
    t.style.top = y + "px";
  }
  function hideTip() { if (tip) tip.style.display = "none"; }

  function hover(node, htmlFn) {
    node.addEventListener("mousemove", (e) => showTip(e, htmlFn()));
    node.addEventListener("mouseleave", hideTip);
  }

  const fmt = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace(/\.?0+$/, "") || "0";

  /* --- vertical column chart (magnitude, sequential single hue) --- */
  function columns(container, data, opts = {}) {
    // data: [{label, value, tip}]
    const W = opts.width || 520, H = opts.height || 240;
    const m = { t: 14, r: 8, b: 26, l: 30 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const max = Math.max(...data.map((d) => d.value)) * 1.08;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    const ticks = niceTicks(0, max, 4);
    for (const t of ticks) {
      const y = m.t + ih - (t / max) * ih;
      svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, class: "gridline" }));
      svg.appendChild(txt("text", { x: m.l - 6, y: y + 3.5, "text-anchor": "end", class: "axis-t" }, t));
    }
    const bw = Math.min(42, (iw / data.length) * 0.62);
    data.forEach((d, i) => {
      const cx = m.l + (iw / data.length) * (i + 0.5);
      const h = Math.max(2, (d.value / max) * ih);
      const y = m.t + ih - h;
      const bar = el("path", {
        d: roundTopRect(cx - bw / 2, y, bw, h, 4),
        fill: d.color || "var(--seq-450)",
      });
      hover(bar, () => d.tip || `<strong>${d.label}</strong>: ${fmt(d.value)}`);
      svg.appendChild(bar);
      if (d.topLabel != null)
        svg.appendChild(txt("text", { x: cx, y: y - 5, "text-anchor": "middle", class: "lbl-strong" }, d.topLabel));
      svg.appendChild(txt("text", { x: cx, y: H - 8, "text-anchor": "middle", class: "axis-t" }, d.label));
    });
    svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: m.t + ih, y2: m.t + ih, class: "baseline" }));
    container.appendChild(svg);
  }

  /* --- horizontal bars (magnitude) --- */
  function hbars(container, data, opts = {}) {
    const W = opts.width || 520;
    const rowH = 26, m = { t: 6, r: 46, b: 6, l: opts.labelWidth || 130 };
    const H = m.t + m.b + rowH * data.length;
    const iw = W - m.l - m.r;
    const max = Math.max(...data.map((d) => d.value));
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    data.forEach((d, i) => {
      const y = m.t + rowH * i + rowH / 2;
      const w = Math.max(2, (d.value / max) * iw);
      svg.appendChild(txt("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", class: "lbl" }, d.label));
      const bar = el("path", {
        d: roundRightRect(m.l, y - 7, w, 14, 4),
        fill: d.color || "var(--seq-450)",
      });
      hover(bar, () => d.tip || `<strong>${d.label}</strong>: ${fmt(d.value)}`);
      svg.appendChild(bar);
      svg.appendChild(txt("text", { x: m.l + w + 7, y: y + 4, class: "lbl-strong" }, d.valueLabel != null ? d.valueLabel : fmt(d.value)));
    });
    svg.appendChild(el("line", { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b, class: "baseline" }));
    container.appendChild(svg);
  }

  /* --- line chart over time with zero baseline + crosshair tooltip --- */
  function line(container, points, opts = {}) {
    // points: [{x: Date, y, label, tip}]
    const W = opts.width || 980, H = opts.height || 260;
    const m = { t: 14, r: 14, b: 26, l: 38 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const xs = points.map((p) => +p.x);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const ymin = opts.ymin != null ? opts.ymin : Math.min(...points.map((p) => p.y));
    const ymax = opts.ymax != null ? opts.ymax : Math.max(...points.map((p) => p.y));
    const X = (v) => m.l + ((v - x0) / (x1 - x0)) * iw;
    const Y = (v) => m.t + ih - ((v - ymin) / (ymax - ymin)) * ih;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });

    for (const t of opts.yticks || niceTicks(ymin, ymax, 4)) {
      svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: "gridline" }));
      svg.appendChild(txt("text", { x: m.l - 6, y: Y(t) + 3.5, "text-anchor": "end", class: "axis-t" }, t));
    }
    if (ymin < 0 && ymax > 0)
      svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), class: "baseline" }));

    // month ticks on x
    const mstarts = [];
    const d = new Date(x0); d.setDate(1);
    for (; +d <= x1; d.setMonth(d.getMonth() + 1)) if (+d >= x0) mstarts.push(new Date(d));
    for (const md of mstarts) {
      svg.appendChild(txt("text", { x: X(+md), y: H - 8, class: "axis-t" },
        md.toLocaleDateString("en-SG", { month: "short" })));
    }

    // smoothed rolling average line (if provided) else raw line
    const main = opts.avg || points;
    const path = main.map((p, i) => `${i ? "L" : "M"}${X(+p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
    svg.appendChild(el("path", { d: path, fill: "none", stroke: "var(--accent)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));

    // dots for raw daily points
    for (const p of points) {
      const dot = el("circle", {
        cx: X(+p.x), cy: Y(p.y), r: 3,
        fill: p.y >= 0.15 ? "var(--pos)" : p.y <= -0.15 ? "var(--neg)" : "var(--neu)",
        stroke: "var(--surface-1)", "stroke-width": 1.5,
      });
      svg.appendChild(dot);
    }

    // crosshair hover layer
    const hoverRect = el("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" });
    const vline = el("line", { y1: m.t, y2: m.t + ih, class: "gridline", style: "display:none" });
    const focus = el("circle", { r: 5, fill: "none", stroke: "var(--accent)", "stroke-width": 2, style: "display:none" });
    svg.appendChild(vline); svg.appendChild(focus); svg.appendChild(hoverRect);
    hoverRect.addEventListener("mousemove", (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      let best = points[0], bd = Infinity;
      for (const p of points) { const dd = Math.abs(X(+p.x) - px); if (dd < bd) { bd = dd; best = p; } }
      vline.style.display = ""; focus.style.display = "";
      vline.setAttribute("x1", X(+best.x)); vline.setAttribute("x2", X(+best.x));
      focus.setAttribute("cx", X(+best.x)); focus.setAttribute("cy", Y(best.y));
      showTip(e, best.tip || `${fmt(best.y)}`);
    });
    hoverRect.addEventListener("mouseleave", () => { vline.style.display = "none"; focus.style.display = "none"; hideTip(); });

    container.appendChild(svg);
  }

  /* --- diverging stacked bar per category (neg | neutral | pos), centered on neutral --- */
  function diverging(container, data, opts = {}) {
    // data: [{label, neg, neu, pos, tips:{neg,neu,pos}}] counts
    const W = opts.width || 520;
    const rowH = 34, m = { t: 8, r: 14, b: 22, l: opts.labelWidth || 70 };
    const H = m.t + m.b + rowH * data.length;
    const iw = W - m.l - m.r;
    const maxSide = Math.max(...data.map((d) => Math.max(d.neg + d.neu / 2, d.pos + d.neu / 2))) * 1.05;
    const cx = m.l + iw / 2;
    const scale = (iw / 2) / maxSide;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    svg.appendChild(el("line", { x1: cx, x2: cx, y1: m.t, y2: H - m.b, class: "baseline" }));
    const gap = 2;
    data.forEach((d, i) => {
      const y = m.t + rowH * i + 6, h = rowH - 12;
      svg.appendChild(txt("text", { x: m.l - 8, y: y + h / 2 + 4, "text-anchor": "end", class: "lbl" }, d.label));
      const halfNeu = (d.neu / 2) * scale;
      // neutral block centered
      if (d.neu > 0) {
        const r = el("rect", { x: cx - halfNeu, y, width: halfNeu * 2, height: h, fill: "var(--neu)", rx: 2 });
        hover(r, () => d.tips.neu);
        svg.appendChild(r);
      }
      if (d.neg > 0) {
        const w = d.neg * scale;
        const r = el("path", { d: roundLeftRect(cx - halfNeu - gap - w, y, w, h, 4), fill: "var(--neg)" });
        hover(r, () => d.tips.neg);
        svg.appendChild(r);
      }
      if (d.pos > 0) {
        const w = d.pos * scale;
        const r = el("path", { d: roundRightRect(cx + halfNeu + gap, y, w, h, 4), fill: "var(--pos)" });
        hover(r, () => d.tips.pos);
        svg.appendChild(r);
      }
      // counts at ends
      if (d.neg > 0) svg.appendChild(txt("text", { x: cx - halfNeu - gap - d.neg * scale - 6, y: y + h / 2 + 4, "text-anchor": "end", class: "lbl-strong" }, d.neg));
      if (d.pos > 0) svg.appendChild(txt("text", { x: cx + halfNeu + gap + d.pos * scale + 6, y: y + h / 2 + 4, class: "lbl-strong" }, d.pos));
    });
    container.appendChild(svg);
  }

  /* --- heatmap (sequential) --- */
  function heatmap(container, rows, cols, get, opts = {}) {
    // rows: [{id,label}], cols: [{id,label}], get(r,c) -> {value, tip}
    const W = opts.width || 520;
    const m = { t: 24, r: 8, b: 8, l: opts.labelWidth || 130 };
    const cellH = 26, gap = 3;
    const H = m.t + m.b + rows.length * (cellH + gap);
    const cw = (W - m.l - m.r - (cols.length - 1) * gap) / cols.length;
    let max = 0;
    for (const r of rows) for (const c of cols) max = Math.max(max, get(r, c).value);
    const steps = ["var(--seq-100)", "var(--seq-200)", "var(--seq-300)", "var(--seq-400)", "var(--seq-550)", "var(--seq-700)"];
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    cols.forEach((c, j) => {
      svg.appendChild(txt("text", { x: m.l + j * (cw + gap) + cw / 2, y: 14, "text-anchor": "middle", class: "axis-t" }, c.label));
    });
    rows.forEach((r, i) => {
      const y = m.t + i * (cellH + gap);
      svg.appendChild(txt("text", { x: m.l - 8, y: y + cellH / 2 + 4, "text-anchor": "end", class: "lbl" }, r.label));
      cols.forEach((c, j) => {
        const { value, tip: tp } = get(r, c);
        const x = m.l + j * (cw + gap);
        const fill = value === 0 ? "var(--neu-mid)" : steps[Math.min(steps.length - 1, Math.floor((value / max) * steps.length))];
        const cell = el("rect", { x, y, width: cw, height: cellH, rx: 5, fill });
        hover(cell, () => tp);
        svg.appendChild(cell);
        if (value > 0 && value / max >= 0.55)
          svg.appendChild(txt("text", { x: x + cw / 2, y: y + cellH / 2 + 4, "text-anchor": "middle", class: "axis-t", style: "fill:#fff" }, value));
        else if (value > 0)
          svg.appendChild(txt("text", { x: x + cw / 2, y: y + cellH / 2 + 4, "text-anchor": "middle", class: "axis-t" }, value));
      });
    });
    container.appendChild(svg);
  }

  /* --- helpers --- */
  function roundTopRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  }
  function roundRightRect(x, y, w, h, r) {
    r = Math.min(r, h / 2, w);
    return `M${x},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x},${y + h} Z`;
  }
  function roundLeftRect(x, y, w, h, r) {
    r = Math.min(r, h / 2, w);
    return `M${x + w},${y} L${x + r},${y} Q${x},${y} ${x},${y + r} L${x},${y + h - r} Q${x},${y + h} ${x + r},${y + h} L${x + w},${y + h} Z`;
  }
  function niceTicks(min, max, n) {
    const span = max - min || 1;
    const step0 = span / n;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => span / s <= n) || mag * 10;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(6));
    return ticks;
  }

  return { columns, hbars, line, diverging, heatmap, hover, fmt };
})();
