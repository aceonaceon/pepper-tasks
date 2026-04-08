import { useState } from "react";
import { submitReview } from "../api";
import { t } from "../i18n";
import type { Task } from "../types";

interface Props {
  task: Task;
  onReviewed: () => void;
}

export default function ReviewAction({ task, onReviewed }: Props) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReview = async (approved: boolean) => {
    if (!approved && !comment.trim()) {
      setShowFeedback(true);
      return;
    }
    setSubmitting(true);
    try {
      await submitReview({ task_id: task.id, approved, comment: comment.trim() });
      onReviewed();
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const btnBase =
    "px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer";

  return (
    <div className="space-y-2.5">
      {showFeedback && (
        <textarea
          className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm bg-[var(--color-surface-raised)] resize-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-border-focus)] outline-none transition-colors animate-slide-up"
          rows={2}
          placeholder={t.feedbackPlaceholder}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          autoFocus
        />
      )}
      <div className="flex gap-2">
        <button disabled={submitting} onClick={() => handleReview(true)}
          className={`${btnBase} bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200`}>
          ✓ {t.approve}
        </button>
        <button disabled={submitting || (showFeedback && !comment.trim())} onClick={() => handleReview(false)}
          className={`${btnBase} bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200`}>
          ✕ {t.reject}
        </button>
      </div>
    </div>
  );
}
