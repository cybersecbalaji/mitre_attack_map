# ATT&CK Coverage Heatmap Builder — Claude Code Rules

## Non-negotiable constraints (NEVER violate these)

- STIX data fetched live from: `https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json`
- Never hardcode the technique list — always parse from STIX JSON
- Matrix rendered as custom CSS Grid — no ATT&CK Navigator iframe
- Exported Navigator Layer JSON must validate against v4.5 spec
- InstantDB app ID from environment variable `NEXT_PUBLIC_INSTANTDB_APP_ID` only — never hardcoded
- Dark mode only: slate-900 background, teal-600 accent color
- No backend server — Vercel + InstantDB only (pure client-side logic)
- All logic runs in browser — no Next.js API routes unless explicitly required

## Build phase sequence

Complete and verify each phase before moving to the next. Run all tests before advancing.

### Phase 1 — Scaffold ✅
- Next.js 14 App Router + TypeScript + Tailwind CSS
- shadcn/ui configured
- InstantDB schema set up
- TypeScript types created (types/index.ts)
- File structure created

### Phase 2 — ATT&CK Data Layer
- lib/attackStix.ts: fetch + parse STIX JSON
- hooks/useAttackData.ts: fetch on mount, cache in state
- Debug output showing technique count

### Phase 3 — Matrix Renderer
- AttackMatrix, TacticColumn, TechniqueCell, SubtechniqueCell components
- Full 14-column Enterprise matrix rendering
- Hover tooltips, click handlers, KPI bar

### Phase 4 — Rule Ingestion + Coverage
- sigmaParser.ts, ruleIngestion.ts, fuzzyMatch.ts, coverageCalculator.ts
- IngestionPanel with 3 tabs
- Matrix cells update color on rule apply

### Phase 5 — Technique Detail + Platform Filter
- TechniqueDetailSheet slide-over panel
- Platform filter dropdown
- KPI stats recalculate on filter change

### Phase 6 — Workspace + InstantDB Persistence
- useWorkspace.ts, WorkspaceHeader, WorkspaceHistory, ShareBanner
- UUID localStorage persistence, InstantDB save/load
- Share URL with ?ws= param

### Phase 7 — Navigator Export + Polish
- navigatorExport.ts: generate v4.5 Navigator Layer JSON
- Export button triggers browser download
- README.md

## Testing requirements (every phase)

- Write tests before completing a phase
- Run Playwright browser tests for all UI phases (3-7)
- Run OWASP Top 10 security checks before each phase commit
- Tests must pass before moving to next phase

## ATT&CK Tactic order (hardcoded for column rendering)

```
reconnaissance, resource-development, initial-access, execution,
persistence, privilege-escalation, defense-evasion, credential-access,
discovery, lateral-movement, collection, command-and-control, exfiltration, impact
```

## Coverage cell colors

- Covered (strong): #22c55e (green-500) — direct T-code match
- Covered (partial): #f59e0b (amber-500) — fuzzy/inferred match
- Not covered: #1e293b (slate-800)
- Highlighted gap: #ef4444 (red-500)

## Security rules

- Sanitize all user inputs (Sigma YAML, plain text, CSV)
- Never eval() or execute any parsed content
- CSP headers on all pages
- No XSS vectors in technique name/description rendering — use textContent, not innerHTML
- Rate-limit file parsing (reject files >10MB)
- YAML parsing with js-yaml safeLoad (prevent billion laughs etc.)

## Code style

- TypeScript strict mode
- No `any` types — use proper interfaces
- Comments only when WHY is non-obvious
- No unused variables or imports
- All async operations have error handling
