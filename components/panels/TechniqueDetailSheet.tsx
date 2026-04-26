"use client"
import { ATTACKTechnique, CoverageCell, COVERAGE_COLORS } from "@/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TechniqueDetailSheetProps {
  technique: ATTACKTechnique | null
  coverageCell?: CoverageCell
  open: boolean
  onClose: () => void
  tacticNames?: Record<string, string>
}

export function TechniqueDetailSheet({ open, onClose, technique, coverageCell, tacticNames }: TechniqueDetailSheetProps) {
  const status = coverageCell?.status ?? "uncovered"
  const statusColor = COVERAGE_COLORS[status]
  const statusLabel = status === "covered" ? "Covered" : status === "partial" ? "Partial" : "Not covered"

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="bg-slate-900 border-slate-700 w-[440px] sm:max-w-[440px] text-slate-200 overflow-hidden flex flex-col p-0"
        data-testid="technique-detail-sheet"
      >
        {technique ? (
          <>
            <SheetHeader className="p-4 border-b border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded text-slate-100"
                  style={{ backgroundColor: statusColor }}
                  data-testid="technique-status-badge"
                >
                  {statusLabel}
                </span>
                {technique.isSubtechnique && (
                  <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300">
                    Sub-technique
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-slate-100 text-base leading-tight">
                <span className="font-mono text-teal-400 mr-2">{technique.id}</span>
                {technique.name}
              </SheetTitle>
              <SheetDescription className="text-slate-400 text-xs">
                {technique.tactics.map((t) => (
                  <span key={t} className="mr-2 inline-block">
                    <span className="text-slate-500">▸</span>{" "}
                    {tacticNames?.[t] ?? t}
                  </span>
                ))}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-4">
                {/* Description */}
                <section>
                  <h3 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                    Description
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {technique.description || "No description available from STIX."}
                  </p>
                </section>

                {/* Platforms */}
                <section>
                  <h3 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                    Platforms
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {technique.platforms.length > 0 ? (
                      technique.platforms.map((p) => (
                        <Badge
                          key={p}
                          variant="outline"
                          className="border-slate-600 text-slate-300 text-[10px] py-0 h-5"
                        >
                          {p}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-500 text-xs italic">None listed</span>
                    )}
                  </div>
                </section>

                {/* Mapped rules */}
                <section data-testid="detail-mapped-rules">
                  <h3 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                    Mapped rules{coverageCell ? ` (${coverageCell.rules.length})` : " (0)"}
                  </h3>
                  {coverageCell && coverageCell.rules.length > 0 ? (
                    <ul className="space-y-1.5">
                      {coverageCell.rules.map((r) => (
                        <li
                          key={r.id}
                          className="bg-slate-800/60 border border-slate-700 rounded p-2"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                r.confidence === "strong" ? "bg-green-500" : "bg-amber-500"
                              }`}
                            />
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                              {r.source}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {r.confidence}
                            </span>
                          </div>
                          <div className="text-xs text-slate-200 break-words">{r.name}</div>
                          {r.techniqueIds.length > 1 && (
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                              {r.techniqueIds.join(", ")}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500 text-xs italic">
                      No detection rules cover this technique yet.
                    </p>
                  )}
                </section>

                {/* Mitigations */}
                <section data-testid="detail-mitigations">
                  <h3 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                    Mitigations{technique.mitigations.length > 0 ? ` (${technique.mitigations.length})` : ""}
                  </h3>
                  {technique.mitigations.length > 0 ? (
                    <ul className="space-y-1.5">
                      {technique.mitigations.map((m) => (
                        <li
                          key={m.id}
                          className="bg-slate-800/60 border border-slate-700 rounded p-2"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-teal-400 text-[10px]">{m.id}</span>
                          </div>
                          <div className="text-xs text-slate-200 font-medium">{m.name}</div>
                          {m.description && (
                            <div className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                              {m.description}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500 text-xs italic">
                      No mitigations listed for this technique.
                    </p>
                  )}
                </section>

                {/* Sub-techniques summary */}
                {technique.subtechniques.length > 0 && (
                  <section>
                    <h3 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                      Sub-techniques ({technique.subtechniques.length})
                    </h3>
                    <ul className="space-y-0.5">
                      {technique.subtechniques.map((s) => (
                        <li key={s.id} className="text-[11px] text-slate-300">
                          <span className="font-mono text-teal-400 mr-1.5">{s.id}</span>
                          {s.name}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Link to ATT&CK or ATLAS */}
                <section className="pt-2 border-t border-slate-700">
                  <a
                    href={technique.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:text-teal-300 text-xs underline"
                    data-testid="attack-link"
                  >
                    {technique.id.startsWith("AML.")
                      ? "View on atlas.mitre.org →"
                      : "View on attack.mitre.org →"}
                  </a>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : (
          <SheetHeader className="p-4">
            <SheetTitle className="text-slate-300">Select a technique</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  )
}
