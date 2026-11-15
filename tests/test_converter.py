"""Unit tests for giovanni_to_regions.py (Giovanni CSV -> data/regions.json)."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

import giovanni_to_regions as g

ROOT = Path(__file__).parent.parent
HEAD = 'Title:,"x"\nFill Value (mean_x):, -9999\n\ntime, mean_x\n'


def write(tmp_path, name, rows, head=HEAD):
    f = tmp_path / name
    f.write_text(head + rows)
    return f


def test_reads_monthly_rows_after_header(tmp_path):
    f = write(tmp_path, "a.csv", "2002-07-01 00:00:00,0.25\n2002-08-01 00:00:00,0.18\n")
    assert g.read_csv(f) == {(2002, 7): 0.25, (2002, 8): 0.18}


def test_fill_value_and_text_become_missing(tmp_path):
    f = write(tmp_path, "a.csv", "2002-01-01,-9999\n2002-02-01,nan\n2002-03-01,abc\n2002-04-01,1.5\n")
    assert g.read_csv(f) == {(2002, 1): None, (2002, 2): None, (2002, 3): None, (2002, 4): 1.5}


def test_fill_value_is_read_from_header(tmp_path):
    f = write(tmp_path, "a.csv", "2003-02-03,-999\n2003-03-03,5\n", head="Fill Value (x):, -999\n\ntime, x\n")
    assert g.read_csv(f) == {(2003, 2): None, (2003, 3): 5.0}


def test_weekly_rows_are_averaged_per_month(tmp_path):
    f = write(tmp_path, "a.csv", "2003-02-03,10\n2003-02-10,20\n2003-02-17,-9999\n2003-03-03,-9999\n")
    assert g.read_csv(f) == {(2003, 2): 15.0, (2003, 3): None}   # missing weeks ignored; all-missing month stays missing


def test_file_without_data_rows_stops(tmp_path):
    with pytest.raises(SystemExit):
        g.read_csv(write(tmp_path, "a.csv", ""))


def test_kelvin_becomes_celsius_only_for_temperatures():
    out, note = g.convert("temp", {(2002, 1): 273.15, (2002, 2): None}, False)
    assert out == {(2002, 1): 0.0, (2002, 2): None} and "°C" in note
    assert g.convert("temp", {(2002, 1): 14.5}, False)[0] == {(2002, 1): 14.5}      # already °C
    assert g.convert("soil", {(2002, 1): 300.0}, False)[0] == {(2002, 1): 300.0}    # not a temperature


def test_rain_per_hour_becomes_per_month():
    out, _ = g.convert("precip", {(2024, 2): 1.0, (2023, 2): 1.0, (2024, 1): None}, True)
    assert out == {(2024, 2): 24 * 29, (2023, 2): 24 * 28, (2024, 1): None}         # leap year counted
    assert g.convert("precip", {(2024, 2): 1.0}, False)[0] == {(2024, 2): 1.0}      # flag off: unchanged


def run(folder, out):
    return subprocess.run([sys.executable, str(ROOT / "giovanni_to_regions.py"), str(folder), "-o", str(out)],
                          capture_output=True, text=True)


def test_end_to_end_pads_series_to_a_common_start(tmp_path):
    write(tmp_path, "wisconsin__aod.csv", "2002-03-01,0.1\n2002-04-01,0.2\n")
    write(tmp_path, "wisconsin__temp.csv", "2002-01-01,280\n2002-02-01,281\n")
    out = tmp_path / "o" / "regions.json"
    assert run(tmp_path, out).returncode == 0
    d = json.loads(out.read_text())
    assert d["start"] == "2002-01"
    assert d["series"]["wisconsin"]["aod"] == [None, None, 0.1, 0.2]
    assert d["series"]["wisconsin"]["temp"] == [6.85, 7.85, None, None]


def test_wrong_file_name_is_rejected(tmp_path):
    write(tmp_path, "atlantis__aod.csv", "2002-03-01,0.1\n")
    r = run(tmp_path, tmp_path / "o.json")
    assert r.returncode != 0 and "atlantis__aod.csv" in r.stderr


def test_shipped_data_file_matches_the_app():
    d = json.loads((ROOT / "data" / "regions.json").read_text())
    assert d["start"] == "2002-01" and len(d["series"]) == 10
    assert sum(len(v) for v in d["series"].values()) == 49
    assert all(len(s) == 288 for v in d["series"].values() for s in v.values())
    assert abs(d["series"]["wisconsin"]["aod"][6] - 0.2504) < 1e-4                  # July 2002, as on the Giovanni plot
