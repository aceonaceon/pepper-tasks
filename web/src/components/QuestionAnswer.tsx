import { useState } from "react";
import { answerQuestion } from "../api";
import { t } from "../i18n";
import type { Question } from "../types";

type ActionHint = "complete_task" | "agent_action_needed" | "keep_tracking" | null;

interface Props {
  question: Question;
  onAnswered: () => void;
}

export default function QuestionAnswer({ question, onAnswered }: Props) {
  const [value, setValue] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionHint, setActionHint] = useState<ActionHint>(null);

  const wrapAnswer = (answer: unknown) => {
    if (!actionHint) return answer;
    // Wrap primitive answers into an object with hint
    if (typeof answer === "object" && answer !== null) {
      return { ...answer as Record<string, unknown>, action_hint: actionHint };
    }
    return { value: answer, action_hint: actionHint };
  };

  const submit = async (answer: unknown) => {
    setSubmitting(true);
    try {
      await answerQuestion(question.id, wrapAnswer(answer));
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
      <ActionHintSelector value={actionHint} onChange={setActionHint} />
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

const HINT_OPTIONS: { value: ActionHint; label: string; icon: string }[] = [
  { value: null, label: "不指定", icon: "" },
  { value: "complete_task", label: "可結案", icon: "\u{1F3C1}" },
  { value: "agent_action_needed", label: "Agent 去做", icon: "\u{1F916}" },
  { value: "keep_tracking", label: "繼續追蹤", icon: "\u{23F3}" },
];

function ActionHintSelector({
  value,
  onChange,
}: {
  value: ActionHint;
  onChange: (v: ActionHint) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-[var(--color-ink-faint)]">Agent 下一步：</span>
      {HINT_OPTIONS.map((opt) => (
        <button
          key={opt.value ?? "none"}
          type="button"
          onClick={() => onChange(opt.value === value ? null : opt.value)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${
            value === opt.value
              ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
              : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)] border-[var(--color-border)] hover:border-[var(--color-ink-faint)]"
          }`}
        >
          {opt.icon ? `${opt.icon} ` : ""}{opt.label}
        </button>
      ))}
    </div>
  );
}
