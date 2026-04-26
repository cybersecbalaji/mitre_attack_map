# ATT&CK Coverage Heatmap Builder

Browser-based tool that visualises your MITRE ATT&CK Enterprise coverage from Sigma rules and detection lists — no backend, no signup, no manual T-code tagging.

> **Why it exists**: every detection team has the same question — *"What can we actually detect right now, and where are our biggest blind spots?"* — but nobody has time to manually paint a Navigator layer for 200 Sigma rules.

## Live demo

> _Add the Vercel URL here once deployed._

## Quick start

```bash
git clone <this-repo>
cd attack-coverage-heatmap
npm install
cp .env.local.example .env.local   # optional — see Persistence below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to use

1. **Upload your detections** in the left panel — choose Sigma YAML/ZIP, paste a plain-text rule list, or pick techniques manually.
2. **See the heatmap** — covered techniques turn green, fuzzy-matched ones turn amber, blind spots stay grey.
3. **Export** to a Navigator Layer JSON and import it into [https://mitre-attack.github.io/attack-navigator/](https://mitre-attack.github.io/attack-navigator/) for sharing.

## Supported input formats

| Format        | Example                                                                                  |
|---------------|------------------------------------------------------------------------------------------|
| Sigma YAML    | `tags: [attack.t1059.001]` — primary mapping mechanism                                   |
| Sigma ZIP     | Upload a zip of `.yml` files; recursively parsed                                         |
| Plain text    | One rule per line: `T1059.003 - PowerShell` / `T1078, Valid Accounts` / `Detect LSASS`   |
| Manual entry  | Searchable dropdown of all ATT&CK techniques                                             |

Rules without explicit ATT&CK tags fall back to T-code regex scanning, then fuzzy keyword matching against technique names. Anything that can't be mapped is surfaced in a "skipped" list — never silently dropped.

## Coverage colour key

| Colour | Meaning                                                              |
|--------|----------------------------------------------------------------------|
| 🟢 Green  | Covered (strong) — at least one rule with a direct ATT&CK tag      |
| 🟠 Amber  | Partial — rule mapped via fuzzy/keyword match only                 |
| ⬜ Grey   | Not covered — no rule maps to this technique                       |

## Navigator export

The export button generates a valid [Navigator Layer v4.5](https://github.com/mitre-attack/attack-navigator/blob/master/layers/LAYERFORMATv4_5.md) JSON file you can drop directly into the official MITRE Navigator. Strong-coverage techniques get score `100`, partial coverage gets `50`, uncovered are omitted (rendered as unscored). Rule names are joined into each technique's `comment` field.

## Persistence (optional)

The app works fully offline using only `localStorage` for workspace and snapshot storage. To enable cross-machine sync and shareable links:

1. Create a free app at [InstantDB](https://instantdb.com/dash).
2. Set `NEXT_PUBLIC_INSTANTDB_APP_ID=<your-app-id>` in `.env.local`.
3. Restart `npm run dev`.

Workspace state is identified by a UUID stored in `localStorage` (no auth). Share links use `?ws=<uuid>` URL parameters and only sync when InstantDB is configured.

## Tech stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Persistence**: InstantDB (optional) + localStorage fallback
- **ATT&CK source**: Live STIX JSON from `mitre-attack/attack-stix-data` GitHub repo (~50MB, cached client-side for 24h)
- **Deployment**: Vercel-ready, no backend server needed

## Development

```bash
npm run dev          # dev server on port 3000
npm run build        # production build
npm run test:unit    # Jest unit tests (lib + hooks)
npm run test:e2e     # Playwright browser tests (requires no internet — all fixtures mocked)
```

The project ships with **103 tests** (71 unit + 32+ Playwright) covering parsers, coverage calculation, matrix rendering, ingestion flows, persistence, exports, and OWASP Top 10 surface area (XSS via STIX/rule names/URL params, YAML `!!js/function` injection, oversized payload DoS, prototype pollution).

## Deployment

1. Push to GitHub.
2. Import to [vercel.com/new](https://vercel.com/new).
3. (Optional) Set `NEXT_PUBLIC_INSTANTDB_APP_ID` in the Vercel env vars.
4. Deploy.

## Contributing

Issues and PRs welcome. Please run `npm run test:unit` and `npm run test:e2e` before submitting.

## License

Apache 2.0 — see [LICENSE](LICENSE).
