import type { UsageBreakdown as UsageBreakdownType } from '@/lib/types';

interface UsageBreakdownProps {
  usage: UsageBreakdownType;
}

/**
 * Only 5 buckets exist: context/memory/system prompt/tools describe the main
 * agent call's prompt; "other" covers everything else — guardrail/classifier
 * calls plus the agent's own generated reply tokens (there's no separate
 * generation bucket). See trip-agent/src/graph/usage.py for the backend side.
 */
const CATEGORIES: { key: keyof UsageBreakdownType; label: string }[] = [
  { key: 'context_tokens', label: 'Context' },
  { key: 'memory_tokens', label: 'Memory' },
  { key: 'system_prompt_tokens', label: 'System prompt' },
  { key: 'tools_tokens', label: 'Tools' },
  { key: 'other_tokens', label: 'Other' },
];

function formatCost(cost: number | null): string {
  if (cost === null) return 'cost unavailable';
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

export default function UsageBreakdown({ usage }: UsageBreakdownProps) {
  const total = usage.total_tokens || 0;

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs">
      <div className="flex items-center justify-between font-medium text-slate-600">
        <span>{total.toLocaleString()} tokens</span>
        <span>{formatCost(usage.cost_usd)}</span>
      </div>
      <div className="mt-2 space-y-1">
        {CATEGORIES.map(({ key, label }) => {
          const value = (usage[key] as number) || 0;
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-24 flex-shrink-0 text-slate-400">{label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-teal-400" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-10 flex-shrink-0 text-right tabular-nums text-slate-500">
                {value.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
      {usage.model && <div className="mt-1.5 text-[10px] text-slate-400">{usage.model}</div>}
    </div>
  );
}
