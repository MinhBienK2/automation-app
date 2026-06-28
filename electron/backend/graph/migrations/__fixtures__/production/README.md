# Production Graph Fixtures

This directory holds anonymized exports from real `database.sqlite` files.
Tests in `migrations/index.test.ts` will load each fixture, run migrations,
and assert the result has no `failed` entry.

## Adding fixtures

1. Export anonymized graph JSON from a real database.
2. Replace all URLs with `https://example.test/...`
3. Replace selectors with hashed values
4. Scrub variable values
5. Save as `<descriptive-name>.json` in this directory

A CLI export tool (`scripts/export-graph-fixtures.ts`) is planned as a
separate follow-up task.

When this directory is empty, the fixture test is automatically skipped.
