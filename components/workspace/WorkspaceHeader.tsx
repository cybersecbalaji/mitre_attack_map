"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlatformFilter } from "./PlatformFilter"
import { DataSourceFilter } from "./DataSourceFilter"
import { ATTACKTechnique, MatrixType, MatrixView } from "@/types"

interface WorkspaceHeaderProps {
  workspaceName: string
  onNameChange: (name: string) => void
  platformFilter: string[]
  onPlatformFilterChange: (platforms: string[]) => void
  dataSourceFilter: string[]
  onDataSourceFilterChange: (ids: string[]) => void
  allTechniques: ATTACKTechnique[]
  onExport: () => void
  onShare: () => void
  onSaveSnapshot: () => void
  shareCopied?: boolean
  saving?: boolean
  isShared?: boolean
  matrixType?: MatrixType
  onMatrixTypeChange?: (type: MatrixType) => void
  view?: MatrixView
  onViewChange?: (view: MatrixView) => void
  userEmail?: string
  onSignOut?: () => void
}

export function WorkspaceHeader({
  workspaceName,
  onNameChange,
  platformFilter,
  onPlatformFilterChange,
  dataSourceFilter,
  onDataSourceFilterChange,
  allTechniques,
  onExport,
  onShare,
  onSaveSnapshot,
  shareCopied,
  saving,
  isShared,
  matrixType = "attack",
  onMatrixTypeChange,
  view = "coverage",
  onViewChange,
  userEmail,
  onSignOut,
}: WorkspaceHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(workspaceName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(workspaceName)
  }, [workspaceName])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function commitEdit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== workspaceName) onNameChange(trimmed)
    setEditing(false)
  }

  return (
    <header
      className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700"
      data-testid="workspace-header"
    >
      <div className="flex items-center gap-3">
        <span className="text-teal-400 font-bold text-sm tracking-wide">ATT&CK Coverage</span>

        {/* Matrix type switcher */}
        {onMatrixTypeChange && (
          <div className="flex items-center bg-slate-800 rounded border border-slate-700 text-xs overflow-hidden">
            <button
              onClick={() => onMatrixTypeChange("attack")}
              className={`px-2 py-1 transition-colors ${
                matrixType === "attack"
                  ? "bg-teal-700 text-teal-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              data-testid="matrix-type-attack"
            >
              ATT&CK
            </button>
            <button
              onClick={() => onMatrixTypeChange("atlas")}
              className={`px-2 py-1 transition-colors ${
                matrixType === "atlas"
                  ? "bg-teal-700 text-teal-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              data-testid="matrix-type-atlas"
            >
              ATLAS
            </button>
          </div>
        )}

        {/* View switcher: Coverage | Density */}
        {onViewChange && (
          <div className="flex items-center bg-slate-800 rounded border border-slate-700 text-xs overflow-hidden">
            <button
              onClick={() => onViewChange("coverage")}
              className={`px-2 py-1 transition-colors ${
                view === "coverage"
                  ? "bg-slate-600 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              data-testid="view-coverage"
            >
              Coverage
            </button>
            <button
              onClick={() => onViewChange("density")}
              className={`px-2 py-1 transition-colors ${
                view === "density"
                  ? "bg-slate-600 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              data-testid="view-density"
            >
              Density
            </button>
          </div>
        )}

        {editing ? (
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 100))}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit()
              if (e.key === "Escape") { setDraft(workspaceName); setEditing(false) }
            }}
            className="h-7 text-sm bg-slate-800 border-slate-600 text-slate-200 max-w-xs"
            data-testid="workspace-name-input"
          />
        ) : (
          <button
            onClick={() => !isShared && setEditing(true)}
            className={`text-slate-300 text-sm rounded px-1 ${isShared ? "cursor-default" : "hover:bg-slate-800 hover:text-slate-100"}`}
            disabled={isShared}
            data-testid="workspace-name-display"
            title={isShared ? "Shared workspaces are read-only" : "Click to rename"}
          >
            {workspaceName}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {userEmail && (
          <span className="text-slate-500 text-xs hidden sm:inline truncate max-w-[160px]">
            {userEmail}
          </span>
        )}
        <PlatformFilter selected={platformFilter} onChange={onPlatformFilterChange} />
        {matrixType === "attack" && (
          <DataSourceFilter
            techniques={allTechniques}
            selected={dataSourceFilter}
            onChange={onDataSourceFilterChange}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveSnapshot}
          disabled={saving}
          className="text-xs border-slate-600 h-8"
          data-testid="save-button"
        >
          {saving ? "Saving..." : "Save snapshot"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="text-xs border-slate-600 h-8"
          data-testid="export-button"
        >
          Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onShare}
          className="text-xs border-slate-600 h-8 relative"
          data-testid="share-button"
        >
          {shareCopied ? "✓ Copied" : "Share"}
        </Button>
        {onSignOut && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="text-xs text-slate-400 hover:text-slate-100 h-8"
            data-testid="sign-out-button"
          >
            Sign out
          </Button>
        )}
      </div>
    </header>
  )
}
