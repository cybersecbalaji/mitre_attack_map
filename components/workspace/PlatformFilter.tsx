"use client"
import { AVAILABLE_PLATFORMS } from "@/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

interface PlatformFilterProps {
  selected: string[]
  onChange: (selected: string[]) => void
}

export function PlatformFilter({ selected, onChange }: PlatformFilterProps) {
  const togglePlatform = (platform: string) => {
    if (selected.includes(platform)) {
      onChange(selected.filter((p) => p !== platform))
    } else {
      onChange([...selected, platform])
    }
  }

  const clearAll = () => onChange([])

  const label =
    selected.length === 0
      ? "All platforms"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} platforms`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-slate-600 h-8 px-2 gap-1.5"
          data-testid="platform-filter-trigger"
        >
          <span className="text-slate-400">Platform:</span>
          <span className="text-slate-200">{label}</span>
          <span className="text-slate-500 text-[10px]">▾</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-slate-800 border-slate-600 text-slate-200 w-56"
        data-testid="platform-filter-menu"
      >
        <DropdownMenuLabel className="text-slate-400 text-xs">
          Filter by platform
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />
        {AVAILABLE_PLATFORMS.map((platform) => (
          <DropdownMenuCheckboxItem
            key={platform}
            checked={selected.includes(platform)}
            onCheckedChange={() => togglePlatform(platform)}
            onSelect={(e) => e.preventDefault()}
            className="text-xs hover:bg-slate-700 focus:bg-slate-700"
            data-testid={`platform-option-${platform.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {platform}
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-slate-700" />
            <button
              onClick={clearAll}
              className="w-full text-left px-2 py-1.5 text-xs text-red-400 hover:bg-slate-700 rounded-sm"
              data-testid="platform-filter-clear"
            >
              Clear all
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
