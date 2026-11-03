import { emblem, EMBLEMS } from "./emblems.js";
import {
  isUnknown,
  layoutTerritories,
  orderFactions,
  prefLeader,
  rulingStatus,
  seatsOf,
  validate,
  validatePolicies,
  validatePrefectures,
} from "./lib.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const link = (s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`;

function fmtDate(s) {
  const [y, m, d] = s.split("-");
  return d ? `${y}年${+m}月${+d}日` : m ? `${y}年${+m}月` : `${y}年`;
}

/** 古地図の水彩の斜線（政党ごと） */
function hatchDefs(id, parties) {
  return Object.entries(parties)
    .map(
      ([k, p], i) => `<pattern id="${id}-${k}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(${30 + i * 17})">
        <rect width="7" height="7" fill="${p.color}" style="fill-opacity:var(--fill-op)"/>
        <line x1="0" y1="0" x2="0" y2="7" stroke="${p.color}" stroke-width="1.4" opacity=".55"/></pattern>`,
    )
    .join("");
}

// ---------------------------------------------------------------- 概要
function renderKpis(data) {
  const latest = [...data.polls].sort((a, b) => b.date.localeCompare(a.date));
  const avg = latest.reduce((s, p) => s + p.approve, 0) / latest.length;
  const cards = [
    { label: "内閣総理大臣", value: esc(data.government.primeMinister), sub: esc(data.government.party) },
    { label: "内閣支持率（直近調査の平均）", value: `${avg.toFixed(1)}%`, sub: `${latest.length}調査・${fmtDate(latest.at(-1).date)}〜` },
    ...data.houses.map((h) => {
      const st = rulingStatus(h);
      const stamp = st.hasSupermajority
        ? `<span class="stamp">三分の二超</span>`
        : st.hasMajority
          ? `<span class="stamp">過半数</span>`
          : `<span class="stamp weak">過半数まで${st.toMajority}</span>`;
      return { label: `${h.name}の与党`, value: `${st.ruling}<small>/${h.total}</small> ${stamp}`, sub: "" };
    }),
  ];
  $("kpis").insertAdjacentHTML(
    "beforeend",
    cards
      .map((c) => `<div class="kpi"><div class="label">${esc(c.label)}</div><div class="value">${c.value}</div><div class="sub">${c.sub}</div></div>`)
      .join(""),
  );
}

function renderGovernment(g) {
  $("government").innerHTML = `
    <div class="gov"><span class="pm">${esc(g.primeMinister)}</span><span>${esc(g.cabinetName)}</span></div>
    <dl class="gov">
      <dt>与党</dt><dd>${g.coalition.map(esc).join("・")}</dd>
      <dt>首相就任</dt><dd>${fmtDate(g.pmSince)}</dd>
      <dt>現内閣発足</dt><dd>${fmtDate(g.cabinetSince)}</dd>
    </dl>
    <p class="note">${esc(g.note)}</p>`;
}

// ---------------------------------------------------------------- 全国の勢力図
function renderNation(prefs, map, parties) {
  const svg = $("japan");
  const [x, y, w, h] = map.viewBox;
  svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  const byCode = Object.fromEntries(prefs.prefectures.map((p) => [p.code, p]));

  // 独占でない県は、2位の政党の色の縞を重ねる
  const mixDefs = prefs.prefectures
    .map((p) => {
      const L = prefLeader(p);
      if (L.sweep || !L.second) return "";
      // 縞の太さは、1位以外の政党が取った議席の割合に比例させる
      const share = (p.seats - L.seats) / p.seats;
      const sw = Math.max(0.9, 7 * share).toFixed(2);
      return `<pattern id="mix-${p.code}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="${parties[L.party].color}" style="fill-opacity:var(--fill-op)"/>
        <rect width="${sw}" height="7" fill="${parties[L.second].color}"/></pattern>`;
    })
    .join("");

  const paths = Object.entries(map.prefectures)
    .map(([code, d]) => {
      const p = byCode[code];
      if (!p) return "";
      const L = prefLeader(p);
      const fill = L.sweep || !L.second ? `url(#hatch-${L.party})` : `url(#mix-${code})`;
      return `<path class="pref" d="${d}" fill="${fill}" data-code="${code}" data-party="${L.party}" tabindex="0" role="button"
        aria-label="${esc(p.name)} ${p.seats}区 ${esc(parties[L.party].name)}${L.sweep ? "が独占" : `${L.seats}`}"><title>${esc(p.name)}</title></path>`;
    })
    .join("");

  const [fx, fy, fw, fh] = map.okinawaFrame;
  svg.innerHTML = `<defs>${hatchDefs("hatch", parties)}${mixDefs}</defs>
    <text class="sea" x="${x + w * 0.62}" y="${y + h * 0.93}" font-size="15">太 平 洋</text>
    <text class="sea" x="${x + w * 0.42}" y="${y + h * 0.27}" font-size="13">日 本 海</text>
    ${paths}
    <rect class="frame" x="${fx}" y="${fy}" width="${fw}" height="${fh}"/>
    <text class="frame-label" x="${fx + 3}" y="${fy + fh - 4}">沖縄（位置を移動）</text>`;

  $("nation-sub").textContent = prefs.election;
  $("nation-note").innerHTML = `${esc(prefs.note)}縞模様は、ほかの政党も議席を取った都道府県です（縞の太さはその割合）。地図：${esc(map.source)}（伊豆・小笠原諸島は省略）。出典：${prefs.sources.map(link).join("、")}`;

  // 凡例：その政党が1位の都道府県数と、小選挙区の獲得数
  const lead = {};
  for (const p of prefs.prefectures) {
    const L = prefLeader(p);
    lead[L.party] = (lead[L.party] ?? 0) + 1;
  }
  const keys = Object.keys(prefs.totals).sort((a, b) => prefs.totals[b] - prefs.totals[a]);
  $("nation-legend").innerHTML = keys
    .map(
      (k) => `<li><button type="button" data-party="${k}" aria-pressed="false">
        <span class="sw" style="background:${parties[k].color}"></span>${emblem(k, parties[k].color)}
        <span>${esc(parties[k].full ?? parties[k].name)}</span>
        <span class="n">${lead[k] ? `1位 ${lead[k]}都道府県・` : ""}${prefs.totals[k]}議席</span></button></li>`,
    )
    .join("");

  const detail = $("pref-detail");
  const hint = `<p class="hint">地図の都道府県を選ぶと、小選挙区の当選者の内訳が出ます。下の政党名を選ぶと、その党が議席を取った地域を強調します。</p>`;
  detail.innerHTML = hint;

  const show = (code) => {
    const p = byCode[code];
    svg.querySelectorAll(".pref.sel").forEach((e) => e.classList.remove("sel"));
    svg.querySelector(`.pref[data-code="${code}"]`)?.classList.add("sel");
    const rows = Object.entries(p.winners).sort((a, b) => b[1] - a[1]);
    detail.innerHTML = `
      <h3>${esc(p.name)}</h3>
      <div class="seats">小選挙区 ${p.seats}区</div>
      <div class="winbar">${rows.map(([k, n]) => `<span style="width:${(n / p.seats) * 100}%;background:${parties[k].color}"></span>`).join("")}</div>
      <ul class="winlist">${rows
        .map(([k, n]) => `<li>${emblem(k, parties[k].color)}<span>${esc(parties[k].full ?? parties[k].name)}</span><span class="n">${n}</span></li>`)
        .join("")}</ul>
      ${p.note ? `<div class="warn">${p.uncertain ? "要確認：" : ""}${esc(p.note)}</div>` : ""}`;
  };
  svg.addEventListener("click", (e) => {
    const el = e.target.closest(".pref");
    if (el) show(el.dataset.code);
  });
  svg.addEventListener("keydown", (e) => {
    const el = e.target.closest(".pref");
    if (el && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      show(el.dataset.code);
    }
  });

  $("nation-legend").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-party]");
    if (!b) return;
    const on = b.getAttribute("aria-pressed") !== "true";
    $("nation-legend").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
    svg.classList.toggle("dim", on);
    svg.querySelectorAll(".pref").forEach((el) => {
      const p = byCode[el.dataset.code];
      el.classList.toggle("hl", on && (p.winners[b.dataset.party] ?? 0) > 0);
    });
    if (on) b.setAttribute("aria-pressed", "true");
  });
}

// ---------------------------------------------------------------- 国会の勢力図
function renderHouse(house, parties) {
  const W = 1000;
  const H = house.id === "shugiin" ? 560 : 620;
  const { cells, alliance } = layoutTerritories(house, W, H);
  const cellSvg = cells
    .map((c) => {
      const big = c.w > 130 && c.h > 80;
      const mid = c.w > 60 && c.h > 44;
      const fs = big ? Math.min(52, c.w / 5, c.h / 3.4) : 16;
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const showMon = big && EMBLEMS[c.party] && c.h > fs * 4.4;
      const ms = fs * 1.3;
      const ly = showMon ? cy + fs * 0.75 : big ? cy + fs * 0.2 : cy - 2;
      const name = parties[c.party].name;
      // 細長い領地は縦書きにする
      const tall = !big && c.w >= 26 && c.h > c.w * 2.5;
      if (tall) {
        const vfs = Math.min(40, c.w * 0.55);
        return `<g><title>${esc(c.label)} ${c.seats}議席</title>
          <rect class="terr" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="url(#t-${house.id}-${c.party})"/>
          <text class="label" x="${cx}" y="${cy - vfs * 1.4}" font-size="${vfs}" writing-mode="tb" text-anchor="middle">${esc(name)}</text>
          <text class="num" x="${cx}" y="${cy + vfs * 1.6}" font-size="${vfs * 0.85}" text-anchor="middle">${c.seats}</text></g>`;
      }
      return `<g><title>${esc(c.label)} ${c.seats}議席</title>
        <rect class="terr" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="url(#t-${house.id}-${c.party})"/>
        ${showMon ? `<g class="mon" transform="translate(${cx - ms / 2},${cy - fs * 1.05 - ms}) scale(${ms / 24})">${EMBLEMS[c.party]}</g>` : ""}
        ${
          mid
            ? `<text class="label" x="${cx}" y="${ly}" text-anchor="middle" font-size="${fs}">${esc(name)}</text>
               <text class="num" x="${cx}" y="${ly + (big ? fs * 1.05 : 18)}" text-anchor="middle" font-size="${big ? fs * 0.8 : 15}">${c.seats}</text>`
            : ""
        }</g>`;
    })
    .join("");
  const allianceSvg = alliance
    ? `<rect class="alliance" x="${alliance.x + 3}" y="${alliance.y + 3}" width="${alliance.w - 6}" height="${alliance.h - 6}"/>
       <text class="tag" x="${alliance.x + 18}" y="${alliance.y + alliance.h - 16}" font-size="${Math.min(26, alliance.w / 7)}">連立与党 ${alliance.seats}</text>`
    : "";
  const st = rulingStatus(house);

  const legend = orderFactions(house.factions)
    .map(
      (f) => `<li class="${f.ruling ? "ruling" : ""}"><span class="sw" style="background:${parties[f.party].color}"></span>
        <span class="nm" title="${esc(f.label)}">${esc(f.label)}</span><span class="n">${f.seats}</span></li>`,
    )
    .join("");

  const el = document.createElement("section");
  el.className = "card";
  el.innerHTML = `
    <h2>${esc(house.name)}の勢力図 <small>定数${house.total}・面積は議席数に比例・朱の破線は連立与党</small></h2>
    <svg class="territory" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(house.name)}の会派別議席。連立与党${st.ruling}議席">
      <defs>${hatchDefs(`t-${house.id}`, parties)}</defs>
      ${cellSvg}${allianceSvg}
    </svg>
    <div class="thresholds">過半数 ${house.majority}／3分の2 ${house.supermajority}　出典：${esc(house.source)}（${esc(house.asOf)}）</div>
    <ul class="legend">${legend}</ul>`;
  return el;
}

// ---------------------------------------------------------------- 政策
const PLANNED = /予定|策定/;

function renderAgenda(items) {
  $("agenda").innerHTML = items
    .map(
      (a) => `<article class="agenda-item">
        <div class="meta"><span class="status ${PLANNED.test(a.status) ? "plan" : ""}">${esc(a.status)}</span>${esc(a.area)}</div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.summary)}</p>
        ${a.points?.length ? `<ul>${a.points.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        <div class="src">出典：${a.sources.map(link).join("、")}</div>
      </article>`,
    )
    .join("");
}

function flag(k, parties) {
  const p = parties[k];
  return `<span class="flag" style="--pc:${p.color}" title="${esc(p.full ?? p.name)}">${emblem(k, p.color)}${esc(p.name)}</span>`;
}

function renderSpectrum(it, policies, parties) {
  const sp = it.spectrum;
  if (!sp) return "";
  const placed = new Set(sp.groups.flatMap((g) => g.parties));
  const rest = policies.issueParties.filter((k) => !placed.has(k));
  return `<div class="spectrum">
    <div class="axis"></div>
    <div class="ends"><span>← ${esc(sp.left)}</span><span>${esc(sp.right)} →</span></div>
    <div class="groups" style="--cols:${sp.groups.length}">${sp.groups
      .map((g) => `<div><h4>${esc(g.label)}</h4><div class="flags">${g.parties.map((k) => flag(k, parties)).join("")}</div></div>`)
      .join("")}</div>
    ${rest.length ? `<div class="others">ほか：${rest.map((k) => `${esc(parties[k].name)}「${esc(it.positions[k]?.short ?? "未確認")}」`).join("／")}</div>` : ""}
  </div>`;
}

function renderIssues(policies, parties, shugiin) {
  const keys = policies.issueParties;
  $("issues-note").textContent = `${policies.issuesNote} ${policies.spectrumNote ?? ""}`;
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
      ${renderSpectrum(it, policies, parties)}
      <ul class="positions">${keys
        .map((k) => {
          const pos = it.positions[k];
          const p = parties[k];
          return `<li class="${isUnknown(pos) ? "unknown" : ""}" style="--pc:${p.color}">
            <span class="pn" title="${esc(p.full ?? p.name)}"><span>${emblem(k, p.color)}${esc(p.name)}</span><small>${seatLabel(k)}</small></span>
            <span class="ps">${esc(pos?.short ?? "未確認")}</span>
            <span class="pd">${esc(pos?.detail || "調べた資料では確認できませんでした")}</span></li>`;
        })
        .join("")}</ul>
      <p class="note">出典：${it.sources.map(link).join("、")}</p>`;
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

// ---------------------------------------------------------------- 支持率・日程・閣僚・出典
function renderPolls(polls) {
  $("polls").innerHTML =
    [...polls]
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
      .join("") + `<p class="note"><span style="color:var(--ok)">■</span> 支持　<span style="color:var(--ng)">■</span> 不支持</p>`;
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
  $("sources").innerHTML = list.map((s) => `<li>${link(s)}</li>`).join("");
}

// ---------------------------------------------------------------- 起動
async function main() {
  try {
    const load = async (path) => {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json();
    };
    const [data, policies, prefs, map] = await Promise.all([
      load("data/politics.json"),
      load("data/policies.json"),
      load("data/prefectures.json"),
      load("data/japan-map.json"),
    ]);
    const errors = [
      ...validate(data),
      ...validatePolicies(policies, data.parties),
      ...validatePrefectures(prefs, data.parties, map),
    ];
    if (errors.length) console.warn("データ整合性エラー:", errors);

    $("updated").textContent = fmtDate(data.updatedAt);
    $("updated").dateTime = data.updatedAt;
    renderKpis(data);
    renderNation(prefs, map, data.parties);
    data.houses.forEach((h) => $("h-houses").appendChild(renderHouse(h, data.parties)));
    renderGovernment(data.government);
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
    console.error(e);
  }
}

main();
