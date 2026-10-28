(function () {
  "use strict";
  const D = window.DATA;
  const $app = document.getElementById("app");
  const $q = document.getElementById("q");
  const $clear = document.getElementById("clear");

  const GROUPS = {
    "Fixed recipes": { id: "fixed-recipes", emoji: "🍕", name: "Basic recipes", desc: "Fixed orders, sorted by their last topping" },
    "Named recipes": { id: "named-recipes", emoji: "📛", name: "Named recipes", desc: "Margherita, Hawaiian, Supreme…" },
    "Variable Recipes": { id: "variable-recipes", emoji: "🎲", name: "Variable recipes", desc: "Vegan, All Meats, Spicy… (change as toppings are added)" },
    "Customizations": { id: "customizations", emoji: "🔪", name: "Customizations", desc: "Pesto, slice counts, well done" },
    "Chapters": { id: "chapters", emoji: "📚", name: "Story customers", desc: "Orders by chapter and character" },
    "Special characters": { id: "special-characters", emoji: "⭐", name: "Special characters", desc: "Firefighter, Critic, Dracula…" },
    "Events": { id: "events", emoji: "🎃", name: "Events", desc: "Current event orders" },
  };
  const FILTERS = [
    ["all", "All"], ["Fixed recipes", "Basic"], ["Named recipes", "Named"], ["Variable Recipes", "Variable"],
    ["Chapters", "Story"], ["Special characters", "Special"], ["Events", "Events"], ["Customizations", "Custom"],
  ];

  const COLORS = {
    Pepperoni: "#b3271f", Sausage: "#8a5a3c", Mushroom: "#cdb79a", Olive: "#2e2e22", Onion: "#e6d4ef", "Bell Pepper": "#4c9a3a",
    Bacon: "#c9674a", Pineapple: "#f2d23c", Anchovy: "#7d8a99", Ham: "#e9a0a0", Basil: "#2f7a2f", Eggplant: "#5b3a7a",
    Shrimp: "#f29a6b", Corn: "#f5c518", Chicken: "#f1d9b0", Garlic: "#f4efe0", "Sliced Tomato": "#e04a3a", Jalapeno: "#6fa83a",
    Avocado: "#8fb04a", Truffle: "#3b2a22", Fig: "#6b3a58", Zucchini: "#7fb06a", Artichoke: "#8da86a", Duck: "#a5683a",
    Peach: "#f6a96b", Apple: "#d33b3b", Scallop: "#f7e7d3", "Pork Belly": "#d98c7a", Tofu: "#f3ecd8", Potato: "#d9b36c",
    Pumpkin: "#e8861f", "Rose Petal": "#d6406a",
  };
  const EMOJI = { Avocado: "🥑" };
  const SAUCES = ["Sauce", "Tomato Sauce", "Pesto Sauce"];

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’‘`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const tokensOf = (q) => norm(q).split(" ").filter((t) => t.length > 1 || /\d/.test(t));
  const enc = encodeURIComponent;
  const sectionById = Object.fromEntries(D.sections.map((s) => [s.id, s]));

  function highlight(text, toks) {
    let out = esc(text);
    if (!toks || !toks.length) return out;
    const parts = toks.map((t) => t.split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("['’]?"));
    const re = new RegExp("(" + parts.join("|") + ")", "gi");
    return out.replace(/(&[a-z#0-9]+;)|([^&]+|&)/g, (m, ent, txt) => (ent ? ent : txt.replace(re, "<mark>$1</mark>")));
  }

  function imgFor(name) {
    const f = D.images[name];
    return f ? `img/${f}.webp` : null;
  }
  function chip(name) {
    const src = imgFor(name);
    const icon = src ? `<img src="${src}" alt="" loading="lazy">` : `<span class="ph">${EMOJI[name] || "🍴"}</span>`;
    return `<span class="chip">${icon}${esc(name)}</span>`;
  }

  /* ---------- pizza rendering ---------- */
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function halvesOf(pz) {
    const c = pz.common, h = pz.halves;
    if (!h.length) return [c.slice()];
    if (h.length === 1) return [c.concat(h[0]), c.slice()];
    return [c.concat(h[0]), c.concat(h[1])];
  }
  const sauceOf = (set) => set.find((x) => SAUCES.includes(x)) || null;
  const baseOnly = (n) => n === "Wheat Dough" || n === "Cheese" || SAUCES.includes(n);

  function pizzaSVG(pz, halves) {
    const wheat = pz.common.concat(...pz.halves).includes("Wheat Dough");
    const split = halves.length > 1;
    let body = `<image href="img/Ingredients_PlainDough-Cooked.webp" x="1" y="1" width="98" height="98" ${wheat ? 'style="filter:sepia(.55) saturate(1.1) brightness(.78)"' : ""}/>`;
    const clips = split ? ["clip-path:inset(0 50% 0 0)", "clip-path:inset(0 0 0 50%)"] : [""];
    halves.forEach((set, i) => {
      const sauce = sauceOf(set);
      let g = "";
      if (sauce) g += `<circle cx="50" cy="50" r="39" fill="${sauce === "Pesto Sauce" ? "#6c9a3d" : "#c9382c"}" opacity=".92"/>`;
      if (set.includes("Cheese")) g += `<circle cx="50" cy="50" r="35" fill="#f7d774" opacity="${sauce ? ".8" : ".95"}"/>`;
      set.filter((n) => !baseOnly(n)).forEach((n) => {
        let h = hash(n);
        for (let k = 0; k < 6; k++) {
          h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
          const ang = (h % 1000) / 1000 * Math.PI;
          const rad = 8 + ((h >>> 10) % 1000) / 1000 * 28;
          const side = split ? (i === 0 ? 1 : -1) : (k % 2 ? 1 : -1);
          const x = 50 - side * Math.sin(ang) * rad, y = 50 + Math.cos(ang) * rad;
          g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="${COLORS[n] || "#888"}" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>`;
        }
      });
      body += `<g style="${clips[i] || ""}">${g}</g>`;
    });
    if (split) body += `<line x1="50" y1="6" x2="50" y2="94" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 3" opacity=".9"/>`;
    return `<svg viewBox="0 0 100 100" role="img" aria-label="Pizza diagram">${body}</svg>`;
  }

  function baseTags(set) {
    const out = [];
    const s = sauceOf(set);
    out.push(s ? `<span class="tag ${s === "Pesto Sauce" ? "pesto" : "sauce"}">${s === "Pesto Sauce" ? "🌿 Pesto" : s === "Tomato Sauce" ? "🍅 Tomato sauce" : "🍅 Sauce"}</span>` : `<span class="tag no">Sauce</span>`);
    out.push(set.includes("Cheese") ? `<span class="tag cheese">🧀 Cheese</span>` : `<span class="tag no">Cheese</span>`);
    return out.join("");
  }

  function pizzaBlock(pz) {
    const halves = halvesOf(pz);
    const all = pz.common.concat(...pz.halves);
    const wheat = all.includes("Wheat Dough");
    const tags = [wheat ? `<span class="tag wheat">🌾 Wheat dough</span>` : `<span class="tag reg">Regular dough</span>`];
    if (pz.count > 1) tags.unshift(`<span class="tag count">× ${pz.count} pizzas</span>`);
    pz.mods.forEach((m) => tags.push(`<span class="tag mod">🔥 ${esc(m)}</span>`));
    const toppings = (set) => set.filter((n) => !baseOnly(n));
    let rows = "";
    if (halves.length > 1) {
      ["Left half", "Right half"].forEach((label, i) => {
        const t = toppings(halves[i]);
        rows += `<div class="half"><div class="half-label">${label}</div><div class="tags">${baseTags(halves[i])}</div>` +
          `<div class="chips">${t.length ? t.map(chip).join("") : '<span class="empty-note">no toppings</span>'}</div></div>`;
      });
    } else {
      const t = toppings(halves[0]);
      rows += `<div class="tags">${baseTags(halves[0])}</div>`;
      rows += `<div class="chips">${t.length ? t.map(chip).join("") : (all.length <= 1 && !sauceOf(halves[0]) && !halves[0].includes("Cheese") ? '<span class="empty-note">just plain dough</span>' : '<span class="empty-note">no toppings</span>')}</div>`;
    }
    return `<div class="pizza">${pizzaSVG(pz, halves)}<div class="info"><div class="tags">${tags.join("")}</div>${rows}</div></div>`;
  }

  function recipeBlock(e) {
    if (e.kind === "special") return `<div class="special">${esc(e.label)}${/anything/i.test(e.label) ? " — any pizza is accepted" : ""}</div>`;
    return `<div class="pizzas">${e.pizzas.map(pizzaBlock).join("")}</div>`;
  }

  /* ---------- cards ---------- */
  function crumbs(sec) {
    const p = sec.path;
    const links = [];
    for (let i = 0; i < p.length; i++) {
      const id = D.sections.find((s) => s.path.length === i + 1 && s.path.every((x, j) => x === p[j]));
      links.push(id && i > 0 ? `<a href="#/s/${id.id}">${esc(p[i])}</a>` : esc(i === 0 ? (GROUPS[p[0]] || { name: p[0] }).name : p[i]));
    }
    return links.join(" › ");
  }
  function titleOf(sec) {
    const p = sec.path;
    return p.length > 1 ? p[p.length - 1] : p[0];
  }

  function orderCard(e, toks) {
    const sec = sectionById[e.section];
    const lines = e.dialogue.map((d) => {
      const extra = Object.keys(d).filter((k) => k !== "q" && k !== "a").map((k) => d[k]);
      const alts = [d.a, ...extra].filter(Boolean);
      return `<div class="say">${d.q ? `<p class="q">${highlight(d.q, toks)}</p>` : ""}` +
        alts.map((a) => `<p class="a"><b>${d.q ? 'Ask “What?”' : "Says"}</b> ${highlight(a, toks)}</p>`).join("") + `</div>`;
    }).join("");
    const notes = e.notes.map((n) => `<div class="note">💡 ${esc(n)}</div>`).join("");
    const named = /^(Named|Variable)/.test(sec.path[0]) && sec.path[1];
    return `<article class="card">
      <div class="card-head">
        <h3>${esc(named ? sec.path[1] : titleOf(sec))}</h3>
        <span class="where">${crumbs(sec)}</span>
      </div>
      ${recipeBlock(e)}
      <div class="lines">${lines || '<div class="empty-note">No dialogue recorded.</div>'}</div>
      ${notes}
      <div class="raw">${esc(e.raw)}</div>
    </article>`;
  }

  function bookCard(r) {
    return `<article class="card">
      <div class="card-head"><h3>${esc(r.name)}</h3><span class="where">Unlocked: ${esc(r.unlocked || "?")}</span></div>
      ${recipeBlock(r)}
      <a href="#/search/${enc(r.name)}">Find customers asking for this →</a>
    </article>`;
  }

  /* ---------- search ---------- */
  const blobs = D.entries.map((e) => {
    const sec = sectionById[e.section];
    const dlg = e.dialogue.map((d) => Object.values(d).join(" ")).join(" ");
    return { e, dlg: norm(dlg), meta: norm(sec.path.join(" ") + " " + e.notes.join(" ") + " " + e.raw + " " + (e.label || "")) };
  });
  const bookBlobs = D.book.map((r) => ({ r, text: norm(r.name + " " + r.raw + " " + r.group + " " + r.unlocked) }));

  function search(q, filter) {
    const toks = tokensOf(q);
    if (!toks.length) return { toks, hits: [], approx: false, book: [] };
    const phrase = norm(q);
    const scoreOf = (b) => {
      let matched = 0, s = 0;
      for (const t of toks) {
        if (b.dlg.includes(t)) { matched++; s += 3; }
        else if (b.meta.includes(t)) { matched++; s += 1; }
      }
      if (b.dlg.includes(phrase)) s += 20;
      return { matched, s };
    };
    let all = blobs.map((b) => ({ b, ...scoreOf(b) }));
    let hits = all.filter((x) => x.matched === toks.length);
    let approx = false;
    if (!hits.length && toks.length > 1) {
      const need = Math.max(1, Math.ceil(toks.length / 2));
      hits = all.filter((x) => x.matched >= need);
      approx = true;
    }
    hits.sort((a, b) => b.matched - a.matched || b.s - a.s || a.b.e.id - b.b.e.id);
    const counts = {};
    hits.forEach((h) => { const g = sectionById[h.b.e.section].path[0]; counts[g] = (counts[g] || 0) + 1; });
    if (filter && filter !== "all") hits = hits.filter((h) => sectionById[h.b.e.section].path[0] === filter);
    const book = bookBlobs.filter((b) => toks.every((t) => b.text.includes(t))).map((b) => b.r).slice(0, 4);
    return { toks, hits: hits.map((h) => h.b.e), approx, book, counts };
  }

  let searchState = { q: "", filter: "all", shown: 30 };

  function renderSearch(q, keepState) {
    if (!keepState) searchState = { q, filter: "all", shown: 30 };
    const r = search(q, searchState.filter);
    const total = Object.values(r.counts || {}).reduce((a, b) => a + b, 0);
    const pills = FILTERS.filter(([k]) => k === "all" || (r.counts && r.counts[k])).map(([k, label]) =>
      `<button class="pill${searchState.filter === k ? " on" : ""}" data-filter="${esc(k)}">${label} <small>${k === "all" ? total : r.counts[k]}</small></button>`).join("");
    let html = `<h1>Results for “${esc(q)}”</h1>`;
    if (!r.toks.length) html = `<div class="empty">Type a few words from the customer's dialogue, a recipe name, or a topping.</div>`;
    else {
      html += `<div class="results-head">${total ? pills : ""}</div>`;
      if (r.approx && total) html += `<div class="callout">No order contains every word — showing the closest matches.</div>`;
      if (r.book.length && searchState.filter === "all") html += `<div class="sub">Recipe book</div>` + r.book.map(bookCard).join("") + (r.hits.length ? `<div class="sub">Customer orders</div>` : "");
      const list = r.hits.slice(0, searchState.shown);
      html += list.map((e) => orderCard(e, r.toks)).join("");
      if (r.hits.length > list.length) html += `<button class="more" id="more">Show more (${r.hits.length - list.length} left)</button>`;
      if (!r.hits.length && !r.book.length) html += `<div class="empty"><p>No orders found.</p><p>Try fewer or shorter words (e.g. “wheat” instead of “wheatbread”).</p></div>`;
    }
    $app.innerHTML = html;
    $app.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
      searchState.filter = b.dataset.filter; searchState.shown = 30; renderSearch(q, true);
    }));
    const more = document.getElementById("more");
    if (more) more.addEventListener("click", () => { searchState.shown += 40; const y = scrollY; renderSearch(q, true); scrollTo(0, y); });
  }

  /* ---------- pages ---------- */
  function pageHome() {
    const counts = {};
    D.entries.forEach((e) => { const g = sectionById[e.section].path[0]; counts[g] = (counts[g] || 0) + 1; });
    const ideas = ["wheat", "pesto", "well done", "half", "no cheese", "vegan", "anything", "spicy"];
    $app.innerHTML = `
      <section class="hero">
        <img src="img/Ingredients_PlainDough-Cooked.webp" alt="">
        <div>
          <h1>What does the customer want?</h1>
          <p>Search any bit of their dialogue above — you'll get the exact pizza, dough, sauce and toppings. No ads, no videos.</p>
          <div class="pills">${ideas.map((i) => `<a class="pill" href="#/search/${enc(i)}">${i}</a>`).join("")}</div>
        </div>
      </section>
      <div class="grid">
        <a class="tile" href="#/recipes"><div class="emoji">📖</div><h3>Recipe Book</h3><p>${D.book.length} in-game recipes with visuals</p></a>
        ${Object.entries(GROUPS).map(([k, g]) => `<a class="tile" href="#/s/${g.id}"><div class="emoji">${g.emoji}</div><h3>${g.name}</h3><p>${g.desc} · ${counts[k] || 0} orders</p></a>`).join("")}
        <a class="tile" href="#/ingredients"><div class="emoji">🧀</div><h3>Ingredients</h3><p>All toppings, doughs and sauces</p></a>
      </div>
      <h2 class="sec-title">Quick tips <a href="#/tips">all tips →</a></h2>
      <ul class="tips">${D.tips.slice(0, 4).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
  }

  function pageRecipes() {
    const groups = [...new Set(D.book.map((r) => r.group))];
    const f = (location.hash.match(/\?g=(\d+)/) || [])[1];
    const sel = f !== undefined ? groups[+f] : null;
    const list = D.book.filter((r) => !sel || r.group === sel);
    $app.innerHTML = `<h1>Recipe Book</h1><p class="lead">The recipes shown in the game's recipe book. “Sauce” means either tomato or pesto.</p>
      <div class="pills" style="margin-bottom:14px"><a class="pill${sel ? "" : " on"}" href="#/recipes">All <small>${D.book.length}</small></a>
      ${groups.map((g, i) => `<a class="pill${sel === g ? " on" : ""}" href="#/recipes?g=${i}">${esc(g)}</a>`).join("")}</div>
      <div class="book">${list.map(bookCard).join("")}</div>`;
  }

  function descendants(sec) {
    return D.sections.filter((s) => s.path.length >= sec.path.length && sec.path.every((x, i) => x === s.path[i]));
  }

  function pageSection(id) {
    const sec = sectionById[id];
    if (!sec) return page404();
    const subs = descendants(sec);
    if (sec.level === 2) {
      const g = GROUPS[sec.path[0]] || { name: sec.path[0], desc: "" };
      const kids = subs.filter((s) => s.level === 3);
      const cnt = (s) => D.entries.filter((e) => descendants(s).some((x) => x.id === e.section)).length;
      $app.innerHTML = `<div class="crumbs"><a href="#/orders">Orders</a> › ${esc(g.name)}</div><h1>${g.emoji || ""} ${esc(g.name)}</h1><p class="lead">${esc(g.desc || "")}</p>
        ${sec.notes.length ? `<div class="callout">${sec.notes.map((n) => `<p>${esc(n)}</p>`).join("")}</div>` : ""}
        <div class="grid">${kids.map((k) => `<a class="tile" href="#/s/${k.id}"><h3>${esc(k.path[1])}</h3><p>${cnt(k)} orders</p></a>`).join("")}</div>`;
      return;
    }
    const parent = sec.path.length > 2 ? D.sections.find((s) => s.path.length === 2 && s.path.every((x, i) => x === sec.path[i])) : null;
    const group = D.sections.find((s) => s.level === 2 && s.path[0] === sec.path[0]);
    const g = GROUPS[sec.path[0]] || { name: sec.path[0] };
    const kids = subs.filter((s) => s.level > sec.level && D.entries.some((e) => e.section === s.id));
    let html = `<div class="crumbs"><a href="#/orders">Orders</a> › <a href="#/s/${group.id}">${esc(g.name)}</a>${parent ? ` › <a href="#/s/${parent.id}">${esc(parent.path[1])}</a>` : ""}</div><h1>${esc(sec.path[sec.path.length - 1])}</h1>`;
    if (kids.length > 1) html += `<div class="toc">${kids.map((k) => `<a class="pill" href="#" data-jump="${k.id}">${esc(k.path[k.path.length - 1])}</a>`).join("")}</div>`;
    subs.forEach((s) => {
      const es = D.entries.filter((e) => e.section === s.id);
      if (!es.length && !s.notes.length) return;
      if (s.id !== sec.id) html += `<h2 id="sec-${s.id}" style="margin-top:24px">${esc(s.path[s.path.length - 1])}</h2>`;
      if (s.notes.length) html += `<div class="callout">${s.notes.map((n) => `<p>${esc(n)}</p>`).join("")}</div>`;
      html += es.map((e) => orderCard(e)).join("");
    });
    $app.innerHTML = html;
    $app.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", (ev) => {
      ev.preventDefault();
      const el = document.getElementById("sec-" + a.dataset.jump);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  function pageOrders() {
    $app.innerHTML = `<h1>Orders</h1><p class="lead">Browse every order by category. Or just search above.</p>` +
      D.sections.filter((s) => s.level === 2).map((g) => {
        const meta = GROUPS[g.path[0]] || { name: g.path[0], emoji: "" };
        const kids = D.sections.filter((s) => s.level === 3 && s.path[0] === g.path[0]);
        return `<details class="grp"><summary>${meta.emoji || ""} ${esc(meta.name)} <small style="color:var(--muted);font-weight:400">(${kids.length})</small></summary>
          <div class="body"><div class="toc">${kids.map((k) => `<a class="pill" href="#/s/${k.id}">${esc(k.path[1])}</a>`).join("")}</div></div></details>`;
      }).join("");
  }

  function pageIngredients() {
    const order = ["Dough", "Sauce", "Cheese", "Meat", "Fruit", "Vegetable", "Fungus", "Other", ""];
    const byType = {};
    D.ingredients.forEach((i) => { (byType[i.type || "Other"] = byType[i.type || "Other"] || []).push(i); });
    const types = Object.keys(byType).sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
    $app.innerHTML = `<h1>Ingredients</h1><p class="lead">Tap one to find every order using it. In order lists, “Sauce” means either tomato or pesto.</p>` +
      types.map((t) => `<h2 class="sec-title">${esc(t)}</h2><div class="ing-grid">` + byType[t].map((i) => {
        const src = i.image ? `img/${i.image}.webp` : null;
        return `<a class="ing" href="#/search/${enc(i.name)}">${src ? `<img src="${src}" alt="" loading="lazy">` : `<span class="ph">${EMOJI[i.name] || "🍴"}</span>`}<b>${esc(i.name)}</b><small>${esc(i.unlocked || "")}${i.value ? " · " + esc(i.value) : ""}</small></a>`;
      }).join("") + `</div>`).join("");
  }

  function pageTips() {
    $app.innerHTML = `<h1>Tips & how to read orders</h1>
      <ul class="tips">${D.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <h2 class="sec-title">Recipe notation</h2>
      <table class="syntax"><tr><th>Shown as</th><th>Meaning</th></tr>
      <tr><td>Left / Right half</td><td>Half-and-half pizza: put each half's toppings on only that side.</td></tr>
      <tr><td>× 3 pizzas</td><td>Make that pizza the given number of times.</td></tr>
      <tr><td><span class="tag no">Sauce</span> <span class="tag no">Cheese</span></td><td>Struck-through means leave it off.</td></tr>
      <tr><td>🍅 Sauce</td><td>Either tomato or pesto works unless a specific one is shown.</td></tr>
      <tr><td><span class="tag wheat">🌾 Wheat dough</span></td><td>Use the brown wheat dough instead of regular.</td></tr>
      <tr><td><span class="tag mod">🔥 Well done</span></td><td>Put the baked pizza back in the oven.</td></tr></table>
      <p class="lead" style="margin-top:18px">Data comes from the community wiki export. Spotted a mistake? Rerun <code>tools/build_data.py</code> after updating the XML.</p>`;
  }

  function page404() { $app.innerHTML = `<div class="empty"><h2>Not found</h2><a href="#/">Back home</a></div>`; }

  /* ---------- router ---------- */
  let lastPage = "#/";
  function route() {
    const h = location.hash || "#/";
    const m = h.match(/^#\/search\/(.*)$/);
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", h.startsWith("#/" + (a.dataset.nav === "home" ? "" : a.dataset.nav)) && (a.dataset.nav !== "home" || h === "#/")));
    if (m) {
      const q = decodeURIComponent(m[1]);
      if (document.activeElement !== $q) $q.value = q;
      $clear.hidden = !q;
      if (!(searchState.q === q && $app.querySelector(".results-head"))) { renderSearch(q); searchState.q = q; }
      return;
    }
    lastPage = h;
    $q.value = ""; $clear.hidden = true;
    const p = h.split("?")[0];
    if (p === "#/" || p === "#") pageHome();
    else if (p === "#/recipes") pageRecipes();
    else if (p === "#/orders") pageOrders();
    else if (p === "#/ingredients") pageIngredients();
    else if (p === "#/tips") pageTips();
    else if (p.startsWith("#/s/")) pageSection(p.slice(4));
    else page404();
    window.scrollTo(0, 0);
  }

  let timer;
  $q.addEventListener("input", () => {
    $clear.hidden = !$q.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const v = $q.value.trim();
      if (!v) { if (location.hash.startsWith("#/search")) location.replace(lastPage); return; }
      const target = "#/search/" + enc(v);
      if (location.hash.startsWith("#/search/")) location.replace(target);
      else location.hash = target;
    }, 180);
  });
  document.getElementById("searchForm").addEventListener("submit", (e) => { e.preventDefault(); $q.blur(); });
  $clear.addEventListener("click", () => { $q.value = ""; $clear.hidden = true; $q.focus(); if (location.hash.startsWith("#/search")) location.replace(lastPage); });
  document.addEventListener("keydown", (e) => {
    const t = e.target.tagName;
    if (e.key === "/" && t !== "INPUT" && t !== "TEXTAREA") { e.preventDefault(); $q.focus(); $q.select(); }
    else if (e.key === "Escape" && document.activeElement === $q) $clear.click();
  });

  const root = document.documentElement;
  const saved = localStorage.getItem("theme");
  if (saved) root.dataset.theme = saved;
  else if (matchMedia("(prefers-color-scheme: dark)").matches) root.dataset.theme = "dark";
  document.getElementById("theme").addEventListener("click", () => {
    const n = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = n; localStorage.setItem("theme", n);
  });

  window.addEventListener("hashchange", route);
  route();
})();
