import { useState } from "react";
import { answerQuestion } from "../api";
import { t } from "../i18n";
import type { Question } from "../types";

interface Props {
  question: Question;
  onAnswered: () => void;
}

export default function QuestionAnswer({ question, onAnswered }: Props) {
  const [value, setValue] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (answer: unknown) => {
    setSubmitting(true);
    try {
      await answerQuestion(question.id, answer);
      onAnswered();
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const options: string[] = question.options ? JSON.parse(question.options) : [];

  const btnBase =
    "px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer";

  let answerUI: React.ReactNode = null;

  switch (question.question_type) {
    case "yes_no":
      answerUI = (
        <div className="flex gap-2 flex-wrap">
          <button disabled={submitting} onClick={() => submit(true)}
            className={`${btnBase} bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200`}>
            {t.yes}
          </button>
          <button disabled={submitting} onClick={() => submit(false)}
            className={`${btnBase} bg-red-50 text-red-700 hover:bg-red-100 border border-red-200`}>
            {t.no}
          </button>
        </div>
      );
      break;

    case "single_choice":
      answerUI = (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button key={opt} disabled={submitting} onClick={() => submit(opt)}
              className={`${btnBase} bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:bg-sky-100 border border-sky-200`}>
              {opt}
            </button>
          ))}
        </div>
      );
      break;

    case "multi_choice": {
      const selected = (value as string[] | null) || [];
      answerUI = (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
              const active = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    if (active) setValue(selected.filter((s) => s !== opt));
                    else setValue([...selected, opt]);
                  }}
                  className={`${btnBase} border ${
                    active
                      ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                      : "bg-[var(--color-surface-sunken)] text-[var(--color-ink)] border-[var(--color-border)] hover:border-[var(--color-ink-faint)]"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <button disabled={submitting || selected.length === 0} onClick={() => submit(selected)}
            className={`${btnBase} bg-[var(--color-accent)] text-white hover:brightness-110`}>
            {t.submit}
          </button>
        </div>
      );
      break;
    }

    case "datetime":
      answerUI = (
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="datetime-local"
            className="border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm bg-[var(--color-surface-raised)] focus:border-[var(--color-border-focus)] outline-none transition-colors"
            onChange={(e) => setValue(e.target.value)}
          />
          <button disabled={submitting || !value} onClick={() => submit(value)}
            className={`${btnBase} bg-[var(--color-accent)] text-white hover:brightness-110`}>
            {t.submit}
          </button>
        </div>
      );
      break;

    case "open_ended":
      answerUI = (
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 min-w-0 border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm bg-[var(--color-surface-raised)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-border-focus)] outline-none transition-colors"
            placeholder="輸入回答..."
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && value) submit(value); }}
          />
          <button disabled={submitting || !value} onClick={() => submit(value)}
            className={`${btnBase} bg-[var(--color-accent)] text-white hover:brightness-110`}>
            {t.submit}
          </button>
        </div>
      );
      break;
  }

  return (
    <div className="space-y-3">
      {answerUI}
      <RevisionSection
        submitting={submitting}
        onSubmit={(feedback) => submit({ type: "revision", feedback })}
      />
    </div>
  );
}

function RevisionSection({
  submitting,
  onSubmit,
}: {
  submitting: boolean;
  onSubmit: (feedback: string) => void;
}) {
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");

  const btnBase =
    "px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer";

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className={`${btnBase} bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200`}
      >
        ✕ {t.needRevision}
      </button>
    );
  }

  return (
    <div className="space-y-2 animate-slide-up">
      <textarea
        className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm bg-[var(--color-surface-raised)] resize-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-border-focus)] outline-none transition-colors"
        rows={2}
        placeholder={t.revisionPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={() => { setActive(false); setText(""); }}
          className={`${btnBase} bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)] hover:bg-[var(--color-border)]`}
        >
          {t.cancel}
        </button>
        <button
          disabled={!text.trim() || submitting}
          onClick={() => onSubmit(text.trim())}
          className={`${btnBase} bg-orange-500 text-white hover:brightness-110`}
        >
          {t.submitRevision}
        </button>
      </div>
    </div>
  );
}
