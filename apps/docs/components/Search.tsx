"use client";
import { useEffect, useRef, useState } from "react";

type PagefindResult = {
  url: string;
  excerpt: string;
  meta?: { title?: string };
};

declare global {
  interface Window {
    pagefind?: {
      search: (q: string) => Promise<{
        results: { data: () => Promise<PagefindResult> }[];
      }>;
    };
  }
}

/**
 * In-site search powered by Pagefind. The Pagefind bundle is built at
 * `pnpm pagefind:build` time and served from `/pagefind/`. We dynamic-import
 * it on first focus to keep the docs first-paint lean.
 */
export function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl-K focuses the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lazy-load the Pagefind runtime on first focus. The bundle path is the
  // public-served output of `pnpm pagefind:build`.
  const ensurePagefind = async () => {
    if (typeof window === "undefined" || window.pagefind) return;
    try {
      // @ts-expect-error — pagefind.js is generated at build time, not a
      // typed module the bundler knows about.
      const mod = await import(/* webpackIgnore: true */ "/pagefind/pagefind.js");
      window.pagefind = mod;
    } catch {
      // Pagefind hasn't been built yet (e.g. dev mode). Silently fail —
      // search will return no results, but the input still renders.
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!query || !window.pagefind) {
        if (!cancelled) setResults([]);
        return;
      }
      const search = await window.pagefind.search(query);
      const data = await Promise.all(search.results.slice(0, 8).map((r) => r.data()));
      if (!cancelled) setResults(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="search" style={{ position: "relative", width: 280 }}>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search docs (⌘K)"
        value={query}
        onFocus={() => {
          setOpen(true);
          void ensurePagefind();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "0.4rem 0.6rem",
          borderRadius: 6,
          border: "1px solid var(--border, #444)",
          background: "var(--bg-subtle, transparent)",
          color: "inherit",
          fontSize: "0.9rem",
        }}
      />
      {open && query && results.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--bg, #1a1a1a)",
            border: "1px solid var(--border, #444)",
            borderRadius: 6,
            marginTop: 4,
            padding: "0.25rem 0",
            listStyle: "none",
            maxHeight: 320,
            overflowY: "auto",
            zIndex: 50,
          }}
        >
          {results.map((r, i) => (
            <li key={i} style={{ padding: "0.4rem 0.6rem" }}>
              <a href={r.url} style={{ color: "inherit", textDecoration: "none" }}>
                <strong style={{ display: "block", fontSize: "0.9rem" }}>
                  {r.meta?.title ?? r.url}
                </strong>
                <span
                  style={{ fontSize: "0.8rem", color: "var(--muted, #888)" }}
                  dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
