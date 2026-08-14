import { useState } from 'react';
import type { InterruptData } from '@/lib/types';
import { CheckSquare, Square, ArrowRight, Loader2, Check, X, SkipForward } from 'lucide-react';

interface InterruptPickerProps {
  data: InterruptData;
  onSubmit: (selectedIds: string[]) => void;
  disabled?: boolean;
}

const KIND_LABEL: Record<string, string> = {
  destination: 'Choose destinations',
  place: 'Choose places',
  event: 'Choose events',
  accommodation: 'Choose a place to stay',
  confirmation: 'Confirm',
};

export default function InterruptPicker({ data, onSubmit, disabled }: InterruptPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const submit = (ids: string[]) => {
    if (submitting) return;
    setSubmitting(true);
    onSubmit(ids);
  };

  // Confirmation prompts (e.g. "delete these hotels?") are yes/no, not a list to
  // filter — one tap answers it, matching how the backend's request_user_selection
  // is used for destructive-action confirmations.
  if (data.kind === 'confirmation') {
    return (
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-4 sm:p-5 animate-fadeIn">
        <div className="flex items-start gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckSquare className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-sm font-medium text-amber-900 leading-relaxed">{data.reason}</p>
        </div>
        <div className="flex gap-2.5">
          {data.options.map((option, index) => {
            const isAffirmative = index === 0;
            return (
              <button
                key={option.id}
                onClick={() => submit([option.id])}
                disabled={disabled || submitting}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isAffirmative
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isAffirmative ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const toggle = (id: string) => {
    if (disabled || submitting) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-4 sm:p-5 animate-fadeIn">
      <div className="flex items-start gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <CheckSquare className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-500">
            {KIND_LABEL[data.kind ?? 'destination'] ?? 'Choose'}
            {data.destination ? ` — ${data.destination}` : ''}
          </p>
          <p className="text-sm font-medium text-amber-900 leading-relaxed mt-0.5">{data.reason}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4 mt-3">
        {data.options.map((option) => {
          const isSelected = selected.has(option.id);
          return (
            <button
              key={option.id}
              onClick={() => toggle(option.id)}
              disabled={disabled || submitting}
              className={`w-full flex items-start gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-amber-400 bg-amber-100/80 shadow-sm'
                  : 'border-amber-100 bg-white/60 hover:border-amber-300 hover:bg-amber-50/50'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-amber-600" />
                ) : (
                  <Square className="w-5 h-5 text-amber-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{option.label}</p>
                {option.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2.5">
        <button
          onClick={() => submit([...selected])}
          disabled={selected.size === 0 || disabled || submitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold shadow-sm hover:bg-amber-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              Submit selection
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
        <button
          onClick={() => submit([])}
          disabled={disabled || submitting}
          title="None of these — I'll ask something else"
          className="px-3.5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 hover:text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
        >
          <SkipForward className="w-4 h-4" />
          None of these
        </button>
      </div>
    </div>
  );
}
