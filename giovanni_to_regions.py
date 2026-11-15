"""Turn Giovanni "Time Series, Area-Averaged" CSV files into data/regions.json for the app (index.html).

Name each CSV  <region>__<variable>.csv  (two underscores), e.g.  wisconsin__aod.csv
Run:           python giovanni_to_regions.py giovanni_csv/ -o data/regions.json
"""
import argparse, calendar, csv, json, re, statistics, sys
from datetime import date
from pathlib import Path

# Must match the ids in stats.js (REGIONS and VARS).
REGIONS = {"world", "wisconsin", "california", "amazon", "sahel", "igp", "pune", "med", "capetown", "seaus"}
VARS = {"aod", "temp", "precip", "tws", "soil", "sst"}


def read_csv(path):
    """Return ({(year, month): value or None}, fill_value)."""
    # shortcut: assumes Giovanni's layout (header lines, then a "time,<name>" row, then "YYYY-MM-...,value" rows);
    # written without a real file to hand, so check the first output against the Giovanni plot.
    fill, out, in_data = -9999.0, {}, False
    for row in csv.reader(path.read_text(encoding="utf-8-sig").splitlines()):
        if not row:
            continue
        if not in_data:
            if row[0].strip().lower().startswith("fill value") and len(row) > 1:
                fill = float(row[1])
            in_data = row[0].strip().lower() == "time"
            continue
        m = re.match(r"(\d{4})-(\d{2})", row[0].strip())
        if not m or len(row) < 2:
            continue
        try:
            v = float(row[1])
        except ValueError:
            v = None
        if v is None or v != v or v == fill:   # v != v catches NaN
            v = None
        out.setdefault((int(m[1]), int(m[2])), []).append(v)
    if not out:
        sys.exit(f"{path.name}: no data rows found (expected a 'time,...' header row followed by dated rows)")
    # weekly or daily files have several rows per month: use their average (missing rows ignored)
    return {k: statistics.fmean(ok) if (ok := [v for v in vs if v is not None]) else None for k, vs in out.items()}


def convert(var, series, precip_per_hour):
    vals = [v for v in series.values() if v is not None]
    if var in ("temp", "sst") and vals and statistics.median(vals) > 150:      # kelvin -> °C
        return {k: None if v is None else v - 273.15 for k, v in series.items()}, "K -> °C"
    if var == "precip" and precip_per_hour:                                    # mm/hr -> mm/month
        return {k: None if v is None else v * 24 * calendar.monthrange(*k)[1] for k, v in series.items()}, "mm/hr -> mm/month"
    return series, ""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", type=Path, help="folder of <region>__<variable>.csv files")
    ap.add_argument("-o", "--out", type=Path, default=Path("data/regions.json"))
    ap.add_argument("--precip-mm-per-hour", action="store_true",
                    help="rainfall CSVs are in mm/hr; convert to mm/month (check the unit on the Giovanni plot)")
    ap.add_argument("--source", default=f"NASA Giovanni, downloaded {date.today():%d %b %Y}")
    a = ap.parse_args()

    files = sorted(a.folder.glob("*.csv"))
    if not files:
        sys.exit(f"No .csv files in {a.folder}")
    data = {}
    for f in files:
        region, _, var = f.stem.partition("__")
        if region not in REGIONS or var not in VARS:
            sys.exit(f"{f.name}: name must be <region>__<variable>.csv\n  regions: {sorted(REGIONS)}\n  variables: {sorted(VARS)}")
        series, note = convert(var, read_csv(f), a.precip_mm_per_hour)
        data[(region, var)] = series
        vals = [v for v in series.values() if v is not None]
        print(f"{f.name:32} {min(series)[0]}-{min(series)[1]:02} to {max(series)[0]}-{max(series)[1]:02}  "
              f"{len(vals)} values, {len(series) - len(vals)} missing, median {statistics.median(vals):.4g}  {note}")

    months = [k for s in data.values() for k in s]
    (y0, m0), (y1, m1) = min(months), max(months)
    grid = [(y, m) for y in range(y0, y1 + 1) for m in range(1, 13) if (y, m) >= (y0, m0) and (y, m) <= (y1, m1)]
    series = {}
    for (region, var), s in data.items():
        series.setdefault(region, {})[var] = [None if s.get(k) is None else round(s[k], 5) for k in grid]

    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps({"source": a.source, "start": f"{y0}-{m0:02}", "series": series}))
    print(f"\nWrote {a.out}: {len(data)} series, {len(grid)} months from {y0}-{m0:02}.")
    print("Check each median above against the Giovanni plot (units!).")


if __name__ == "__main__":
    main()
