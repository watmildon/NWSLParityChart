"""Fetch NWSL match data from the American Soccer Analysis API."""

import requests

BASE_URL = "https://app.americansocceranalysis.com/api/v1/nwsl"


def fetch_teams():
    """Fetch all teams and return a dict mapping team_id -> team_abbreviation."""
    resp = requests.get(f"{BASE_URL}/teams", timeout=30)
    resp.raise_for_status()
    teams = resp.json()
    # Some legacy/defunct teams share abbreviations (e.g. old FC Kansas City
    # and current Kansas City Current both use "KC"). We only care about
    # teams that appear in current season data, so keep all mappings — the
    # transform step will naturally filter to only teams present in results.
    return {t["team_id"]: t["team_abbreviation"] for t in teams}


def fetch_games(season: int):
    """Fetch all regular-season games for a given season year.

    Returns the raw list of game dicts from the API.
    """
    resp = requests.get(
        f"{BASE_URL}/games",
        params={"season_name": str(season), "stage_name": "Regular Season"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_season(season: int):
    """High-level: fetch teams + games for a season.

    Returns (team_id_to_abbrev, games) tuple.
    """
    team_map = fetch_teams()
    games = fetch_games(season)
    return team_map, games
