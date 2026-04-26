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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}

export function AuthGuard({ children }: AuthGuardProps) {
  if (!isInstantDBConfigured) {
    // InstantDB not configured — no auth required
    return <>{children}</>
  }
  return <AuthGuardInner>{children}</AuthGuardInner>
}
