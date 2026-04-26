import Link from "next/link"

// Deterministic demo matrix: 8 tactics x 9 rows
// c=covered  p=partial  u=uncovered
const DEMO = [
  ["c","u","p","u","c","u","p","c"],
  ["u","c","u","c","u","p","c","u"],
  ["p","u","c","p","u","c","u","p"],
  ["c","p","u","c","p","u","c","u"],
  ["u","c","c","u","c","u","p","c"],
  ["p","u","u","p","u","c","u","p"],
  ["c","c","p","u","p","u","c","u"],
  ["u","p","c","c","u","p","u","c"],
  ["c","u","u","p","c","c","u","p"],
]

const DEMO_TACTICS = ["RE","RD","IA","EX","PE","DA","LM","IM"]

const CELL_COLORS = {
  c: "bg-teal-700",
  p: "bg-amber-600/80",
  u: "bg-slate-800",
}

const FEATURES = [
  {
    label: "Always current data",
    body: "ATT&CK and ATLAS data come straight from the MITRE GitHub repos each time you open the tool. You get the latest techniques without any manual updates.",
  },
  {
    label: "Sigma-native parsing",
    body: "The tool reads attack.t1059.001 and atlas.aml.t0000 tags directly. For rules without explicit tags, it scans for T-codes and AML codes, then falls back to keyword matching against technique names.",
  },
  {
    label: "ATT&CK and ATLAS together",
    body: "Switch between MITRE ATT&CK Enterprise and MITRE ATLAS in one workspace. Both frameworks share the same ingestion pipeline, so you upload your rules once and check coverage for both.",
  },
  {
    label: "Navigator Layer export",
    body: "The export button generates a v4.5 Layer JSON that opens directly in the official MITRE Navigator. Covered techniques get a score of 100, fuzzy matches get 50.",
  },
  {
    label: "Runs in your browser",
    body: "There is no server. Your rules and detections stay on your machine. If you want to sync across devices or share a link with your team, you can connect an InstantDB app.",
  },
  {
    label: "Workspace snapshots",
    body: "Save your coverage state at any point and come back to it later. With InstantDB configured, snapshots sync across devices and each workspace gets a shareable URL.",
  },
]

const STEPS = [
  {
    n: "01",
    title: "Upload your detections",
    detail: "Drop in a Sigma YAML file or ZIP, paste a plain-text list of rule names or T-codes, or pick techniques manually from the full ATT&CK and ATLAS catalogue.",
  },
  {
    n: "02",
    title: "See your coverage",
    detail: "Covered techniques turn green. Fuzzy-matched ones turn amber. Blind spots stay grey. Use the platform filter to focus on Windows, Linux, cloud, or ML-model coverage.",
  },
  {
    n: "03",
    title: "Export and share",
    detail: "Download a Navigator Layer JSON and load it in the MITRE Navigator. Save a snapshot and send the URL to your team.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <span className="text-teal-500 font-mono text-sm tracking-widest uppercase font-semibold">
          ATT&CK Coverage
        </span>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/mitre-attack/attack-navigator"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 text-sm hover:text-slate-200 transition-colors"
          >
            Navigator
          </a>
          <a
            href="https://attack.mitre.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 text-sm hover:text-slate-200 transition-colors"
          >
            ATT&CK
          </a>
          <Link
            href="/app"
            className="bg-teal-700 hover:bg-teal-600 text-white text-sm px-4 py-1.5 rounded transition-colors font-medium"
          >
            Launch app
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div>
          <p className="text-teal-500 font-mono text-xs tracking-widest uppercase mb-4">
            Detection coverage, automated
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-50 leading-tight tracking-tight mb-6">
            Know exactly what<br />you can detect.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
            Upload your Sigma rules or paste a detection list. The tool maps every technique
            across ATT&CK Enterprise and MITRE ATLAS automatically. You get a colour-coded
            matrix in seconds, with zero manual T-code work.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className="bg-teal-700 hover:bg-teal-600 text-white text-sm px-6 py-3 rounded font-medium transition-colors"
            >
              Launch app
            </Link>
            <a
              href="https://github.com/mitre-attack/attack-stix-data"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-200 text-sm transition-colors border border-slate-700 hover:border-slate-500 px-6 py-3 rounded"
            >
              Data source
            </a>
          </div>

          {/* Coverage legend */}
          <div className="flex items-center gap-5 mt-10 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-teal-700 inline-block" />
              covered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-600 inline-block" />
              partial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-700 inline-block" />
              uncovered
            </span>
          </div>
        </div>

        {/* Right: mini matrix preview */}
        <div className="hidden lg:flex flex-col gap-1.5 select-none" aria-hidden>
          {/* Tactic headers */}
          <div className="flex gap-1.5">
            {DEMO_TACTICS.map((t) => (
              <div
                key={t}
                className="flex-1 bg-slate-800 rounded-sm py-1 text-center font-mono text-[10px] text-teal-400 tracking-widest uppercase"
              >
                {t}
              </div>
            ))}
          </div>
          {/* Technique rows */}
          {DEMO.map((row, ri) => (
            <div key={ri} className="flex gap-1.5">
              {row.map((cell, ci) => (
                <div
                  key={ci}
                  className={`flex-1 h-7 rounded-sm ${CELL_COLORS[cell as keyof typeof CELL_COLORS]}`}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-slate-300 text-xs font-mono tracking-widest uppercase mb-12">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="text-teal-600 font-mono text-4xl font-bold mb-4 leading-none">
                {s.n}
              </div>
              <h3 className="text-slate-100 font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-slate-300 text-xs font-mono tracking-widest uppercase mb-12">
          Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="border border-slate-800 rounded p-6"
            >
              <h3 className="text-teal-400 font-mono text-sm tracking-wide mb-3">
                {f.label}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Supported formats */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-slate-300 text-xs font-mono tracking-widest uppercase mb-10">
          Supported input formats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-w-3xl">
          {[
            ["Sigma YAML", "tags: [attack.t1059.001, atlas.aml.t0043]"],
            ["Sigma ZIP", "Bulk upload, recursively parsed"],
            ["Plain text", "T1059 - PowerShell rule  /  AML.T0043"],
            ["Manual", "Searchable dropdown of all techniques"],
          ].map(([fmt, example]) => (
            <div key={fmt} className="flex items-start gap-4 py-4 border-b border-slate-800 last:border-0">
              <div className="w-28 flex-shrink-0 text-slate-300 text-sm font-medium">{fmt}</div>
              <div className="text-slate-500 font-mono text-xs">{example}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Tech stack */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-slate-300 text-xs font-mono tracking-widest uppercase mb-8">
          Stack
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            "Next.js 14",
            "TypeScript",
            "Tailwind CSS",
            "shadcn/ui",
            "InstantDB",
            "js-yaml",
            "JSZip",
            "Playwright",
          ].map((t) => (
            <span
              key={t}
              className="border border-slate-700 text-slate-400 font-mono text-xs px-3 py-1 rounded"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-600">
          <span>Apache 2.0</span>
          <div className="flex items-center gap-6">
            <a
              href="https://attack.mitre.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-400 transition-colors"
            >
              MITRE ATT&CK
            </a>
            <a
              href="https://atlas.mitre.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-400 transition-colors"
            >
              MITRE ATLAS
            </a>
            <Link href="/app" className="hover:text-slate-400 transition-colors">
              Launch app
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
