import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { t } from "../i18n";
import { useTheme } from "../hooks/useTheme";

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-[var(--color-surface)] transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--color-surface-raised)]/80 backdrop-blur-xl border-b border-[var(--color-border)] transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline group">
            <img src="/icon-192.png" alt="Pepper Tasks" className="w-8 h-8 rounded-[var(--radius-sm)] shadow-sm" />
            <div>
              <span className="text-[15px] font-semibold text-[var(--color-ink)] tracking-tight block leading-tight">
                {t.appTitle}
              </span>
              <span className="hidden sm:block text-[10px] text-[var(--color-ink-faint)] tracking-wide uppercase">
                The Agent grinds. You DECIDE!.
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {!isHome && (
              <Link
                to="/"
                className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] no-underline transition-colors"
              >
                ← 返回
              </Link>
            )}
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-border)] flex items-center justify-center transition-colors cursor-pointer"
              title={theme === "light" ? "切換深色模式" : "切換淺色模式"}
            >
              {theme === "light" ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1v1M8 14v1M1 8h1M14 8h1M3.05 3.05l.7.7M12.25 12.25l.7.7M3.05 12.95l.7-.7M12.25 3.75l.7-.7M11 8a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-[var(--color-ink-muted)]"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M14 9.37A6 6 0 016.63 2 6 6 0 1014 9.37z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-ink-muted)]"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {children}
      </main>
    </div>
  );
}
