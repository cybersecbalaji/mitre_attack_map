# Deployment Notes

## Vercel — Fixing Shared Workspace URLs (Deployment Protection)

By default Vercel enables **Deployment Protection** on all `*.vercel.app` URLs. This means anyone who clicks a shared workspace link (`/app?ws=<uuid>`) is redirected to a Vercel SSO login wall instead of the app.

**How to disable it:**

1. Go to [vercel.com](https://vercel.com) and open your project (`mitre_attack_map`).
2. Navigate to **Settings → Deployment Protection**.
3. Set **Vercel Authentication** to **Disabled** (makes all deployments public) or **Only Preview Deployments** (production public, previews protected).
4. Click **Save**. The change takes effect immediately — no redeploy needed.
5. Test by opening a share URL like `https://<project>.vercel.app/app?ws=<uuid>` in a private/incognito window.

**Alternative:** Attach a custom domain. Custom domains (`coverage.example.com`) are never subject to Vercel Authentication, regardless of the setting.

## Environment Variables

Set these in Vercel → Settings → Environment Variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_INSTANTDB_APP_ID` | Your InstantDB app ID (optional — enables auth and sync) |

Without `NEXT_PUBLIC_INSTANTDB_APP_ID`, the app works fully in local-only mode (no auth, no cross-device sync).

## Build

The project uses Next.js 14 with the App Router. Vercel auto-detects this and uses the **Next.js** preset.

- Framework: **Next.js**
- Build command: `next build` (Vercel default)
- Output directory: `.next` (Vercel default)
- Install command: `npm install` (Vercel default)
