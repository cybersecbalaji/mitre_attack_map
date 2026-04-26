# ATT&CK Coverage Heatmap Builder

Browser-based tool that visualises your MITRE ATT&CK Enterprise (and MITRE ATLAS) coverage from Sigma rules and detection lists — no backend, no signup, no manual T-code tagging.

> **Why it exists**: every detection team has the same question — *"What can we actually detect right now, and where are our biggest blind spots?"* — but nobody has time to manually paint a Navigator layer for 200 Sigma rules.

## Live app

**[https://mitre-attack-map.vercel.app](https://mitre-attack-map.vercel.app)**

## Quick start

```bash
git clone https://github.com/cybersecbalaji/mitre_attack_map
cd attack-coverage-heatmap
npm install
cp .env.local.example .env.local   # optional — see Persistence below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Features

### Detection ingestion

Upload your detections in the left panel — three formats supported:

| Format | Example |
|---|---|
| Sigma YAML / ZIP | `tags: [attack.t1059.001]` — primary mapping |
| Plain text | One rule per line: `T1059.003 - PowerShell` or `Detect LSASS` |
| Manual entry | Searchable dropdown of all ATT&CK techniques |

Rules without explicit ATT&CK tags fall back to T-code regex scanning, then fuzzy keyword matching. Anything unmappable is surfaced in a "skipped" list — never silently dropped.

### Coverage heatmap (default view)

| Colour | Meaning |
|---|---|
| Green | Covered — at least one rule with a direct ATT&CK tag |
| Amber | Partial — mapped via fuzzy/keyword match only |
| Grey | Not covered |

### Density heatmap (toggle: Coverage → Density)

Alternative matrix view that colours cells by **how many rules** cover each technique. Exposes over-reliance and thin coverage that the binary covered/uncovered view hides.

| Colour | Bucket |
|---|---|
| Slate | 0 rules (no coverage) |
| Teal-dark | 1 rule |
| Teal | 2–3 rules |
| Teal-light | 4–5 rules |
| Amber | 6+ rules (over-reliance warning) |

### ATT&CK + ATLAS matrix toggle

Switch between **MITRE ATT&CK Enterprise** and **MITRE ATLAS** (AI/ML adversary tactics) using the toggle in the header. Both matrices share the same ingestion and filtering pipeline.

### Platform filter

Filter the matrix to only show techniques relevant to your environment. Canonical MITRE platform names are used:

`Windows` · `macOS` · `Linux` · `IaaS` (covers AWS/Azure/GCP) · `SaaS` · `Office Suite` · `Identity Provider` · `PRE` · `Containers` · `Network Devices` · `ESXi`

Cross-platform techniques remain visible when their platform list overlaps the selected filter.

### Data source filter (ATT&CK mode only)

Filter the matrix by the **log and telemetry sources** required to detect each technique — the same filter the official ATT&CK Navigator exposes. The dropdown is populated dynamically from the loaded STIX data (e.g. Process Creation, Network Traffic, Active Directory).

The data source filter ANDs with the platform filter. Clearing either filter restores full visibility.

### Technique detail sheet

Click any technique cell to open a side sheet showing:

- **Full description** (from MITRE STIX)
- **Platform badges** and tactics
- **Coverage status** badge (Covered / Partial / Not covered)
- **Mapped rules** — the specific rules that cover this technique
- **Mitigations** — MITRE M-code controls (e.g. M1038, M1042) with descriptions
- **ATT&CK link** — opens the official technique page

### Navigator export

Generates a valid [Navigator Layer v4.5](https://github.com/mitre-attack/attack-navigator/blob/master/layers/LAYERFORMATv4_5.md) JSON file. Strong coverage → score `100`, partial → `50`, uncovered omitted. Rule names are joined into each technique's `comment` field.

### Workspace snapshots

Save point-in-time snapshots of your rule set and filters. Snapshots persist to **localStorage** (always) and to **InstantDB** (when configured), enabling cross-device access and shareable workspace links.

Active rules are **auto-saved** to localStorage keyed by workspace ID — they survive browser refresh and logout/login on the same device without needing an explicit snapshot.

### Shareable workspace links

Click **Share** to copy a `?ws=<uuid>` URL. Anyone with the link can view (but not modify) your workspace. Requires InstantDB to be configured; otherwise workspace state is local only.

---

## Persistence

The app works fully offline using only `localStorage`. To enable cross-device sync and shareable links:

1. Create a free app at [InstantDB](https://instantdb.com/dash).
2. Set `NEXT_PUBLIC_INSTANTDB_APP_ID=<your-app-id>` in `.env.local` (or Vercel env vars).
3. Restart the dev server (or redeploy).

Without InstantDB, the app runs in local-only mode — no auth, no cross-device sync, no share links.

---

## Tech stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **ATT&CK data**: Live STIX JSON from `mitre-attack/attack-stix-data` GitHub (~50 MB, cached 24h in localStorage)
- **ATLAS data**: Live YAML from `mitre-atlas/atlas-data` GitHub
- **Persistence**: InstantDB (optional) + localStorage fallback
- **Auth**: InstantDB email OTP (optional — bypassed when `NEXT_PUBLIC_INSTANTDB_APP_ID` is unset)
- **Deployment**: Vercel-ready, no backend server needed

---

## Development

```bash
npm run dev          # dev server on port 3000
npm run build        # production build
npm run test:unit    # Jest unit tests
npm run test:e2e     # Playwright browser tests (all fixtures mocked)
```

---

## Deployment (Vercel)

1. Push to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. (Optional) Add `NEXT_PUBLIC_INSTANTDB_APP_ID` in Vercel → Settings → Environment Variables.
4. Deploy.

**Sharing workspace links**: by default Vercel enables Deployment Protection on `*.vercel.app` URLs, which adds a Vercel SSO wall in front of share links. To disable it: Vercel dashboard → Settings → Deployment Protection → set **Vercel Authentication** to **Disabled**. See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
