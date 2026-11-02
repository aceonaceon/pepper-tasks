import { useState, useRef, useCallback, type ReactNode, type TouchEvent } from "react";

interface Props {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 70;
const MAX_PULL = 120;

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY <= 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, [refreshing]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      // Dampen the pull distance
      const dampened = Math.min(diff * 0.5, MAX_PULL);
      setPullDistance(dampened);
    }
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6);
      try {
        await onRefresh();
      } catch {}
      // Brief pause so spinner is visible
      await new Promise((r) => setTimeout(r, 400));
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const pastThreshold = pullDistance >= THRESHOLD;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{
          height: pullDistance > 0 || refreshing ? `${Math.max(pullDistance, refreshing ? 44 : 0)}px` : "0px",
          transition: pulling.current ? "none" : undefined,
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <div
            className="text-xl transition-transform duration-200"
            style={{
              transform: `rotate(${progress * 360}deg) scale(${0.6 + progress * 0.4})`,
              opacity: Math.max(progress, refreshing ? 1 : 0),
              animation: refreshing ? "spin 0.8s linear infinite" : "none",
            }}
          >
            🌶️
          </div>
          {!refreshing && pullDistance > 10 && (
            <span className="text-[11px] text-[var(--color-ink-faint)] transition-all">
              {pastThreshold ? "放開重整" : "下拉重整"}
            </span>
          )}
          {refreshing && (
            <span className="text-[11px] text-[var(--color-accent)]">
              載入中...
            </span>
          )}
        </div>
      </div>

      {children}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
