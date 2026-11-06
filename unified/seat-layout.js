// 描画に依存しない純粋なロジック（Node からも import してテスト/検証できる）

/** 会派の合計議席 */
export function sumSeats(factions) {
  return factions.reduce((s, f) => s + f.seats, 0);
}

/** 与党の議席と、過半数・3分の2との比較 */
export function rulingStatus(house) {
  const ruling = house.factions.filter((f) => f.ruling).reduce((s, f) => s + f.seats, 0);
  return {
    ruling,
    hasMajority: ruling >= house.majority,
    hasSupermajority: ruling >= house.supermajority,
    toMajority: house.majority - ruling,
  };
}

/** 表示順：与党 → その他（議席順）→ 無所属 → 欠員 */
export function orderFactions(factions) {
  const rank = (f) => (f.ruling ? 0 : f.party === "ind" ? 2 : f.party === "vacant" ? 3 : 1);
  return [...factions].sort((a, b) => rank(a) - rank(b) || b.seats - a.seats);
}

/**
 * 縦横比が正方形に近くなるように長方形を分割する（squarified treemap）。
 * items: [{ value, ... }] → [{ ...item, x, y, w, h }]
 */
export function squarify(items, x, y, w, h) {
  const out = [];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return out;
  let rest = items.filter((i) => i.value > 0).map((i) => ({ item: i, a: (i.value / total) * w * h }));
  while (rest.length) {
    const side = Math.min(w, h);
    const worst = (row) => {
      const s = row.reduce((a, b) => a + b.a, 0);
      const mx = Math.max(...row.map((r) => r.a));
      const mn = Math.min(...row.map((r) => r.a));
      return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
    };
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]]) <= worst(row)) row.push(rest[i++]);
    const s = row.reduce((a, b) => a + b.a, 0);
    if (w >= h) {
      const cw = s / h;
      let cy = y;
      for (const r of row) {
        const rh = r.a / cw;
        out.push({ ...r.item, x, y: cy, w: cw, h: rh });
        cy += rh;
      }
      x += cw;
      w -= cw;
    } else {
      const ch = s / w;
      let cx = x;
      for (const r of row) {
        const rw = r.a / ch;
        out.push({ ...r.item, x: cx, y, w: rw, h: ch });
        cx += rw;
      }
      y += ch;
      h -= ch;
    }
    rest = rest.slice(i);
  }
  return out;
}

/**
 * 議院の「領地」配置。与党の領地を左側にまとめて確保し、残りを野党などに割り当てる。
 * 面積は議席数に比例する。
 */
export function layoutTerritories(house, width, height, pad = 6) {
  const ordered = orderFactions(house.factions).map((f) => ({ ...f, value: f.seats }));
  const ruling = ordered.filter((f) => f.ruling);
  const others = ordered.filter((f) => !f.ruling);
  const rs = sumSeats(ruling);
  const W = width - pad * 2;
  const H = height - pad * 2;
  const rw = (W * rs) / house.total;
  return {
    cells: [...squarify(ruling, pad, pad, rw, H), ...squarify(others, pad + rw, pad, W - rw, H)],
    alliance: rs ? { x: pad, y: pad, w: rw, h: H, seats: rs } : null,
  };
}

/** 都道府県で最も多く議席を取った政党と、独占かどうか */
export function prefLeader(pref) {
  const entries = Object.entries(pref.winners).sort((a, b) => b[1] - a[1]);
  const [party, seats] = entries[0];
  const tie = entries.length > 1 && entries[1][1] === seats;
  return { party, seats, sweep: seats === pref.seats, tie, second: entries[1]?.[0] ?? null };
}

/** データの整合性チェック。問題があればメッセージの配列を返す */
export function validate(data) {
  const errors = [];
  for (const h of data.houses) {
    const total = sumSeats(h.factions);
    if (total !== h.total) errors.push(`${h.name}: 会派合計 ${total} が定数 ${h.total} と一致しません`);
    if (h.majority !== Math.floor(h.total / 2) + 1) errors.push(`${h.name}: 過半数 ${h.majority} が不正です`);
    if (h.supermajority !== Math.ceil((h.total * 2) / 3)) errors.push(`${h.name}: 3分の2 ${h.supermajority} が不正です`);
    for (const f of h.factions) {
      if (!data.parties[f.party]) errors.push(`${h.name}: 未定義の政党キー "${f.party}"`);
    }
  }
  for (const p of data.polls) {
    if (p.approve < 0 || p.approve > 100) errors.push(`${p.pollster}: 支持率が範囲外`);
  }
  return errors;
}

const UNKNOWN = new Set(["未確認", "記載なし"]);
/** 立場が資料で確認できていない（未確認・記載なし）か */
export const isUnknown = (pos) => !pos || UNKNOWN.has(pos.short);

/** 政策データ（policies.json）の整合性チェック */
export function validatePolicies(policies, parties) {
  const errors = [];
  const ids = new Set();
  for (const a of policies.agenda) {
    if (ids.has(a.id)) errors.push(`agenda: id "${a.id}" が重複しています`);
    ids.add(a.id);
    if (!a.sources?.length) errors.push(`agenda "${a.title}": 出典がありません`);
  }
  for (const k of policies.issueParties) {
    if (!parties[k]) errors.push(`issueParties: 未定義の政党キー "${k}"`);
  }
  for (const issue of policies.issues) {
    if (!issue.sources?.length) errors.push(`争点「${issue.title}」: 出典がありません`);
    for (const k of policies.issueParties) {
      const p = issue.positions[k];
      if (!p) errors.push(`争点「${issue.title}」: ${k} の立場がありません（不明なら short を "未確認" に）`);
      else if (!isUnknown(p) && !p.detail) errors.push(`争点「${issue.title}」: ${k} に detail がありません`);
    }
    for (const k of Object.keys(issue.positions)) {
      if (!policies.issueParties.includes(k)) errors.push(`争点「${issue.title}」: issueParties にない政党キー "${k}"`);
    }
    if (issue.spectrum) {
      const seen = new Set();
      for (const g of issue.spectrum.groups) {
        for (const k of g.parties) {
          if (!issue.positions[k]) errors.push(`争点「${issue.title}」: 分類「${g.label}」に立場のない政党 "${k}"`);
          if (seen.has(k)) errors.push(`争点「${issue.title}」: "${k}" が複数の分類に入っています`);
          seen.add(k);
        }
      }
    }
  }
  return errors;
}

/** 都道府県データ（prefectures.json）の整合性チェック */
export function validatePrefectures(prefs, parties, map) {
  const errors = [];
  if (prefs.prefectures.length !== 47) errors.push(`都道府県の数が ${prefs.prefectures.length} です`);
  let seats = 0;
  const totals = {};
  for (const p of prefs.prefectures) {
    const won = Object.values(p.winners).reduce((a, b) => a + b, 0);
    if (won !== p.seats) errors.push(`${p.name}: 当選者合計 ${won} が区数 ${p.seats} と一致しません`);
    seats += p.seats;
    for (const [k, v] of Object.entries(p.winners)) {
      if (!parties[k]) errors.push(`${p.name}: 未定義の政党キー "${k}"`);
      totals[k] = (totals[k] ?? 0) + v;
    }
    if (map && !map.prefectures[p.code]) errors.push(`${p.name}: 地図データに code ${p.code} がありません`);
  }
  if (seats !== 289) errors.push(`小選挙区の合計が ${seats}（289 のはず）`);
  for (const [k, v] of Object.entries(prefs.totals ?? {})) {
    if ((totals[k] ?? 0) !== v) errors.push(`${parties[k]?.name ?? k}: 都道府県の合計 ${totals[k] ?? 0} が全国の獲得数 ${v} と一致しません`);
  }
  return errors;
}

/** 議院で、ある政党キーの会派が持つ議席数 */
export function seatsOf(house, partyKey) {
  return house.factions.filter((f) => f.party === partyKey).reduce((s, f) => s + f.seats, 0);
}
