// data/politics.json の整合性チェック:  npm test
import { readFile } from "node:fs/promises";
import { hemicycleSeats, validate } from "../js/lib.js";

const data = JSON.parse(await readFile(new URL("../data/politics.json", import.meta.url), "utf8"));
const errors = validate(data);

for (const h of data.houses) {
  const n = hemicycleSeats(h.total).length;
  if (n !== h.total) errors.push(`${h.name}: 議席図の座席数 ${n} が定数 ${h.total} と一致しません`);
}

if (errors.length) {
  console.error("NG\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`OK: ${data.houses.map((h) => `${h.name} ${h.total}`).join(", ")} / 更新日 ${data.updatedAt}`);
