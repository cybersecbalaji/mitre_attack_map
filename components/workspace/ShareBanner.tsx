"use client"
import { Button } from "@/components/ui/button"

interface ShareBannerProps {
  visible: boolean
  onSaveCopy: () => void
}

export function ShareBanner({ visible, onSaveCopy }: ShareBannerProps) {
  if (!visible) return null
  return (
    <div
      className="bg-amber-900/30 border-b border-amber-700/50 px-4 py-1.5 text-amber-200 text-xs flex items-center justify-between gap-3"
      data-testid="share-banner"
    >
      <div>
        <span className="font-semibold">📎 Viewing shared workspace —</span>{" "}
        <span className="text-amber-300/80">save a copy to edit.</span>
      </div>
      <Button
        size="sm"
        onClick={onSaveCopy}
        className="text-[11px] h-6 bg-amber-700 hover:bg-amber-600"
        data-testid="save-copy-button"
      >
        Save copy as new workspace
      </Button>
    </div>
  )
}
