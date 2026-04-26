"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { db, isInstantDBConfigured } from "@/lib/instantdb"

function LoginForm() {
  const router = useRouter()
  const { user } = db.useAuth()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"email" | "code">("email")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) router.replace("/app")
  }, [user, router])

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      await db.auth.sendMagicCode({ email: email.trim() })
      setStep("code")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code. Check your email address.")
    } finally {
      setLoading(false)
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      await db.auth.signInWithMagicCode({ email: email.trim(), code: code.trim() })
      router.replace("/app")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="mb-10">
          <p className="text-teal-500 font-mono text-xs tracking-widest uppercase mb-2">
            ATT&CK Coverage
          </p>
          <h1 className="text-slate-100 text-2xl font-semibold tracking-tight">
            Sign in
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            We&apos;ll send a one-time code to your email.
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1.5" htmlFor="email">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600 h-10"
                data-testid="login-email-input"
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm" role="alert">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-teal-700 hover:bg-teal-600 text-white h-10"
              data-testid="login-send-code"
            >
              {loading ? "Sending..." : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={signIn} className="space-y-4">
            <p className="text-slate-400 text-sm">
              Code sent to <span className="text-slate-200">{email}</span>.
            </p>
            <div>
              <label className="block text-slate-300 text-sm mb-1.5" htmlFor="code">
                One-time code
              </label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                autoFocus
                inputMode="numeric"
                className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600 h-10 font-mono tracking-widest"
                data-testid="login-code-input"
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm" role="alert">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full bg-teal-700 hover:bg-teal-600 text-white h-10"
              data-testid="login-verify-code"
            >
              {loading ? "Verifying..." : "Sign in"}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(null) }}
              className="text-slate-500 text-xs hover:text-slate-300 w-full text-center"
            >
              Use a different email
            </button>
          </form>
        )}

        <p className="text-slate-600 text-xs mt-8 text-center">
          No account needed — your email is your identity.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  if (!isInstantDBConfigured) {
    // Auth not configured — redirect straight to app
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-4">Authentication is not configured.</p>
          <a
            href="/app"
            className="text-teal-400 hover:text-teal-300 text-sm underline"
          >
            Go to app
          </a>
        </div>
      </div>
    )
  }

  return <LoginForm />
}
