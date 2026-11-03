import { hemicycleSeats, isUnknown, orderFactions, rulingStatus, seatsOf, validate, validatePolicies } from "./lib.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function fmtDate(s) {
  const [y, m, d] = s.split("-");
  return d ? `${y}年${+m}月${+d}日` : m ? `${y}年${+m}月` : `${y}年`;
}

function renderKpis(data) {
  const latest = [...data.polls].sort((a, b) => b.date.localeCompare(a.date));
  const avg = latest.reduce((s, p) => s + p.approve, 0) / latest.length;
  const cards = [
    { label: "内閣総理大臣", value: data.government.primeMinister, sub: data.government.party },
    { label: "内閣支持率（直近調査の平均）", value: `${avg.toFixed(1)}%`, sub: `${latest.length}調査・${fmtDate(latest[latest.length - 1].date)}〜` },
    ...data.houses.map((h) => {
      const st = rulingStatus(h);
      const badge = st.hasSupermajority
        ? `<span class="badge ok">3分の2超</span>`
        : st.hasMajority
          ? `<span class="badge ok">過半数</span>`
          : `<span class="badge ng">過半数まで${st.toMajority}</span>`;
      return { label: `${h.name} 与党議席`, value: `${st.ruling}<small>/${h.total}</small>`, sub: badge, raw: true };
    }),
  ];
  $("kpis").innerHTML = cards
    .map(
      (c) => `<div class="kpi"><div class="label">${esc(c.label)}</div>
        <div class="value">${c.raw ? c.value : esc(c.value)}</div>
        <div class="sub">${c.raw ? c.sub : esc(c.sub)}</div></div>`,
    )
    .join("");
}

function renderGovernment(g) {
  $("government").innerHTML = `
    <div class="gov">
      <span class="pm">${esc(g.primeMinister)}</span>
      <span>${esc(g.cabinetName)}</span>
    </div>
    <dl class="gov">
      <dt>与党</dt><dd>${g.coalition.map(esc).join("・")}</dd>
      <dt>首相就任</dt><dd>${fmtDate(g.pmSince)}</dd>
      <dt>現内閣発足</dt><dd>${fmtDate(g.cabinetSince)}</dd>
    </dl>
    <p class="note">${esc(g.note)}</p>`;
}

function renderHouse(house, parties) {
  const ordered = orderFactions(house.factions);
  const W = 400;
  const seats = hemicycleSeats(house.total, { width: W });
  const colors = ordered.flatMap((f) => Array(f.seats).fill(parties[f.party].color));
  const titles = ordered.flatMap((f) => Array(f.seats).fill(f.label));
  const circles = seats
    .map((s, i) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.r.toFixed(1)}" fill="${colors[i]}"><title>${esc(titles[i])}</title></circle>`)
    .join("");
  const st = rulingStatus(house);

  const bar = ordered
    .map((f) => `<span style="width:${(f.seats / house.total) * 100}%;background:${parties[f.party].color}" title="${esc(f.label)} ${f.seats}"></span>`)
    .join("");

  const legend = ordered
    .map(
      (f) => `<li class="${f.ruling ? "ruling" : ""}"><span class="sw" style="background:${parties[f.party].color}"></span>
        <span class="nm" title="${esc(f.label)}">${esc(f.label)}</span><span class="n">${f.seats}</span></li>`,
    )
    .join("");

  const el = document.createElement("section");
  el.className = "card";
  el.innerHTML = `
    <h2>${esc(house.name)}（定数${house.total}）</h2>
    <svg class="hemicycle" viewBox="0 0 ${W} ${W / 2 + 8}" role="img" aria-label="${esc(house.name)}の会派別議席">
      ${circles}
      <text class="center" x="${W / 2}" y="${W / 2 - 22}" text-anchor="middle" font-size="26">${st.ruling}</text>
      <text class="center-sub" x="${W / 2}" y="${W / 2 - 4}" text-anchor="middle" font-size="12">与党</text>
    </svg>
    <div class="seatbar">${bar}</div>
    <div class="thresholds">過半数 ${house.majority}／3分の2 ${house.supermajority}　・　${esc(house.source)}（${esc(house.asOf)}）</div>
    <ul class="legend">${legend}</ul>`;
  return el;
}

function renderPolls(polls) {
  $("polls").innerHTML = [...polls]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p) => {
      const d = p.disapprove ?? 0;
      return `<div class="poll">
        <div class="who">${esc(p.pollster)}<small>${fmtDate(p.date)}</small></div>
        <div class="bar" role="img" aria-label="支持${p.approve}% 不支持${p.disapprove ?? "不明"}%">
          <span class="a" style="width:${p.approve}%">${p.approve}%</span>
          ${p.disapprove != null ? `<span class="d" style="width:${d}%">${d}%</span>` : ""}
        </div></div>`;
    })
    .join("") + `<p class="note"><span style="color:var(--ok)">■</span> 支持　<span style="color:var(--warn)">■</span> 不支持</p>`;
}

function renderCalendar(items, today) {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const nextIdx = sorted.findIndex((e) => e.date >= today.slice(0, e.date.length));
  $("calendar").innerHTML = sorted
    .map((e, i) => {
      const cls = i < nextIdx || nextIdx === -1 ? "past" : i === nextIdx ? "next" : "";
      return `<li class="${cls}"><time datetime="${e.date}">${fmtDate(e.date)}</time>
        <div class="t">${esc(e.title)}</div><div class="d">${esc(e.detail ?? "")}</div></li>`;
    })
    .join("");
}

function renderCabinet(list) {
  $("cabinet").innerHTML = list
    .map(
      (m) => `<li><div class="post">${esc(m.post)}</div><div class="name">${esc(m.name)}</div>
        ${m.note ? `<div class="warn">${esc(m.note)}</div>` : ""}</li>`,
    )
    .join("");
}

function renderSources(list) {
  $("sources").innerHTML = list
    .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`)
    .join("");
}

const PLANNED = /予定|策定/;

function renderAgenda(items) {
  $("agenda").innerHTML = items
    .map(
      (a) => `<article class="agenda-item">
        <div class="meta"><span class="status ${PLANNED.test(a.status) ? "plan" : ""}">${esc(a.status)}</span>${esc(a.area)}</div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.summary)}</p>
        ${a.points?.length ? `<ul>${a.points.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        <div class="src">出典：${a.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join("、")}</div>
      </article>`,
    )
    .join("");
}

function renderIssues(policies, parties, shugiin) {
  const keys = policies.issueParties;
  $("issues-note").textContent = policies.issuesNote;
  const seatLabel = (k) => {
    const n = seatsOf(shugiin, k);
    return n ? `衆${n}` : "衆院会派なし";
  };

  const tabs = $("issue-tabs");
  tabs.innerHTML = policies.issues
    .map((it, i) => `<button role="tab" id="tab-${it.id}" aria-controls="issue-detail" aria-selected="${i === 0}" data-id="${it.id}">${esc(it.title)}</button>`)
    .join("");

  const show = (id) => {
    const it = policies.issues.find((x) => x.id === id) ?? policies.issues[0];
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === it.id)));
    $("issue-detail").setAttribute("aria-labelledby", `tab-${it.id}`);
    $("issue-detail").innerHTML = `
      <p class="issue-q">${esc(it.question)}</p>
      <ul class="positions">${keys
        .map((k) => {
          const pos = it.positions[k];
          const p = parties[k];
          return `<li class="${isUnknown(pos) ? "unknown" : ""}" style="--pc:${p.color}">
            <span class="pn" title="${esc(p.full ?? p.name)}">${esc(p.name)}<small>${seatLabel(k)}</small></span>
            <span class="ps">${esc(pos?.short ?? "未確認")}</span>
            <span class="pd">${esc(pos?.detail || "調べた資料では確認できませんでした")}</span></li>`;
        })
        .join("")}</ul>
      <p class="note">出典：${it.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join("、")}</p>`;
  };
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (b) show(b.dataset.id);
  });
  tabs.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const btns = [...tabs.querySelectorAll("button")];
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    const next = btns[(i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length];
    next.focus();
    show(next.dataset.id);
  });
  show(policies.issues[0].id);

  $("matrix").innerHTML = `
    <thead><tr><th scope="col">政党</th>${policies.issues.map((it) => `<th scope="col">${esc(it.title)}</th>`).join("")}</tr></thead>
    <tbody>${keys
      .map((k) => {
        const p = parties[k];
        return `<tr><th scope="row" style="--pc:${p.color}" title="${esc(p.full ?? p.name)}">${esc(p.name)}</th>${policies.issues
          .map((it) => {
            const pos = it.positions[k];
            return `<td class="${isUnknown(pos) ? "unknown" : ""}" title="${esc(pos?.detail ?? "")}">${esc(pos?.short ?? "未確認")}</td>`;
          })
          .join("")}</tr>`;
      })
      .join("")}</tbody>`;
}

async function main() {
  try {
    const load = async (path) => {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json();
    };
    const [data, policies] = await Promise.all([load("data/politics.json"), load("data/policies.json")]);
    const errors = [...validate(data), ...validatePolicies(policies, data.parties)];
    if (errors.length) console.warn("データ整合性エラー:", errors);

    $("updated").textContent = fmtDate(data.updatedAt);
    $("updated").dateTime = data.updatedAt;
    renderKpis(data);
    renderGovernment(data.government);
    const houses = $("houses");
    data.houses.forEach((h) => houses.appendChild(renderHouse(h, data.parties)));
    renderAgenda(policies.agenda);
    renderIssues(policies, data.parties, data.houses.find((h) => h.id === "shugiin"));
    renderPolls(data.polls);
    renderCalendar(data.calendar, new Date().toISOString().slice(0, 10));
    renderCabinet(data.cabinet);
    renderSources(data.sources);
  } catch (e) {
    document.querySelector("main").insertAdjacentHTML(
      "afterbegin",
      `<p class="card error">データを読み込めませんでした（${esc(e.message)}）。ローカルで開く場合は README の手順でサーバーを起動してください。</p>`,
    );
  }
}

main();
