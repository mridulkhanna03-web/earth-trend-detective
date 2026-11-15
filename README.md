# Earth Trend Detective

Is a place on Earth really changing, or is it just noise?

Pick a NASA measurement, a region and a period. The app draws the record year by year, fits a trend, and tells you in plain words whether the change is statistically significant.

Built for the NASA Space Apps Challenge 2026, challenge "Be An Earth System Trend Detective!".

**Live app:** https://mridulkhanna03-web.github.io/earth-trend-detective/

## What it does

1. **Choose** a measurement (What), a region (Where) and years and season (When).
2. **See** the time series, one point per year, with a trend line.
3. **Get an answer** with one of three verdicts:
   - **Confirmed:** passes a strict test that keeps false alarms below 5%.
   - **Likely, not confirmed:** passes the ordinary test only.
   - **No clear trend.**
4. **Look deeper:** the rate of change with a 95% range, the p-value, a second test (Mann-Kendall), the same test for each season, and whether the result depends on the starting year.
5. **Compare:** regions whose trends move the same way, and what the data shows there.

A plain-language walk through the data and the statistics is in [How it works](how_it_works.html).

## Data

All data is from [NASA Giovanni](https://giovanni.gsfc.nasa.gov/giovanni/) ("Time Series, Area-Averaged"), 2002 to 2025, downloaded on 14 Nov 2026.

| Measurement | NASA product |
|---|---|
| Haze and smoke (aerosol optical depth) | MODIS Aqua, `MYD08_M3` v6.1 |
| Air temperature | MERRA-2, `M2TMNXSLV` v5.12.4 |
| Rainfall | GPM IMERG Final Run, `GPM_3IMERGM` v07 |
| Soil moisture (0–10 cm) | GLDAS Noah, `GLDAS_NOAH025_M` v2.1 |
| Groundwater percentile | GRACE / GRACE-FO, `GRACEDADM_CLSM025GL_7D` v3.0 (weekly, averaged to months) |
| Sea surface temperature (whole world only) | MODIS Aqua, `MODISA_L3m_SST_Monthly_9km` R2019.0 |

Regions: Entire world, Wisconsin, Central Valley of California, Southern Amazon, Sahel, Indo-Gangetic Plain, Western Maharashtra (Pune), Iberia, Western Cape, Southeast Australia. In total 49 series.

The original Giovanni files are in `giovanni_csv/`. Each one contains a "URL to Reproduce Results" line.

NASA does not endorse this project.

## How it is built

A static website. There is no server: the browser does every calculation.

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Styles |
| `stats.js` | Region and measurement definitions and all statistics |
| `app.js` | Loads the data; menus, globe, chart and answer panels |
| `data/regions.json` | The 49 NASA series, packed into one file |
| `how_it_works.html` | Explanation of the data and methods |
| `giovanni_to_regions.py` | Turns the Giovanni CSV files into `data/regions.json` |
| `collect_giovanni.py` | Renames Giovanni downloads to `<region>__<variable>.csv` |
| `tests/` | Tests for the statistics, the converter and the page |

Libraries, loaded from a CDN: D3 and topojson (globe), Chart.js (chart).

## Run it on your computer

```
python3 -m http.server 8000
```

Then open http://localhost:8000/. Opening `index.html` directly as a file does not work, because the browser blocks loading the data file.

## Rebuild the data

```
python3 collect_giovanni.py                 # copies Giovanni CSVs from ~/Downloads into giovanni_csv/
python3 giovanni_to_regions.py giovanni_csv/ -o data/regions.json --precip-mm-per-hour --source "NASA Giovanni, downloaded 14 Nov 2026"
```

## Tests

```
uv run pytest                    # converter and browser tests (needs Google Chrome)
node --test tests/core.test.js   # statistics tests
uv run pyright                   # type check of the Python files
```

## Limits

- "Confirmed" keeps false alarms below 5% for records of 16 years or more. Shorter records with strong year-to-year resemblance can exceed that.
- Each region shows up to 30 tests (6 measurements, 5 parts of the year), so about one can be significant by luck. There is no correction for this.
- The correction for years that resemble each other is our own cautious version of a textbook method, not a named published one.
- A run of unusual years at the end of a record can create a trend in any test.
- A trend is not a forecast. The lists of common drivers are general background, not results of this tool.
