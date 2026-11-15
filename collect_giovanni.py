"""Copy Giovanni CSV downloads into giovanni_csv/ under the names the converter expects.

Run:  python collect_giovanni.py            (looks in ~/Downloads)
The region comes from the "User Bounding Box" line inside each file, matched against the boxes in stats.js.
The variable comes from the product name in the file name.
"""
import re, shutil, sys
from pathlib import Path

HERE = Path(__file__).parent
PRODUCTS = {"MYD08_M3_6_1_AOD_550_Dark_Target_Deep_Blue_Combined": "aod", "M2TMNXSLV_5_12_4_T2M": "temp",
            "GPM_3IMERGM_07_precipitation": "precip", "GLDAS_NOAH025_M_2_1_SoilMoi0_10cm": "soil",
            "GRACEDADM_CLSM025GL_7D_3_0_gws": "tws", "MODISA_L3m_SST": "sst"}

# region boxes from stats.js, turned into Giovanni's order: west, south, east, north
boxes: dict[tuple[float, ...], str] = {(-180.0, -90.0, 180.0, 90.0): "world"}
for rid, b in re.findall(r"^  (\w+):\{name:'[^']+', kind:'\w+', bbox:\[([^\]]+)\]", (HERE / "stats.js").read_text(), re.M):
    s, w, n, e = map(float, b.split(","))
    boxes[(w, s, e, n)] = rid

src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads"
out = HERE / "giovanni_csv"
out.mkdir(exist_ok=True)
for f in sorted(src.glob("g4.areaAvgTimeSeries.*.csv")):
    var = next((v for k, v in PRODUCTS.items() if k in f.name), None)
    m = re.search(r'User Bounding Box:,"([^"]+)"', f.read_text(encoding="utf-8-sig")[:2000])
    region = boxes.get(tuple(map(float, m[1].split(",")))) if m else None
    if not var or not region:
        print(f"SKIPPED  {f.name}   ({'unknown product' if not var else 'box matches no region: ' + (m[1] if m else '?')})")
        continue
    shutil.copyfile(f, out / f"{region}__{var}.csv")
    print(f"{region}__{var}.csv")
