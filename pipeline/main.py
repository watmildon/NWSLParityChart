#!/usr/bin/env python3
"""NWSL Parity Chart data pipeline.

Fetches match results from the American Soccer Analysis API
and updates the season data files in docs/data/.
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

from fetch_asa import fetch_season
from transform import transform_games
from update import load_existing, merge_weeks, save_season

DATA_DIR = Path(__file__).resolve().parent.parent / "docs" / "data"


def current_nwsl_season() -> int:
    """NWSL seasons run ~March-November, so current year is the season."""
    return datetime.now().year


def run_pipeline(season: int, dry_run: bool = False) -> bool:
    """Run the pipeline for a single season.

    Returns True if new results were added.
    """
    print(f"=== NWSL Data Pipeline — {season} season ===")

    # 1. Fetch from ASA API
    print("Fetching from American Soccer Analysis API...")
    team_map, games = fetch_season(season)
    print(f"  Fetched {len(games)} game records from ASA")

    # 2. Transform to our format
    new_weeks = transform_games(team_map, games)
    total_results = sum(len(w["results"]) for w in new_weeks)
    print(f"  Transformed into {len(new_weeks)} weeks, {total_results} decisive results")

    if total_results == 0:
        print("  No decisive results found. Season may not have started yet.")
        return False

    # 3. Load existing data
    existing = load_existing(DATA_DIR, season)
    if existing is None:
        print(f"  No existing data file for {season}. Cannot create — "
              "teams metadata must be set up manually.")
        print(f"  Create docs/data/{season}.json with teams array first.")
        return False

    # 4. Merge
    merged_weeks, added = merge_weeks(existing.get("weeks", []), new_weeks)

    if added == 0:
        print("  No new results to add. Data is up to date.")
        return False

    print(f"  Found {added} new result(s) to add")

    if dry_run:
        print("  [DRY RUN] Would update file but skipping.")
        return True

    # 5. Save
    existing["weeks"] = merged_weeks
    # Clear precomputed parity result — the site recalculates on load
    existing.pop("parityResult", None)
    save_season(DATA_DIR, existing)
    print(f"  Updated docs/data/{season}.json")

    return True


def main():
    parser = argparse.ArgumentParser(description="NWSL Parity Chart data pipeline")
    parser.add_argument(
        "--season",
        type=int,
        default=current_nwsl_season(),
        help="Season year to update (default: current year)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and compare but don't write changes",
    )
    args = parser.parse_args()

    updated = run_pipeline(args.season, dry_run=args.dry_run)

    if updated:
        print("\nPipeline complete — new data added.")
    else:
        print("\nPipeline complete — no changes needed.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
