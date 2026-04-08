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

  switch (question.question_type) {
    case "yes_no":
      return (
        <div className="flex gap-2">
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

    case "single_choice":
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button key={opt} disabled={submitting} onClick={() => submit(opt)}
              className={`${btnBase} bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:bg-sky-100 border border-sky-200`}>
              {opt}
            </button>
          ))}
        </div>
      );

    case "multi_choice": {
      const selected = (value as string[] | null) || [];
      return (
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
    }

    case "datetime":
      return (
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

    case "open_ended":
      return (
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

    default:
      return null;
  }
}
