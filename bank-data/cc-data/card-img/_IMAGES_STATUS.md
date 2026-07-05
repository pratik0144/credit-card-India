# Card images — status

**Format:** every image is a constant **600×380 PNG**, white background, card art centered (uniform for website display).
**Naming:** `NNN_<bankid>_<Card-Name>.png` where NNN is the spreadsheet data-row number (Sheet1 row − 1).
**Spreadsheet:** `axisfinaldone18jun2026.xlsx` → column `card_img` holds `card-img/<filename>.png` for all 368 cards
(verified: 368/368 rows map to an existing file, 0 missing, 0 malformed).

## Coverage (368 total) — COMPLETE
- **367 real** card images, downloaded from official bank CDNs / aggregators and normalized to the constant format.
- **1 placeholder** (same 600×380 format): `021_hdfc_Lifestyle-Credit-Card.png` — "HDFC Lifestyle" is a marketing
  category, not a distinct issued card with its own art, so no real image exists. Clean branded placeholder used.

## Pipelines (all idempotent; real images cached via scratch/markers/<num>.real)
- `scratch/build_images.py`  — download candidate URLs + normalize to 600×380 PNG (only rebuilds placeholders; `--force` rebuilds all).
- `scratch/harvest_og.py`    — scrape og:image from official card pages (no model tokens).
- `scratch/bankbazaar_harvest.py` — aggregator fuzzy-match (no model tokens).
- Candidate image URLs per card: `scratch/img_urls/<bank>.json` ({num, card_name, image_urls[], source, note}).

To refresh any card's image: edit its entry in the relevant `scratch/img_urls/<bank>.json`, delete
`scratch/markers/<num>.real`, then run `python3 scratch/build_images.py`. Filenames are stable, so the
spreadsheet needs no re-wiring.
