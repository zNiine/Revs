#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Pointstreak ALPB team -> player stats scraper

Input (from prior step):
  pointstreak_alpb_teams.csv with columns:
    season,season_id,division,team,team_id,team_url

Output:
  pointstreak_alpb_batters.csv
  pointstreak_alpb_pitchers.csv
"""

import csv
import sys
import time
from typing import List, Dict, Tuple, Optional
import re

import requests
from bs4 import BeautifulSoup
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

INPUT_TEAMS_CSV = "pointstreak_alpb_teams.csv"
OUT_BATTERS = "pointstreak_alpb_batters.csv"
OUT_PITCHERS = "pointstreak_alpb_pitchers.csv"

BASE = "https://baseball.pointstreak.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

PLAYER_ID_RE = re.compile(r"playerid=(\d+)")
SEASON_ID_RE = re.compile(r"seasonid=(\d+)")

def make_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(
        total=5,
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retries, pool_connections=10, pool_maxsize=10)
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    s.headers.update(HEADERS)
    return s

def read_team_rows(path: str) -> List[Dict[str, str]]:
    out = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            # Expecting these fields from prior step
            if not row.get("team_url"):
                continue
            out.append(row)
    return out

def fetch_html(session: requests.Session, url: str) -> BeautifulSoup:
    r = session.get(url, timeout=25)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")

def build_batting_url(team_url: str) -> str:
    # team_home.html?teamid=...&seasonid=... -> team_stats.html?teamid=...&seasonid=...
    return team_url.replace("team_home.html", "team_stats.html")

def build_pitching_url(batting_url: str) -> str:
    # Append view=pitching (preserve existing params)
    sep = "&" if "?" in batting_url else "?"
    return f"{batting_url}{sep}view=pitching"

def parse_table_headers(tbl: BeautifulSoup) -> List[str]:
    headers = []
    for th in tbl.select("thead th"):
        # Use visible text; fall back to data-orderby if text is empty
        label = th.get_text(strip=True)
        if not label:
            label = th.get("data-orderby") or ""
        # normalize simple whitespace
        headers.append(label.replace("\xa0", " ").strip())
    return headers

def is_total_row(tr: BeautifulSoup) -> bool:
    # Total row has first cell with <strong>Total:</strong> or text 'Total:'
    first_td = tr.find("td")
    if not first_td:
        return False
    txt = first_td.get_text(" ", strip=True).lower()
    return "total" in txt

def extract_player_cell(td: BeautifulSoup) -> Tuple[str, str]:
    """
    Returns (player_name, player_id)
    """
    a = td.find("a", href=True)
    if a:
        name = a.get_text(strip=True)
        href = a["href"]
        m = PLAYER_ID_RE.search(href)
        pid = m.group(1) if m else ""
        return name, pid
    return td.get_text(strip=True), ""

def extract_cells(tr: BeautifulSoup) -> List[str]:
    tds = tr.find_all("td")
    return [td.get_text(strip=True).replace("\xa0", " ") for td in tds]

def parse_stats_table(
    soup: BeautifulSoup,
    expect_kind: str  # "bat" or "pitch" (only for sanity if you want)
) -> Tuple[List[str], List[Dict[str, str]]]:
    """
    Returns (headers, rows) where rows are list of dicts keyed by headers.
    First column is 'Player' (with link). We also add 'player_id'.
    Skips the Total row.
    """
    tbl = soup.select_one("table.nova-stats-table")
    if not tbl:
        return [], []

    headers = parse_table_headers(tbl)
    body_rows: List[Dict[str, str]] = []

    for tr in tbl.select("tbody tr"):
        if is_total_row(tr):
            # skip the summary
            continue

        tds = tr.find_all("td")
        if not tds or len(tds) < 2:
            continue

        # Player cell (first td) also contains link with playerid
        player_name, player_id = extract_player_cell(tds[0])

        row_vals: List[str] = []
        for td in tds:
            # Keep visible text exactly as seen
            row_vals.append(td.get_text(strip=True).replace("\xa0", " "))

        # In case header length != td count, pad/truncate to match
        if len(row_vals) < len(headers):
            row_vals += [""] * (len(headers) - len(row_vals))
        elif len(row_vals) > len(headers):
            row_vals = row_vals[:len(headers)]

        row = {h: v for h, v in zip(headers, row_vals)}
        # standardize player fields
        row["Player"] = player_name
        row["player_id"] = player_id
        body_rows.append(row)

    return headers, body_rows

def ensure_leading_fields(
    rows: List[Dict[str, str]],
    leading: Dict[str, str]
) -> List[Dict[str, str]]:
    for r in rows:
        r.update(leading)  # r already contains player stats; leading keys overwrite/add
    return rows

def write_csv(path: str, rows: List[Dict[str, str]], leading_order: List[str]):
    if not rows:
        return
    # union headers across rows
    all_keys = set()
    for r in rows:
        all_keys.update(r.keys())
    # Put leading fields first, then the rest (stable order)
    tail = [k for k in sorted(all_keys) if k not in leading_order]
    fieldnames = leading_order + tail
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

def main():
    teams = read_team_rows(INPUT_TEAMS_CSV)
    if not teams:
        print(f"No team rows in {INPUT_TEAMS_CSV}.", file=sys.stderr)
        sys.exit(1)

    session = make_session()

    all_batters: List[Dict[str, str]] = []
    all_pitchers: List[Dict[str, str]] = []

    for i, t in enumerate(teams, 1):
        season_label = t.get("season", "")
        season_id = t.get("season_id", "")
        team_name = t.get("team", "")
        team_id = t.get("team_id", "")
        team_url = t.get("team_url", "")

        # Build URLs
        batting_url = build_batting_url(team_url)
        pitching_url = build_pitching_url(batting_url)

        print(f"[{i}/{len(teams)}] {season_label} | {team_name} | {batting_url}")

        # --- Batting ---
        try:
            soup_bat = fetch_html(session, batting_url)
            h_bat, rows_bat = parse_stats_table(soup_bat, expect_kind="bat")
            if rows_bat:
                leading = {
                    "Season": season_label,
                    "season_id": season_id,
                    "Team": team_name,
                    "team_id": team_id,
                    "stats_url": batting_url,
                }
                ensure_leading_fields(rows_bat, leading)
                all_batters.extend(rows_bat)
        except Exception as e:
            print(f"  ! batting error: {e}", file=sys.stderr)

        # --- Pitching ---
        try:
            soup_pit = fetch_html(session, pitching_url)
            h_pit, rows_pit = parse_stats_table(soup_pit, expect_kind="pitch")
            if rows_pit:
                leading = {
                    "Season": season_label,
                    "season_id": season_id,
                    "Team": team_name,
                    "team_id": team_id,
                    "stats_url": pitching_url,
                }
                ensure_leading_fields(rows_pit, leading)
                all_pitchers.extend(rows_pit)
        except Exception as e:
            print(f"  ! pitching error: {e}", file=sys.stderr)

        # Be polite
        time.sleep(0.4)

    if all_batters:
        write_csv(
            OUT_BATTERS,
            all_batters,
            leading_order=["Season", "season_id", "Team", "team_id", "player_id", "Player", "stats_url"],
        )
        print(f"Wrote {len(all_batters)} batting rows → {OUT_BATTERS}")
    else:
        print("No batting rows scraped.", file=sys.stderr)

    if all_pitchers:
        write_csv(
            OUT_PITCHERS,
            all_pitchers,
            leading_order=["Season", "season_id", "Team", "team_id", "player_id", "Player", "stats_url"],
        )
        print(f"Wrote {len(all_pitchers)} pitching rows → {OUT_PITCHERS}")
    else:
        print("No pitching rows scraped.", file=sys.stderr)

if __name__ == "__main__":
    main()
