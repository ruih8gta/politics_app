"""jpn-atlas の TopoJSON から、都道府県ごとの SVG パスを作る。

使い方:
    npm pack jpn-atlas@1.0.2 && tar xzf jpn-atlas-1.0.2.tgz
    python3 scripts/build_map.py package/japan/japan.json data/japan-map.json

元データ: jpn-atlas (BSD-3-Clause) / 国土地理院「地球地図日本」
jpn-atlas の座標はすでに画面座標（y 軸下向き）に投影済み。
地図を大きく描くため、沖縄県は本土の左上（日本海側の余白）に移し、
東京都の伊豆諸島・小笠原諸島は省略する。
"""
import json
import sys

OKINAWA = "47"
# 沖縄の移動量（画面座標）
OKINAWA_SHIFT = (150, -505)
TOKYO = "13"
# 東京都のうち、この範囲（画面座標）の外にある島は描かない
TOKYO_MAINLAND = (430, 290, 480, 325)


def decode_arcs(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    out = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        out.append(pts)
    return out


def ring_points(ring, arcs):
    pts = []
    for i in ring:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts


def polygons(geom):
    if geom["type"] == "Polygon":
        return [geom["arcs"]]
    if geom["type"] == "MultiPolygon":
        return geom["arcs"]
    return []


def simplify(pts, tol=0.35):
    """近すぎる点を間引く（形はほぼ変えずにサイズを減らす）"""
    if len(pts) < 4:
        return pts
    out = [pts[0]]
    for p in pts[1:-1]:
        q = out[-1]
        if abs(p[0] - q[0]) + abs(p[1] - q[1]) >= tol:
            out.append(p)
    out.append(pts[-1])
    return out


def main(src, dst):
    topo = json.load(open(src, encoding="utf-8"))
    arcs = decode_arcs(topo)
    prefs = {}
    for g in topo["objects"]["prefectures"]["geometries"]:
        code = g["id"]
        dx, dy = OKINAWA_SHIFT if code == OKINAWA else (0, 0)
        parts = []
        for poly in polygons(g):
            for ring in poly:
                pts = simplify(ring_points(ring, arcs))
                if len(pts) < 3:
                    continue
                if code == TOKYO:
                    cx = sum(p[0] for p in pts) / len(pts)
                    cy = sum(p[1] for p in pts) / len(pts)
                    x0, y0, x1, y1 = TOKYO_MAINLAND
                    if not (x0 <= cx <= x1 and y0 <= cy <= y1):
                        continue
                d = "M" + "L".join(f"{x + dx:.1f},{y + dy:.1f}" for x, y in pts) + "Z"
                parts.append(d)
        prefs[code] = "".join(parts)

    xs, ys = [], []
    for d in prefs.values():
        for seg in d.replace("M", " ").replace("L", " ").replace("Z", " ").split():
            x, y = seg.split(",")
            xs.append(float(x))
            ys.append(float(y))
    pad = 8
    box = [round(min(xs) - pad), round(min(ys) - pad), round(max(xs) - min(xs) + pad * 2), round(max(ys) - min(ys) + pad * 2)]
    ok = [tuple(map(float, seg.split(","))) for seg in prefs[OKINAWA].replace("M", " ").replace("L", " ").replace("Z", " ").split()]
    out = {
        "source": "jpn-atlas 1.0.2 (BSD-3-Clause) / 国土地理院「地球地図日本」",
        "viewBox": box,
        # 沖縄を囲む枠（位置を移したことを示す）[x, y, 幅, 高さ]
        "okinawaFrame": [round(min(p[0] for p in ok) - 6), round(min(p[1] for p in ok) - 6),
                         round(max(p[0] for p in ok) - min(p[0] for p in ok) + 12),
                         round(max(p[1] for p in ok) - min(p[1] for p in ok) + 12)],
        "prefectures": prefs,
    }
    json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("viewBox", box, "size", sum(len(d) for d in prefs.values()))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
