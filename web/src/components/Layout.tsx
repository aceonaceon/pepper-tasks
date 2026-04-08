import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { t } from "../i18n";

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--color-surface-raised)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 no-underline group"
          >
            <img src="/icon-192.png" alt="Pepper Tasks" className="w-8 h-8 rounded-[var(--radius-sm)] shadow-sm" />
            <span className="text-[15px] font-semibold text-[var(--color-ink)] tracking-tight">
              {t.appTitle}
            </span>
          </Link>

          {!isHome && (
            <Link
              to="/"
              className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] no-underline transition-colors"
            >
              ← 返回首頁
            </Link>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {children}
      </main>
    </div>
  );
}
