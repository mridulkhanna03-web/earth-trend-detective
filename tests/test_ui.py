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


def test_opens_on_real_nasa_data(app):
    expect(app).to_have_title("Earth Trend Detective")
    expect(app.locator(".sample .badge")).to_have_text("Real NASA data")
    expect(app.locator("#chartTitle .src")).to_have_text("NASA data")
    expect(app.locator("body")).not_to_contain_text(re.compile("sample data", re.I))
    expect(app.locator("#chart")).to_be_visible()


def test_menus_offer_only_what_has_data(app):
    assert app.locator("#regSel option").evaluate_all("o => o.map(x => x.value)") == REGIONS
    assert app.locator("#varSel option").count() == 6
    assert app.locator("#seaSel option").count() == 5
    expect(app.locator("#q")).to_have_count(0)                      # question box removed


@pytest.mark.parametrize("chip, region, text", [
    ("Smoke summers over Wisconsin", "wisconsin", "Yes. Haze/smoke is rising"),
    ("Amazon groundwater is falling", "amazon", "Yes. Groundwater is falling"),
    ("Hazier air over north India", "igp", "Yes. Haze/smoke is rising"),
    ("Is the whole world warming?", "world", "Likely rising, but not confirmed"),
    ("Pune monsoon rain: no clear trend", "pune", "Not proven"),
])
def test_example_buttons(app, chip, region, text):
    app.get_by_role("button", name=chip).click()
    expect(verdict(app)).to_contain_text(text)
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
    app.select_option("#varSel", "sst")                             # sea temperature in Wisconsin
    expect(verdict(app)).to_have_text("Nothing to test yet")
    expect(app.locator("#chartEmpty")).to_be_visible()
    expect(app.locator("#chart")).to_be_hidden()
    app.select_option("#regSel", "world")
    expect(verdict(app)).to_contain_text("Sea temperature")


def test_period_under_eight_years_is_refused(app):
    app.select_option("#y0Sel", "2020")
    expect(app.locator("#yrErr")).to_be_visible()
    app.select_option("#y0Sel", "2002")
    expect(app.locator("#yrErr")).to_be_hidden()


def test_season_tiles_and_start_year_strip(app):
    tiles = app.locator(".seasons button")
    expect(tiles).to_have_count(5)
    tiles.nth(1).click()                                            # Dec-Feb
    expect(app.locator("#seaSel")).to_have_value("DJF")
    expect(verdict(app)).to_contain_text("Not proven")
    app.locator(".strip button").nth(4).click()                     # fifth start year = 2006
    expect(app.locator("#y0Sel")).to_have_value("2006")


def test_map_toggle_and_region_click(app):
    app.locator("#mFlat").click()
    expect(app.locator("#mFlat")).to_have_attribute("aria-pressed", "true")
    app.locator("#mGlobe").click()
    expect(app.locator("#mGlobe")).to_have_attribute("aria-pressed", "true")


def test_scenario_uses_data_and_stays_on_the_scale(app):
    expect(app.locator("#scenario")).to_contain_text("What the data shows in similar places")
    expect(app.locator("#scenario")).to_contain_text("Sahel, West Africa. Haze/smoke falling (likely), Groundwater rising")
    app.get_by_role("button", name="Amazon groundwater is falling").click()
    expect(app.locator("#scenario")).to_contain_text("0.0 points by 2035 (the end of the scale)")   # percentile cannot go below 0
    expect(app.locator("#causes")).to_contain_text("Common drivers of this kind of change")


def test_similar_places_and_table(app):
    expect(app.locator("body")).to_contain_text("Sahel, West Africa")       # Wisconsin's best match
    app.get_by_text("Show the numbers as a table").click()
    assert app.locator("#dataTable tr").count() >= 20


def test_every_region_and_measurement_renders(app):
    for r in REGIONS:
        app.select_option("#regSel", r)
        for v in ["aod", "temp", "precip", "tws", "soil", "sst"]:
            app.select_option("#varSel", v)
            has_data = not (v == "sst" and r != "world") and not (r == "world" and v in ("tws", "soil"))
            assert (verdict(app).inner_text() != "Nothing to test yet") == has_data, (r, v)


def test_usable_with_keyboard_and_on_a_phone(app):
    assert app.locator("select:not([aria-label])").evaluate_all("s => s.every(x => x.labels.length > 0)")
    app.set_viewport_size({"width": 390, "height": 800})
    app.reload()                                                    # a phone loads the page at this width
    expect(verdict(app)).to_be_visible()
    assert app.evaluate("document.documentElement.scrollWidth <= window.innerWidth")   # no sideways scroll


def test_missing_data_file_shows_error_not_fake_numbers(page: Page, site):
    page.route("**/data/regions.json", lambda route: route.abort())
    page.goto(site + "/index.html")
    expect(page.locator("main")).to_contain_text("The NASA data file could not be loaded")
    expect(page.locator("#chart")).to_have_count(0)


def test_how_it_works_page_opens(app):
    app.get_by_role("link", name="How it works").first.click()
    expect(app.locator("h1")).to_contain_text("How our data and statistics work")
