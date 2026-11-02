"""Compare application schema against a restored D1 backup without reading rows."""

import argparse
import json
import re
import sqlite3
from pathlib import Path


def check_constraints(sql):
    """Extract balanced CHECK expressions, preserving string literals."""
    expressions = []
    for match in re.finditer(r"\bCHECK\s*\(", sql, re.IGNORECASE):
        start = match.end()
        depth, quoted, i = 1, False, start
        while i < len(sql) and depth:
            char = sql[i]
            if char == "'":
                if quoted and i + 1 < len(sql) and sql[i + 1] == "'":
                    i += 2
                    continue
                quoted = not quoted
            elif not quoted:
                depth += (char == "(") - (char == ")")
            i += 1
        if depth:
            raise ValueError("Unbalanced CHECK expression")
        expressions.append(re.sub(r"\s+", "", sql[start:i - 1]))
    return sorted(expressions)


def schema(connection):
    result = {}
    for name, sql in connection.execute(
        "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
    ):
        if name == "d1_migrations" or name.startswith(("sqlite_", "_cf_")):
            continue
        identifier = '"' + name.replace('"', '""') + '"'
        indexes = []
        for _, index_name, unique, origin, partial in connection.execute(
            f"PRAGMA index_list({identifier})"
        ):
            if origin == "pk":
                continue
            index_identifier = '"' + index_name.replace('"', '""') + '"'
            columns = [row[2] for row in connection.execute(
                f"PRAGMA index_info({index_identifier})"
            )]
            indexes.append([index_name, unique, partial, columns])
        result[name] = {
            # Existing ALTER TABLE operations can change column order.
            "columns": sorted(list(row[1:]) for row in connection.execute(
                f"PRAGMA table_info({identifier})"
            )),
            "foreign_keys": sorted(list(row[2:]) for row in connection.execute(
                f"PRAGMA foreign_key_list({identifier})"
            )),
            "indexes": sorted(indexes),
            "checks": check_constraints(sql),
        }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, type=Path)
    options = parser.parse_args()
    backup = options.database.resolve(strict=True)
    root = Path(__file__).resolve().parents[1]
    with sqlite3.connect(":memory:") as local:
        for migration in ["0001_initial_schema.sql", "0002_question_retirements.sql"]:
            local.executescript((root / "migrations" / migration).read_text())
        local.executescript((root / "migrations/0002_question_retirements.sql").read_text())
        expected = schema(local)
    with sqlite3.connect(backup.as_uri() + "?mode=ro", uri=True) as production:
        actual = schema(production)
    report = {"match": expected == actual, "local": expected, "backup": actual}
    artifacts = root / ".test-artifacts"
    artifacts.mkdir(exist_ok=True)
    (artifacts / "schema-parity.json").write_text(json.dumps(report, indent=2) + "\n")
    if expected != actual:
        raise SystemExit("Application schema differs; see .test-artifacts/schema-parity.json")
    print(f"APPLICATION_SCHEMA_IDENTICAL {len(expected)} tables; backup opened read-only")


if __name__ == "__main__":
    main()
