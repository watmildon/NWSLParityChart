"""Transform ASA API data into our docs/data JSON format."""

from collections import defaultdict


def transform_games(team_map: dict, games: list) -> list:
    """Convert ASA game records into our weeks/results structure.

    Args:
        team_map: dict mapping ASA team_id -> team abbreviation
        games: list of game dicts from ASA API

    Returns:
        List of week dicts: [{"week": 1, "results": [...]}, ...]
        Only includes completed, non-draw, non-knockout games.
    """
    weeks = defaultdict(list)

    for game in games:
        # Skip non-finished games
        if game.get("status") != "FullTime":
            continue

        # Skip knockout/playoff games
        if game.get("knockout_game"):
            continue

        home_score = game["home_score"]
        away_score = game["away_score"]

        # Skip draws — our format only tracks decisive results
        if home_score == away_score:
            continue

        home_abbrev = team_map.get(game["home_team_id"])
        away_abbrev = team_map.get(game["away_team_id"])

        if not home_abbrev or not away_abbrev:
            continue

        if home_score > away_score:
            winner, loser = home_abbrev, away_abbrev
            score = f"{home_score}-{away_score}"
        else:
            winner, loser = away_abbrev, home_abbrev
            score = f"{away_score}-{home_score}"

        # Parse date from "2025-03-15 23:30:00 UTC" -> "2025-03-15"
        date = game["date_time_utc"].split(" ")[0]

        matchday = game["matchday"]
        weeks[matchday].append({
            "winner": winner,
            "loser": loser,
            "date": date,
            "score": score,
        })

    # Sort weeks by number, and results within each week by date
    sorted_weeks = []
    for week_num in sorted(weeks.keys()):
        results = sorted(weeks[week_num], key=lambda r: r["date"])
        sorted_weeks.append({"week": week_num, "results": results})

    return sorted_weeks
