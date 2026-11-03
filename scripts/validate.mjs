// data/*.json の整合性チェック:  npm test
import { readFile } from "node:fs/promises";
import { layoutTerritories, validate, validatePolicies, validatePrefectures } from "../js/lib.js";

const load = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), "utf8"));
const [data, policies, prefs, map] = await Promise.all(
  ["politics.json", "policies.json", "prefectures.json", "japan-map.json"].map(load),
);

const errors = [
  ...validate(data),
  ...validatePolicies(policies, data.parties),
  ...validatePrefectures(prefs, data.parties, map),
];

// 領地の面積が議席数に比例しているか
for (const h of data.houses) {
  const W = 1000, H = 600;
  const { cells } = layoutTerritories(h, W, H, 0);
  for (const c of cells) {
    const expected = (c.seats / h.total) * W * H;
    if (Math.abs(c.w * c.h - expected) > 1) errors.push(`${h.name} ${c.label}: 面積が議席数に比例していません`);
  }
}

if (errors.length) {
  console.error("NG\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(
  `OK: ${data.houses.map((h) => `${h.name} ${h.total}`).join(", ")} / 都道府県 ${prefs.prefectures.length} / ` +
    `重点政策 ${policies.agenda.length}件・争点 ${policies.issues.length}件 / 更新日 ${data.updatedAt}`,
);
