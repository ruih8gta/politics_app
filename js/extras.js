// 概要画面の追加要素：3行要約、最近の動き、法案の進み具合、支持率の推移、わたしの地域、用語の説明
import { state, data, election, modal, external, date, color, esc } from './app.js';
import { districtMembers, grouped, leadingGroup } from './model.js';
import { electionMembers, houseForDiagram, isUpcoming } from './integration-model.js';
import { rulingStatus } from './seat-layout.js';

const $ = (s) => document.querySelector(s);
const PREF_KEY = 'seiryokuzu-pref';
let ctx = null; // { snapshot, issueData, navigate, showAgenda, showPolls }
let pollHistory = null;
let changes = null;

// ---------------------------------------------------------------- 用語の説明
export const GLOSSARY = {
  与党: '政権を担当している政党。いまは自民党と日本維新の会。',
  野党: '政権に加わっていない政党。',
  連立: '複数の政党が協力して政権をつくること。',
  会派: '国会の中で一緒に活動する議員のグループ。政党と同じとは限りません。',
  過半数: '全体の半分より多い数。法案を通すのに必要です。',
  '3分の2': '衆議院で3分の2以上あると、参議院が否決した法案を再び可決できます。憲法改正の発議にも両院で3分の2が必要です。',
  小選挙区: '1つの選挙区から1人だけが当選する仕組み。',
  比例代表: '政党の得票に応じて議席を分ける仕組み。衆議院は全国を11のブロックに分けます。',
  会期末: '国会が開かれている期間の最終日。審議が終わらない法案は原則として廃案になります。',
};
export const term = (word, label = word) =>
  GLOSSARY[word] ? `<button type="button" class="term" data-term="${esc(word)}" aria-expanded="false">${esc(label)}</button>` : esc(label);

function bindGlossary() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.term');
    const open = document.querySelector('.term-tip');
    if (open && (!b || open.dataset.for !== b.dataset.term || open.previousElementSibling !== b)) {
      open.previousElementSibling?.setAttribute('aria-expanded', 'false');
      open.remove();
    } else if (open) {
      b.setAttribute('aria-expanded', 'false');
      open.remove();
      return;
    }
    if (!b) return;
    b.setAttribute('aria-expanded', 'true');
    b.insertAdjacentHTML('afterend', `<span class="term-tip" role="note" data-for="${esc(b.dataset.term)}"><b>${esc(b.dataset.term)}</b>：${esc(GLOSSARY[b.dataset.term])}</span>`);
  });
}

// ---------------------------------------------------------------- 3行要約
const ruby = (word, kana) => `<ruby>${word}<rp>（</rp><rt>${kana}</rt><rp>）</rp></ruby>`;
const jdate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return d ? `${m}月${d}日` : `${y}年${m}月`;
};

export function summaryLines(snapshot, issueData, today) {
  const g = snapshot.government;
  const phrase = (h) => {
    const s = rulingStatus(houseForDiagram(data, h));
    return s.hasSupermajority ? `<b>${term('3分の2', '3分の2')}を超える</b>` : s.hasMajority ? `<b>${term('過半数')}</b>を持つ` : `<b>${term('過半数')}まであと${s.toMajority}議席</b>`;
  };
  const focus = issueData.agenda.find((a) => a.bill && a.bill.current >= 0) || issueData.agenda[0];
  const next = [...snapshot.calendar].filter((e) => isUpcoming(e, today)).sort((a, b) => a.date.localeCompare(b.date))[0];
  return [
    `首相は<b>${esc(g.primeMinister.replace(/\s+/g, ''))}</b>氏。${term('与党')}は${g.coalition.map(esc).join('と')}の${term('連立')}。`,
    `${ruby('衆議院', 'しゅうぎいん')}は与党が${phrase('lower')}、${ruby('参議院', 'さんぎいん')}は${phrase('upper')}。`,
    `国会の焦点は<b>${esc(focus.title.replace(/（.*?）/, ''))}</b>（${esc(focus.status)}）。` + (next ? `次の節目は${jdate(next.date)}の${esc(next.title.replace(/\s+/g, ''))}。` : ''),
  ];
}

function renderSummary(today) {
  const el = $('#overview-summary');
  if (!el) return;
  el.innerHTML = `<h2>いまの政治、3行で <small>${jdate(ctx.snapshot.updatedAt)}時点の資料</small></h2><ol class="summary-lines">${summaryLines(ctx.snapshot, ctx.issueData, today).map((l) => `<li>${l}</li>`).join('')}</ol><p class="card-note plain">点線の言葉を押すと、短い説明が出ます。</p>`;
}

// ---------------------------------------------------------------- 最近の動き
function renderChanges() {
  const el = $('#overview-changes');
  if (!el || !changes) return;
  el.innerHTML = `<h2>最近の動き <small>データの更新ごとに記録</small></h2><ul class="change-list">${changes.items
    .slice(0, 5)
    .map(
      (c) =>
        `<li><time datetime="${c.date}">${c.date.slice(5).replace('-', '.')}</time><button type="button" class="change-link" data-change-link="${esc(c.link || '')}">${esc(c.text)}${c.uncertain ? ' <span class="status-chip uncertain">要確認</span>' : ''}</button></li>`,
    )
    .join('')}</ul>`;
}

// ---------------------------------------------------------------- 法案の進み具合
export function billSteps(a) {
  const b = a.bill;
  if (!b) return '';
  const now = b.current < 0 ? '提出前' : b.stages[b.current];
  return `<div class="bill-steps" role="img" aria-label="国会での段階：${esc(now)}。成立は確認していません">${b.current < 0 ? '<span class="current">提出前</span>' : ''}${b.stages
    .map((s, i) => `<span class="${i < b.current ? 'complete' : i === b.current ? 'current' : ''}">${esc(s)}</span>`)
    .join('')}</div>`;
}

function renderBills() {
  const el = $('#overview-bills');
  if (!el) return;
  const bills = ctx.issueData.agenda.filter((a) => a.bill);
  el.innerHTML = `<h2>法案はいまどこ？ <small>国会での段階</small></h2>${bills
    .map((a) => `<div class="bill-row"><button type="button" class="bill-title" data-change-link="agenda:${a.id}">${esc(a.title)} →</button>${billSteps(a)}<p>${esc(a.bill.note)}</p></div>`)
    .join('')}<p class="card-note plain">収録した資料の時点の段階です。${term('会期末')}までに成立しない法案は、原則として廃案になります。</p>`;
}

// ---------------------------------------------------------------- 支持率の推移
const SERIES_STYLE = [
  { stroke: 'var(--trend-a)', dash: '' },
  { stroke: 'var(--trend-b)', dash: '7 4' },
  { stroke: 'var(--trend-c)', dash: '2 4' },
];

export function trendSvg(history) {
  const months = [...new Set(history.series.flatMap((s) => s.points.map((p) => p.month)))].sort();
  const all = history.series.flatMap((s) => s.points.map((p) => p.approve));
  const lo = Math.floor((Math.min(...all) - 4) / 10) * 10;
  const hi = Math.ceil((Math.max(...all) + 4) / 10) * 10;
  const W = 560, H = 270, L = 44, R = 118, T = 26, B = 34;
  const x = (m) => L + ((W - L - R) * months.indexOf(m)) / Math.max(1, months.length - 1);
  const y = (v) => T + ((H - T - B) * (hi - v)) / (hi - lo);
  const grid = [];
  for (let v = lo; v <= hi; v += 10) grid.push(`<path class="trend-grid" d="M${L} ${y(v)}H${W - R}"/><text class="trend-axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`);
  const ticks = months.map((m) => `<text class="trend-axis" x="${x(m)}" y="${H - 10}" text-anchor="middle">${Number(m.slice(5))}月</text>`).join('');
  const events = (history.events || [])
    .filter((e) => months.includes(e.date))
    .map((e) => `<path class="trend-event" d="M${x(e.date)} ${T - 6}V${H - B}"/><text class="trend-event-label" x="${x(e.date) + 4}" y="${T - 10}">${esc(e.label)}</text>`)
    .join('');
  // 線の端のラベルが重ならないように、縦位置を少しずらす
  const ends = history.series.map((s) => ({ s, p: s.points.at(-1) })).sort((a, b) => b.p.approve - a.p.approve);
  let prev = -Infinity;
  for (const e of ends) {
    e.ly = Math.max(y(e.p.approve) + 4, prev + 16);
    prev = e.ly;
  }
  const lines = history.series
    .map((s, i) => {
      const st = SERIES_STYLE[i % SERIES_STYLE.length];
      const end = ends.find((e) => e.s === s);
      return `<g class="trend-series"><polyline fill="none" stroke="${st.stroke}" stroke-width="2.6" stroke-dasharray="${st.dash}" points="${s.points.map((p) => `${x(p.month).toFixed(1)},${y(p.approve).toFixed(1)}`).join(' ')}"/>${s.points
        .map((p) => `<circle cx="${x(p.month).toFixed(1)}" cy="${y(p.approve).toFixed(1)}" r="3.6" stroke="${st.stroke}" stroke-width="2" fill="${p.derived ? 'var(--paper)' : st.stroke}"><title>${esc(s.pollster)} ${Number(p.month.slice(5))}月 支持${p.approve}%${p.derived ? '（前月比から算出）' : ''}</title></circle>`)
        .join('')}<text class="trend-end" x="${x(end.p.month) + 9}" y="${end.ly}" fill="${st.stroke}">${esc(s.pollster)} ${end.p.approve}%</text></g>`;
    })
    .join('');
  const summary = history.series.map((s) => `${s.pollster}は${Number(s.points[0].month.slice(5))}月の${s.points[0].approve}%から${Number(s.points.at(-1).month.slice(5))}月の${s.points.at(-1).approve}%`).join('、');
  return `<svg class="trend-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="内閣支持率の推移。${esc(summary)}">${grid.join('')}${ticks}${events}${lines}</svg>`;
}

function trendTable(history) {
  const months = [...new Set(history.series.flatMap((s) => s.points.map((p) => p.month)))].sort();
  return `<table class="seat-table"><caption class="sr-only">内閣支持率の推移（支持／不支持）</caption><thead><tr><th scope="col">月</th>${history.series.map((s) => `<th scope="col">${esc(s.pollster)}</th>`).join('')}</tr></thead><tbody>${months
    .map(
      (m) =>
        `<tr><th scope="row">${m.replace('-', '年')}月</th>${history.series
          .map((s) => {
            const p = s.points.find((q) => q.month === m);
            return `<td>${p ? `${p.approve}%${p.derived ? '（算出）' : ''}${p.disapprove == null ? '' : ` ／ ${p.disapprove}%`}` : '—'}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('')}</tbody></table>`;
}

function showTrendSources() {
  modal(`<span class="eyebrow">内閣支持率の推移</span><h2>推移データの出典と読み方</h2><p>${esc(pollHistory.note)}</p><p>白抜きの点は、翌月の報道にある前月比から算出した値です。不支持率が空欄の月は、確認できた資料に数値がなかったものです。</p>${trendTable(pollHistory)}${pollHistory.series
    .map((s) => `<h3>${esc(s.pollster)}</h3><div class="source-links">${s.sources.map((x) => external(x.url, esc(x.label) + ' ↗')).join('')}</div>`)
    .join('')}<p class="context-note">収録日：${date(pollHistory.updatedAt)}。概要の「内閣支持率・参考値」は ${date(ctx.snapshot.updatedAt)} 時点の3調査の平均で、この推移とは収録の時点が異なります。</p>`);
}

function renderTrend() {
  const el = $('#overview-trend');
  if (!el || !pollHistory) return;
  el.innerHTML = `<h2>内閣支持率の推移 <small>調査機関ごと</small></h2>${trendSvg(pollHistory)}<p class="card-note plain">調査の方法が違うため、機関どうしの数値は直接比べられません。白抜きの点は前月比から算出した値です。</p><button type="button" class="card-link" id="trend-sources">数値の一覧と出典 →</button>`;
}

// ---------------------------------------------------------------- わたしの地域
export function getMyPref() {
  try {
    const v = Number(localStorage.getItem(PREF_KEY));
    return data.prefectures.some((p) => p.id === v) ? v : 0;
  } catch {
    return 0;
  }
}
function setMyPref(id) {
  try {
    localStorage.setItem(PREF_KEY, String(id || ''));
  } catch {}
  const sel = $('#my-region');
  if (sel) sel.value = id ? String(id) : '';
  renderMyRegion();
  markMyPref();
}
function markMyPref() {
  const id = getMyPref();
  document.querySelectorAll('.overview-pref').forEach((p) => p.classList.toggle('mine', Number(p.dataset.overviewPref) === id));
}
const tally = (members) => grouped(members).map((g) => `${esc(g.group)} ${g.count}`).join('・');

function renderMyRegion() {
  const el = $('#overview-myregion');
  if (!el) return;
  const id = getMyPref();
  if (!id) {
    el.innerHTML = `<h2>わたしの地域</h2><p class="myregion-empty">右上の「わたしの地域」で都道府県を選ぶと、その地域の議席と議員をここに表示します。選んだ地域はこのブラウザに保存されます。</p>`;
    return;
  }
  const pref = data.prefectures.find((p) => p.id === id);
  const won = electionMembers(election, id);
  const lower = districtMembers(data, 'lower', id);
  const upper = districtMembers(data, 'upper', id);
  const ep = election.prefectures.find((p) => Number(p.code) === id);
  el.innerHTML = `<h2>${esc(pref.name)}のいま <small>わたしの地域</small></h2>
    <dl class="myregion">
      <div><dt>2026衆院選・${term('小選挙区')}（${won.length}区）</dt><dd>${tally(won)}</dd></div>
      <div><dt>衆議院・選挙区選出（名簿 ${date(data.counts.lower.asOf)}）</dt><dd>${lower.length}人 <small>最多 ${esc(leadingGroup(lower))}</small></dd></div>
      <div><dt>参議院・選挙区選出（名簿 ${date(data.counts.upper.asOf)}）</dt><dd>${upper.length}人 <small>${tally(upper)}</small></dd></div>
    </dl>${ep?.note ? `<p class="card-note plain">${ep.uncertain ? '要確認：' : '注記：'}${esc(ep.note)}</p>` : ''}
    <button type="button" class="card-link" data-region-link="${id}">${esc(pref.name)}を地図で見る・議員を探す →</button>`;
}

function initMyRegion() {
  const sel = $('#my-region');
  if (!sel) return;
  sel.innerHTML = '<option value="">地域を選ぶ</option>' + data.prefectures.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const id = getMyPref();
  sel.value = id ? String(id) : '';
  sel.addEventListener('change', () => setMyPref(Number(sel.value)));
  if (id) {
    state.pref = id;
    state.memberPref = id;
  }
}

// ---------------------------------------------------------------- 起動と描画
async function load(file) {
  const r = await fetch(new URL('../data/' + file, import.meta.url));
  if (!r.ok) throw Error('Data load failed: ' + file);
  return r.json();
}

export async function initExtras(context) {
  ctx = context;
  [pollHistory, changes] = await Promise.all([load('poll-history.json'), load('changes.json')]);
  initMyRegion();
  bindGlossary();
  document.addEventListener('click', (e) => {
    if (e.target.closest('#trend-sources')) showTrendSources();
    const link = e.target.closest('[data-change-link]')?.dataset.changeLink;
    if (!link) return;
    if (link.startsWith('agenda:')) ctx.showAgenda(link.slice(7));
    else if (link === 'polls') ctx.showPolls();
    else ctx.navigate(link);
  });
}

export function renderExtras(today) {
  if (!ctx) return;
  renderSummary(today);
  renderChanges();
  renderBills();
  renderTrend();
  renderMyRegion();
  markMyPref();
}
