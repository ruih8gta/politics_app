// data/politics.json・data/policies.json の整合性チェック:  npm test
import { readFile } from "node:fs/promises";
import { hemicycleSeats, validate, validatePolicies } from "../js/lib.js";

const data = JSON.parse(await readFile(new URL("../data/politics.json", import.meta.url), "utf8"));
const policies = JSON.parse(await readFile(new URL("../data/policies.json", import.meta.url), "utf8"));
const errors = [...validate(data), ...validatePolicies(policies, data.parties)];

for (const h of data.houses) {
  const n = hemicycleSeats(h.total).length;
  if (n !== h.total) errors.push(`${h.name}: 議席図の座席数 ${n} が定数 ${h.total} と一致しません`);
}

if (errors.length) {
  console.error("NG\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`OK: ${data.houses.map((h) => `${h.name} ${h.total}`).join(", ")} / 重点政策 ${policies.agenda.length}件・争点 ${policies.issues.length}件 / 更新日 ${data.updatedAt}`);
