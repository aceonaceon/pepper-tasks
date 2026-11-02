import { useState } from "react";
import { createTask } from "../api";
import { t } from "../i18n";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTaskModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("agent:cody");
  const [quadrant, setQuadrant] = useState("not_urgent_not_important");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim(),
        assigned_to: assignedTo.trim(),
        quadrant,
        deadline: deadline || undefined,
      });
      onCreated();
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2.5 text-sm bg-[var(--color-surface-raised)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-border-focus)] outline-none transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[var(--color-surface-overlay)] backdrop-blur-sm" />

      {/* Modal */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full sm:max-w-md bg-[var(--color-surface-raised)] rounded-t-[20px] sm:rounded-[var(--radius-lg)] shadow-[var(--shadow-modal)] p-5 sm:p-6 space-y-4 animate-slide-up"
      >
        {/* Mobile drag indicator */}
        <div className="sm:hidden w-10 h-1 bg-[var(--color-border)] rounded-full mx-auto -mt-1 mb-2" />

        <h2 className="text-base font-semibold text-[var(--color-ink)]">{t.create}</h2>

        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-muted)] mb-1.5">{t.title}</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="任務名稱..." />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-muted)] mb-1.5">{t.description}</label>
          <textarea className={`${inputClass} resize-none`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="詳細描述（選填）" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-muted)] mb-1.5">{t.assignedTo}</label>
            <input className={inputClass} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-muted)] mb-1.5">{t.quadrant}</label>
            <select className={`${inputClass} cursor-pointer`} value={quadrant} onChange={(e) => setQuadrant(e.target.value)}>
              <option value="urgent_important">{t.urgent_important}</option>
              <option value="not_urgent_important">{t.not_urgent_important}</option>
              <option value="urgent_not_important">{t.urgent_not_important}</option>
              <option value="not_urgent_not_important">{t.not_urgent_not_important}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-muted)] mb-1.5">{t.deadline}</label>
          <input type="datetime-local" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm text-[var(--color-ink-muted)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-border)] rounded-[var(--radius-sm)] font-medium transition-colors cursor-pointer"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="flex-1 px-4 py-2.5 text-sm bg-[var(--color-accent)] text-white rounded-[var(--radius-sm)] font-medium hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            {t.create}
          </button>
        </div>
      </form>
    </div>
  );
}
