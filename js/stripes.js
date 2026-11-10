// 縞模様：ほかの会派も議席を持つ地域を、地図の上で見分けられるようにする
import { color, grouped } from './model.js';

const stripeIds = new Map();
/** 最多の会派の色に、2番目の会派の色の縞を重ねるパターン。独占・同数なら null */
export function stripePattern(members, top) {
  if (!members.length || top === '同数最多') return null;
  const groups = grouped(members);
  if (groups.length < 2) return null;
  const second = groups.find((g) => g.group !== top);
  const share = (members.length - groups.find((g) => g.group === top).count) / members.length;
  const key = `${top}|${second.group}|${Math.round(share * 24)}`;
  if (!stripeIds.has(key)) stripeIds.set(key, 'stripe-' + stripeIds.size);
  const id = stripeIds.get(key);
  const w = Math.max(1.3, 9 * share).toFixed(2);
  return { id, markup: (prefix) => `<pattern id="${prefix}${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="${color(top)}"/><rect width="${w}" height="9" fill="${color(second.group)}"/></pattern>` };
}

