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

/**
 * 半円型の議席配置（パーラメントチャート）を計算する。
 * 各座席の {x, y, r} を左→右（角度順）に並べて返す。
 */
export function hemicycleSeats(total, { width = 400, rows } = {}) {
  const R = width / 2;
  rows = rows ?? Math.max(4, Math.round(Math.sqrt(total / 2.2)));
  const inner = R * 0.38;
  const step = (R - inner) / rows;
  const radii = Array.from({ length: rows }, (_, i) => inner + step * (i + 0.5));
  const sumR = radii.reduce((a, b) => a + b, 0);

  // 各列の座席数を半径に比例させ、端数を調整して合計を total に合わせる
  let counts = radii.map((r) => Math.floor((total * r) / sumR));
  let rest = total - counts.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; rest > 0; i = (i - 1 + rows) % rows, rest--) counts[i]++;

  const seats = [];
  const seatR = Math.min(step * 0.42, (Math.PI * radii[0]) / counts[0] * 0.42);
  radii.forEach((r, i) => {
    const n = counts[i];
    for (let k = 0; k < n; k++) {
      const a = n === 1 ? Math.PI / 2 : Math.PI - (Math.PI * k) / (n - 1);
      seats.push({ x: R + r * Math.cos(a), y: R - r * Math.sin(a), angle: a, r: seatR });
    }
  });
  // 左端（角度大）から右へ。同角度なら内側から
  seats.sort((p, q) => q.angle - p.angle || Math.hypot(p.x - R, p.y - R) - Math.hypot(q.x - R, q.y - R));
  return seats;
}

/** 表示順：与党 → その他（議席順）→ 無所属 → 欠員 */
export function orderFactions(factions) {
  const rank = (f) => (f.ruling ? 0 : f.party === "ind" ? 2 : f.party === "vacant" ? 3 : 1);
  return [...factions].sort((a, b) => rank(a) - rank(b) || b.seats - a.seats);
}
