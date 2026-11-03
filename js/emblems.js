// 政党の印（家紋風）。すべて本サイト独自の幾何図形で、各党の公式ロゴではない。
// 24x24 の座標系で、色は currentColor を使う。
const S = 'fill="none" stroke="currentColor" stroke-width="2.4"';

export const EMBLEMS = {
  ldp: `<circle cx="12" cy="12" r="9" ${S}/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>`,
  ishin: `<path d="M12 2 22 12 12 22 2 12Z" ${S}/><path d="M12 7 17 12 12 17 7 12Z" fill="currentColor"/>`,
  chudo: `<circle cx="12" cy="12" r="9" ${S}/><path d="M12 3v18M3 12h18" ${S}/>`,
  cdp: `<circle cx="12" cy="12" r="9" ${S}/><path d="M7 12h10" ${S}/>`,
  komeito: `<circle cx="12" cy="12" r="9" ${S}/><circle cx="12" cy="12" r="5" ${S}/>`,
  dpfp: `<path d="M12 3 21 20H3Z" ${S}/><circle cx="12" cy="14" r="2.6" fill="currentColor"/>`,
  sanseito: `<rect x="4" y="4" width="16" height="16" ${S} transform="rotate(45 12 12)"/><rect x="8.5" y="8.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/>`,
  mirai: `<circle cx="12" cy="12" r="9" ${S}/><circle cx="12" cy="7" r="2" fill="currentColor"/><circle cx="7.7" cy="14.5" r="2" fill="currentColor"/><circle cx="16.3" cy="14.5" r="2" fill="currentColor"/>`,
  jcp: `<path d="M4 4h16v16H4Z" ${S}/><path d="M4 12h16" ${S}/>`,
  reiwa: `<circle cx="12" cy="12" r="9" ${S}/><path d="M5 15c4-6 10-6 14 0" ${S}/>`,
  hoshu: `<path d="M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9Z" fill="none" stroke="currentColor" stroke-width="2"/>`,
  sdp: `<circle cx="8" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="16" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2.2"/>`,
  inochi: `<path d="M12 21C5 15 3 11 6 7s6-2 6 1c0-3 3-5 6-1s1 8-6 14Z" ${S}/>`,
  okinawa: `<path d="M3 15c3-4 6-4 9 0s6 4 9 0" ${S}/><path d="M3 9c3-4 6-4 9 0s6 4 9 0" ${S}/>`,
  shishi: `<path d="M12 3v18M5 8l14 8M19 8 5 16" ${S}/>`,
  genyu: `<path d="M4 20 12 4l8 16" ${S}/><path d="M8 13h8" ${S}/>`,
};

/** インライン SVG の印。未定義の政党は null */
export function emblem(key, color = "currentColor", cls = "mon-i") {
  const body = EMBLEMS[key];
  if (!body) return "";
  return `<svg class="${cls}" viewBox="0 0 24 24" style="color:${color}" aria-hidden="true">${body}</svg>`;
}
