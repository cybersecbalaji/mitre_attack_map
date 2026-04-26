import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
})

export const metadata: Metadata = {
  title: "ATT&CK Coverage Heatmap Builder",
  description: "Visualise your MITRE ATT&CK detection coverage from Sigma rules and detection lists",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} font-sans bg-slate-900 text-slate-100 min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}
