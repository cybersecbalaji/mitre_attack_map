"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { db, isInstantDBConfigured } from "@/lib/instantdb"

interface AuthGuardProps {
  children: React.ReactNode
}

function AuthGuardInner({ children }: AuthGuardProps) {
  const router = useRouter()
  const { isLoading, user } = db.useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login")
    }
  }, [isLoading, user, router])

  // Render children optimistically while auth is resolving.
  // The useEffect above redirects to /login once auth definitively returns no user.
  // This avoids a loading-spinner flash on hot reload and keeps tests unblocked.
  if (!isLoading && !user) return null

  return <>{children}</>
}

export function AuthGuard({ children }: AuthGuardProps) {
  if (!isInstantDBConfigured) {
    // InstantDB not configured — no auth required
    return <>{children}</>
  }
  return <AuthGuardInner>{children}</AuthGuardInner>
}
