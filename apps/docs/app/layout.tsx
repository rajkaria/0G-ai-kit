import type { Metadata } from "next";
import Link from "next/link";
import { Sidebar } from "../components/Sidebar";
import { Search } from "../components/Search";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "0gkit — the neutral 0G builder toolkit",
    template: "%s — 0gkit docs",
  },
  description:
    "Complete documentation for 0gkit: Storage, Compute, DA, Attestation, Chain, the 0g CLI, an MCP server, and React hooks for the 0G network.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="layout">
          <div style={{ width: "100%" }}>
            <header className="topbar">
              <Link href="/" style={{ color: "inherit" }}>
                <strong>0gkit</strong>
              </Link>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>docs</span>
              <span className="spacer" />
              <Search />
              <a
                href="https://github.com/rajkaria/0gkit"
                target="_blank"
                rel="noreferrer"
                style={{ marginLeft: "1rem" }}
              >
                GitHub
              </a>
            </header>
            <div className="shell">
              <Sidebar />
              <main className="content">
                <article className="prose">{children}</article>
              </main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
