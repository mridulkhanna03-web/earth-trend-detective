"""Browser tests for index.html (Playwright). Run: uv run pytest"""
import http.server
import re
import threading
from functools import partial
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

ROOT = Path(__file__).parent.parent
REGIONS = ["world", "wisconsin", "california", "amazon", "sahel", "igp", "pune", "med", "capetown", "seaus"]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


@pytest.fixture(scope="session")
def site():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_port}"
    srv.shutdown()


@pytest.fixture
def app(page: Page, site):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" or "Assertion failed" in m.text else None)
    page.goto(site + "/index.html")
    expect(page.locator("#verdict h3")).to_be_visible()
    yield page
    assert errors == [], errors


def verdict(page):
    return page.locator("#verdict h3")


def label(page):
    return page.locator("#verdict .vlabel")


def test_opens_on_real_nasa_data(app):
    expect(app).to_have_title("Earth Trend Detective")
    expect(app.locator(".badge2").first).to_have_text("Real NASA data")
    expect(app.locator("#chartTitle .src")).to_have_text("NASA data")
    expect(app.locator("#srcLine")).to_contain_text("Source: NASA Giovanni")
    expect(app.locator("body")).not_to_contain_text(re.compile("sample data", re.I))
    expect(app.locator("#chart")).to_be_visible()


def test_answer_is_on_the_first_screen(app):
    box = verdict(app).bounding_box()
    assert box and box["y"] + box["height"] < app.viewport_size["height"]      # no scrolling needed to read the answer
    expect(label(app)).to_contain_text("RISING")


def test_menus_offer_only_what_has_data(app):
    assert app.locator("#regSel option").evaluate_all("o => o.map(x => x.value)") == REGIONS
    assert app.locator("#varSel option").count() == 6
    assert app.locator("#seaSel option").count() == 5
    assert app.locator("#varSel option:disabled").evaluate_all("o => o.map(x => x.value)") == ["sst"]          # Wisconsin has no sea
    app.select_option("#regSel", "world")
    assert app.locator("#varSel option:disabled").evaluate_all("o => o.map(x => x.value)") == ["tws", "soil"]
    expect(app.locator("#q")).to_have_count(0)                      # question box removed


@pytest.mark.parametrize("chip, region, text, tag", [
    ("Smoke summers over Wisconsin", "wisconsin", "Haze/smoke is rising here, but only one of our two tests confirms it.", "RISING"),   # the two tests disagree here
    ("Amazon groundwater is falling", "amazon", "Yes. Groundwater is falling", "FALLING"),
    ("Hazier air over north India", "igp", "Yes. Haze/smoke is rising", "RISING"),
    ("Is the whole world warming?", "world", "Likely rising, but not confirmed", "likely, not confirmed"),
    ("Pune monsoon rain: no clear trend", "pune", "Not proven", "NO CLEAR TREND"),
])
def test_example_buttons(app, chip, region, text, tag):
    app.get_by_role("button", name=chip).click()
    expect(verdict(app)).to_contain_text(text)
    expect(label(app)).to_contain_text(tag)
    expect(app.locator("#regSel")).to_have_value(region)
    expect(app.get_by_role("button", name=chip)).to_have_attribute("aria-pressed", "true")


def test_step_by_step_choice_updates_answer(app):
    app.select_option("#regSel", "med")
    app.select_option("#varSel", "temp")
    app.select_option("#seaSel", "ALL")
    expect(verdict(app)).to_contain_text("Yes. Temperature is rising")
    expect(app.locator("#chartTitle")).to_contain_text("Iberia")
    expect(app.locator(".facts")).to_contain_text("°C every 10 years")


def test_pair_without_data_says_so(app):
    app.select_option("#regSel", "world")
    app.select_option("#varSel", "sst")
    expect(verdict(app)).to_contain_text("Sea temperature")
    app.select_option("#regSel", "pune")                            # sea temperature does not exist for a land region
    expect(verdict(app)).to_have_text("Nothing to test yet")
    expect(label(app)).to_have_text("NO DATA")
    expect(app.locator("#chart")).to_be_hidden()
    expect(app.locator("#startCtl")).to_be_hidden()


def test_period_under_eight_years_is_refused(app):
    app.select_option("#y0Sel", "2020")
    expect(app.locator("#yrErr")).to_be_visible()
    app.select_option("#y0Sel", "2002")
    expect(app.locator("#yrErr")).to_be_hidden()


def test_season_tiles_change_the_chart_in_place(app):
    tiles = app.locator(".seasons button")
    expect(tiles).to_have_count(5)
    tiles.nth(1).click()                                            # Dec-Feb
    expect(app.locator("#seaSel")).to_have_value("DJF")
    expect(label(app)).to_have_text("NO CLEAR TREND")
    expect(app.locator("#chartTitle")).to_contain_text("Dec–Feb")
    expect(app.locator("#tp1")).to_be_visible()                     # no jump to another tab


def test_start_year_slider(app):
    slider = app.locator("#startRange")
    assert (slider.get_attribute("min"), slider.get_attribute("max")) == ("2002", "2018")
    expect(app.locator("#startBlocks i")).to_have_count(17)
    expect(app.locator("#startBlocks i.yes")).to_have_count(7)
    expect(app.locator("#startFind")).to_contain_text("Confirmed when the record starts in 2002 to 2008")
    slider.fill("2012")
    expect(app.locator("#y0Sel")).to_have_value("2012")
    expect(app.locator("#startVal")).to_have_text("2012")
    expect(label(app)).to_have_text("NO CLEAR TREND")
    slider.press("ArrowLeft")                                       # works from the keyboard
    expect(app.locator("#y0Sel")).to_have_value("2011")
    app.select_option("#y0Sel", "2002")                             # the When menu and the slider stay in step
    expect(slider).to_have_value("2002")
    expect(app.locator(".strip")).to_have_count(0)                  # the old clickable squares are gone


def test_map_toggle(app):
    app.locator("#mFlat").click()
    expect(app.locator("#mFlat")).to_have_attribute("aria-pressed", "true")
    app.locator("#mGlobe").click()
    expect(app.locator("#mGlobe")).to_have_attribute("aria-pressed", "true")


def test_tabs_show_one_panel_and_carry_a_headline(app):
    assert app.locator("[role=tab]:visible").evaluate_all("t => t.map(x => x.firstChild.textContent)") == ["Evidence", "Similar places", "Causes", "Numbers"]
    expect(app.locator("#t3")).to_contain_text("Sahel, West Africa (50% match)")
    app.locator("#t3").click()
    expect(app.locator("#tp3")).to_be_visible()
    expect(app.locator("#tp1")).to_be_hidden()
    expect(app.locator("#analogs")).to_contain_text("Sahel, West Africa")
    expect(app.locator("#scenario")).to_contain_text("Sahel, West Africa. Haze/smoke falling (likely), Groundwater rising")
    app.locator("#t4").click()
    expect(app.locator("#causes")).to_contain_text("Common drivers of this kind of change")
    app.get_by_role("button", name="Amazon groundwater is falling").click()     # an example brings back the first tab
    expect(app.locator("#tp1")).to_be_visible()
    expect(app.locator("#scenario")).to_contain_text("0.0 points by 2035 (the end of the scale)", use_inner_text=False)   # percentile cannot go below 0


def test_other_trends_list_opens_a_measurement_in_place(app):
    rows = app.locator("#regTrends tbody tr:visible")
    expect(rows).to_have_count(2)                                   # only the trends: haze (chosen) and groundwater
    app.get_by_role("button", name="Show all 5 measurements").click()
    expect(rows).to_have_count(5)
    rows.filter(has_text="Temperature").click()
    expect(app.locator("#varSel")).to_have_value("temp")
    expect(app.locator("#chartTitle")).to_contain_text("Air temperature")
    expect(app.locator("#tp1")).to_be_visible()


def test_numbers_tab_and_download(app):
    app.locator("#t5").click()
    expect(app.locator("#statsBox tr")).to_have_count(9)
    expect(app.locator("#statsBox")).to_contain_text("Change per year")
    expect(app.locator("#statsBox")).to_contain_text("slope of the straight-line fit")
    assert app.locator("#dataTable tr").count() >= 20
    with app.expect_download() as got:
        app.locator("#csvBtn").click()
    assert got.value.suggested_filename == "earth-trend-wisconsin-aod-JJA.csv"
    lines = Path(got.value.path()).read_text().splitlines()
    assert "year,measured,trend_line" in lines and lines[-1].startswith("2025,0.306,")
    assert any(line.startswith("# Source: NASA Giovanni") for line in lines)


def test_every_region_and_measurement_renders(app):
    for r in REGIONS:
        app.select_option("#regSel", r)
        for v in app.locator("#varSel option:not(:disabled)").evaluate_all("o => o.map(x => x.value)"):
            app.select_option("#varSel", v)
            assert verdict(app).inner_text() != "Nothing to test yet", (r, v)
            assert label(app).count() == 1, (r, v)


def test_usable_with_keyboard_and_on_a_phone(app):
    assert app.locator("select:not([aria-label])").evaluate_all("s => s.every(x => x.labels.length > 0)")
    app.set_viewport_size({"width": 390, "height": 800})
    app.reload()                                                    # a phone loads the page at this width
    expect(verdict(app)).to_be_visible()
    assert app.evaluate("document.documentElement.scrollWidth <= window.innerWidth")   # no sideways scroll
    tops = app.evaluate("['regSel', 'verdict', 'chart'].map(i => document.getElementById(i).getBoundingClientRect().top)")
    assert tops == sorted(tops)                                     # choices, then the answer, then the evidence


def test_missing_data_file_shows_error_not_fake_numbers(page: Page, site):
    page.route("**/data/regions.json", lambda route: route.abort())
    page.goto(site + "/index.html")
    expect(page.locator("main")).to_contain_text("The NASA data file could not be loaded")
    expect(page.locator("#chart")).to_have_count(0)


def test_how_it_works_and_about_pages_open(app):
    app.get_by_role("link", name="About").first.click()
    expect(app.locator("h2").first).to_have_text("About this project")
    app.get_by_role("link", name="Back to the app").click()
    app.get_by_role("link", name="How it works").first.click()
    expect(app.locator("h1")).to_contain_text("How our data and statistics work")
