/* Homework for Life — app shell: lock screen, tabs, rendering */
(() => {
  let DATA = null;
  const $ = (s, r = document) => r.querySelector(s);
  const monthName = (ym) =>
    new Date(ym + "-01T00:00:00").toLocaleDateString("en-SG", { month: "long", year: "numeric" });
  const fmtDate = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return {
      day: d.toLocaleDateString("en-SG", { day: "2-digit", month: "short" }),
      dow: d.toLocaleDateString("en-SG", { weekday: "short" }),
    };
  };
  const sentColor = (s) => (s >= 0.15 ? "var(--pos)" : s <= -0.15 ? "var(--neg)" : "var(--neu)");
  const sentWord = (s) => (s >= 0.15 ? "positive" : s <= -0.15 ? "negative" : "neutral");
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* ---------- theme toggle ---------- */
  function initTheme() {
    const btn = $("#themeBtn");
    btn.addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark";
    });
  }

  /* ---------- lock screen ---------- */
  async function tryUnlock(pass) {
    const res = await fetch("data.enc.json");
    const payload = await res.json();
    return HFLCrypto.decrypt(payload, pass);
  }

  function initLock() {
    const form = $("#lockForm"), input = $("#passInput"), err = $("#lockErr");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      const pass = input.value.trim();
      if (!pass) return;
      form.querySelector("button").textContent = "Unlocking…";
      try {
        DATA = await tryUnlock(pass);
        sessionStorage.setItem("hfl_pass", pass);
        $("#lock").style.display = "none";
        boot();
      } catch {
        err.textContent = "That passcode didn't work — try again.";
        form.querySelector("button").textContent = "Unlock";
        input.select();
      }
    });
    const saved = sessionStorage.getItem("hfl_pass");
    if (saved) {
      tryUnlock(saved)
        .then((d) => { DATA = d; $("#lock").style.display = "none"; boot(); })
        .catch(() => sessionStorage.removeItem("hfl_pass"));
    }
  }

  /* ---------- tabs ---------- */
  function initTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x === t));
        document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === t.dataset.panel));
      });
    });
  }

  /* ---------- derived data ---------- */
  const themeById = (id) => DATA.themes.find((t) => t.id === id) || { label: id, emoji: "" };
  const byMonth = () => {
    const m = {};
    for (const e of DATA.entries) (m[e.date.slice(0, 7)] = m[e.date.slice(0, 7)] || []).push(e);
    return m;
  };

  /* ---------- raw data tab ---------- */
  function renderRaw(filter = "") {
    const root = $("#rawList");
    root.innerHTML = "";
    const months = byMonth();
    const q = filter.toLowerCase();
    const keys = Object.keys(months).sort().reverse();
    let shown = 0;
    for (const ym of keys) {
      const entries = months[ym]
        .filter((e) => !q || e.story.toLowerCase().includes(q) ||
          e.themes.some((t) => themeById(t).label.toLowerCase().includes(q)))
        .sort((a, b) => b.date.localeCompare(a.date));
      if (!entries.length) continue;
      shown += entries.length;
      const avg = entries.reduce((a, e) => a + e.sentiment, 0) / entries.length;
      const block = document.createElement("section");
      block.className = "month-block";
      block.innerHTML = `<div class="month-head"><h3>${monthName(ym)}</h3>
        <span class="count">${entries.length} entr${entries.length === 1 ? "y" : "ies"} · avg sentiment
        <span style="color:${sentColor(avg)}">${avg >= 0 ? "+" : ""}${avg.toFixed(2)}</span></span></div>`;
      for (const e of entries) {
        const { day, dow } = fmtDate(e.date);
        const div = document.createElement("article");
        div.className = "entry";
        div.innerHTML = `
          <div class="d">${day}<span class="dow">${dow}</span></div>
          <div>
            <p class="story">${esc(e.story)}</p>
            <div class="meta">
              ${e.themes.map((t) => `<span class="chip">${themeById(t).emoji} ${themeById(t).label}</span>`).join("")}
              <span class="sdot" style="background:${sentColor(e.sentiment)}" title="${sentWord(e.sentiment)}"></span>
              <span class="sval">${e.sentiment >= 0 ? "+" : ""}${e.sentiment.toFixed(1)}</span>
            </div>
          </div>`;
        block.appendChild(div);
      }
      root.appendChild(block);
    }
    $("#rawCount").textContent = q ? `${shown} matching entries` : `${DATA.entries.length} entries`;
  }

  /* ---------- summary tab ---------- */
  function renderSummary(ym) {
    const s = DATA.summaries[ym];
    const root = $("#sumBody");
    if (!s) { root.innerHTML = ""; return; }
    const months = byMonth();
    const n = (months[ym] || []).length;
    root.innerHTML = `<div class="headline">${esc(s.headline)}
      <div style="color:var(--muted);font-size:12.5px;margin-top:4px">${n} entries this month</div></div>`;
    const grid = document.createElement("div");
    grid.className = "sumgrid";
    for (const sec of s.sections) {
      const t = themeById(sec.theme);
      const card = document.createElement("div");
      card.className = "sumcard";
      card.innerHTML = `<h4><span>${t.emoji}</span> ${t.label}</h4>
        <ul>${sec.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
      grid.appendChild(card);
    }
    root.appendChild(grid);
  }

  function initSummary() {
    const sel = $("#monthSel");
    const keys = Object.keys(DATA.summaries).sort().reverse();
    sel.innerHTML = keys.map((k) => `<option value="${k}">${DATA.summaries[k].label}</option>`).join("");
    sel.addEventListener("change", () => renderSummary(sel.value));
    sel.value = keys[0];
    renderSummary(keys[0]);
  }

  /* ---------- analytics tab ---------- */
  function renderAnalytics() {
    const entries = [...DATA.entries].sort((a, b) => a.date.localeCompare(b.date));
    const months = byMonth();
    const mkeys = Object.keys(months).sort();

    /* KPIs */
    const total = entries.length;
    const d0 = new Date(entries[0].date), d1 = new Date(entries[entries.length - 1].date);
    const span = Math.round((d1 - d0) / 86400000) + 1;
    const dates = new Set(entries.map((e) => e.date));
    let streak = 0, best = 0;
    for (let t = +d0; t <= +d1; t += 86400000) {
      const s = new Date(t).toISOString().slice(0, 10);
      if (dates.has(s)) { streak++; best = Math.max(best, streak); } else streak = 0;
    }
    // current streak = trailing
    let cur = 0;
    for (let t = +d1; t >= +d0; t -= 86400000) {
      const s = new Date(t).toISOString().slice(0, 10);
      if (dates.has(s)) cur++; else break;
    }
    const avgS = entries.reduce((a, e) => a + e.sentiment, 0) / total;
    const themeCount = {};
    entries.forEach((e) => e.themes.forEach((t) => (themeCount[t] = (themeCount[t] || 0) + 1)));
    const topTheme = Object.entries(themeCount).sort((a, b) => b[1] - a[1])[0];
    const words = entries.map((e) => e.story.split(/\s+/).length).reduce((a, b) => a + b, 0);

    $("#kpis").innerHTML = `
      <div class="kpi"><div class="k">Entries</div><div class="v">${total}</div><div class="s">over ${span} days</div></div>
      <div class="kpi"><div class="k">Coverage</div><div class="v">${Math.round((total / span) * 100)}%</div><div class="s">of days captured</div></div>
      <div class="kpi"><div class="k">Current streak</div><div class="v">${cur}</div><div class="s"><span class="up">longest ${best} days</span></div></div>
      <div class="kpi"><div class="k">Avg sentiment</div><div class="v" style="color:${sentColor(avgS)}">${avgS >= 0 ? "+" : ""}${avgS.toFixed(2)}</div><div class="s">on a −1 … +1 scale</div></div>
      <div class="kpi"><div class="k">Top theme</div><div class="v" style="font-size:19px;padding-top:6px">${themeById(topTheme[0]).emoji} ${themeById(topTheme[0]).label}</div><div class="s">${topTheme[1]} of ${total} entries (${Math.round((topTheme[1] / total) * 100)}%)</div></div>
      <div class="kpi"><div class="k">Words written</div><div class="v">${words.toLocaleString()}</div><div class="s">≈ ${Math.round(words / total)} per entry</div></div>`;

    /* entries per month */
    Charts.columns($("#chMonths"), mkeys.map((k) => ({
      label: monthName(k).split(" ")[0],
      value: months[k].length,
      topLabel: months[k].length,
      tip: `<strong>${monthName(k)}</strong><br>${months[k].length} entries`,
    })), { height: 210 });

    /* theme frequency */
    const themesSorted = Object.entries(themeCount).sort((a, b) => b[1] - a[1]);
    Charts.hbars($("#chThemes"), themesSorted.map(([id, n]) => {
      const t = themeById(id);
      return {
        label: `${t.emoji} ${t.label}`,
        value: n,
        tip: `<strong>${t.label}</strong><br>${n} entries (${Math.round((n / total) * 100)}% of all)`,
      };
    }), { labelWidth: 150 });

    /* sentiment over time */
    const pts = entries.map((e) => ({
      x: new Date(e.date + "T00:00:00"),
      y: e.sentiment,
      tip: `<div class="t-d">${new Date(e.date + "T00:00:00").toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })} · ${sentWord(e.sentiment)} ${e.sentiment >= 0 ? "+" : ""}${e.sentiment.toFixed(1)}</div>${esc(e.story)}`,
    }));
    // 7-day centered rolling average
    const avg = pts.map((p, i) => {
      const win = pts.filter((q) => Math.abs(+q.x - +p.x) <= 3.5 * 86400000);
      return { x: p.x, y: win.reduce((a, q) => a + q.y, 0) / win.length };
    });
    Charts.line($("#chSent"), pts, { avg, ymin: -1, ymax: 1, yticks: [-1, -0.5, 0, 0.5, 1], height: 250 });

    /* sentiment mix by month (diverging) */
    Charts.diverging($("#chMix"), mkeys.map((k) => {
      const es = months[k];
      const neg = es.filter((e) => e.sentiment <= -0.15).length;
      const pos = es.filter((e) => e.sentiment >= 0.15).length;
      const neu = es.length - neg - pos;
      const lbl = monthName(k).split(" ")[0];
      return {
        label: lbl, neg, neu, pos,
        tips: {
          neg: `<strong>${lbl}</strong>: ${neg} negative day${neg === 1 ? "" : "s"}`,
          neu: `<strong>${lbl}</strong>: ${neu} neutral day${neu === 1 ? "" : "s"}`,
          pos: `<strong>${lbl}</strong>: ${pos} positive day${pos === 1 ? "" : "s"}`,
        },
      };
    }), {});

    /* theme × month heatmap */
    const topIds = themesSorted.slice(0, 8).map(([id]) => id);
    Charts.heatmap($("#chHeat"),
      topIds.map((id) => ({ id, label: `${themeById(id).emoji} ${themeById(id).label}` })),
      mkeys.map((k) => ({ id: k, label: monthName(k).split(" ")[0] })),
      (r, c) => {
        const n = (months[c.id] || []).filter((e) => e.themes.includes(r.id)).length;
        return { value: n, tip: `<strong>${themeById(r.id).label}</strong> · ${monthName(c.id)}<br>${n} entr${n === 1 ? "y" : "ies"}` };
      },
      { labelWidth: 150 });

    /* most-written-about (proper nouns / topics) */
    const stop = new Set("the a an and or but with for from to of in on at is was were are be been got get had has have do did very much more most this that these those my me i we our us he she her his they them their it its as by after before about into over under again just also so not no lol haha ha phew sigh finally since while when where which who whom what since because though despite around out up down off then than too still ever never both all some any few couple another other same day days month week whole time first last next new good bad big small long short high low today yesterday another lot bit way back home going went come came".split(/\s+/));
    const freq = {};
    for (const e of entries) {
      const tokens = e.story.replace(/[’']/g, "'").split(/[^A-Za-z0-9']+/);
      const seen = new Set();
      for (const tk of tokens) {
        const w = tk.toLowerCase();
        if (w.length < 3 || stop.has(w) || seen.has(w)) continue;
        seen.add(w);
        freq[w] = (freq[w] || 0) + 1;
      }
    }
    const nice = { hk: "HK", urmi: "Urmi", grab: "Grab", gopuff: "Gopuff", photon: "Photon", mumma: "Mumma", biriyani: "biriyani", lalamove: "Lalamove", sodexo: "Sodexo", odissi: "Odissi", dhunuchi: "dhunuchi", golu: "Golu" };
    const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);
    Charts.hbars($("#chWords"), topWords.map(([w, n]) => ({
      label: nice[w] || w,
      value: n,
      tip: `<strong>${nice[w] || w}</strong> appears in ${n} entries`,
    })), { labelWidth: 110 });

    /* weekday pattern */
    const dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dowAgg = dows.map(() => ({ n: 0, s: 0 }));
    for (const e of entries) {
      const i = (new Date(e.date + "T00:00:00").getDay() + 6) % 7;
      dowAgg[i].n++; dowAgg[i].s += e.sentiment;
    }
    Charts.columns($("#chDow"), dows.map((d, i) => ({
      label: d,
      value: dowAgg[i].n,
      tip: `<strong>${d}</strong><br>${dowAgg[i].n} entries · avg sentiment ${dowAgg[i].n ? (dowAgg[i].s / dowAgg[i].n >= 0 ? "+" : "") + (dowAgg[i].s / dowAgg[i].n).toFixed(2) : "—"}`,
    })), { height: 200 });

    /* insights */
    $("#insights").innerHTML = DATA.insights.map((i) => `<li>${esc(i)}</li>`).join("");
  }

  /* ---------- boot ---------- */
  function boot() {
    $("#rangeSub").textContent =
      `${new Date(DATA.meta.range.start).toLocaleDateString("en-SG", { day: "numeric", month: "short" })} – ${new Date(DATA.meta.range.end).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })} · ${DATA.entries.length} moments`;
    renderRaw();
    $("#rawSearch").addEventListener("input", (e) => renderRaw(e.target.value));
    initSummary();
    renderAnalytics();
    $("#lockBtn").style.display = "";
    $("#lockBtn").addEventListener("click", () => {
      sessionStorage.removeItem("hfl_pass");
      location.reload();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initTabs();
    initLock();
  });
})();
