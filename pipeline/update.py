"""Merge new results into existing season data files."""

import json
from pathlib import Path


def load_existing(data_dir: Path, season: int) -> dict | None:
    """Load existing season JSON file, or None if it doesn't exist."""
    path = data_dir / f"{season}.json"
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _result_key(result: dict) -> tuple:
    """Unique key for a result: (date, winner, loser)."""
    return (result["date"], result["winner"], result["loser"])


def merge_weeks(existing_weeks: list, new_weeks: list) -> tuple[list, int]:
    """Merge new week/result data into existing weeks.

    Only adds results that don't already exist (by date+winner+loser key).
    Returns (merged_weeks, count_of_new_results_added).
    """
    # Index existing results for fast lookup
    existing_results = set()
    week_map = {}
    for week in existing_weeks:
        week_num = week["week"]
        week_map[week_num] = week
        for result in week["results"]:
            existing_results.add(_result_key(result))

    added = 0
    for new_week in new_weeks:
        week_num = new_week["week"]
        if week_num not in week_map:
            # Entirely new week
            week_map[week_num] = {"week": week_num, "results": []}

        for result in new_week["results"]:
            key = _result_key(result)
            if key not in existing_results:
                week_map[week_num]["results"].append(result)
                existing_results.add(key)
                added += 1

    # Sort weeks by number, results within each week by date
    merged = []
    for week_num in sorted(week_map.keys()):
        week = week_map[week_num]
        week["results"] = sorted(week["results"], key=lambda r: r["date"])
        merged.append(week)

    return merged, added


def save_season(data_dir: Path, season_data: dict):
    """Write season data to JSON file."""
    path = data_dir / f"{season_data['season']}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(season_data, f, indent=2, ensure_ascii=False)
        f.write("\n")
