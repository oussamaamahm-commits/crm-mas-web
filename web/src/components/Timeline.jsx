import {
  Activity, Archive, CircleCheck, CreditCard, FileText, FolderKanban, Globe, KeyRound, Plug, Quote, Receipt, Repeat, Server, Settings, ShieldCheck, TriangleAlert, UserPlus, Users, Wallet,
} from 'lucide-react';
import { Skeleton, cx } from './ui.jsx';
import { relative, dateTime } from '../lib/format.js';

// Icono y tono según la acción registrada en activity_logs.
const RULES = [
  [/^client\.created/, UserPlus, 'brand'],
  [/^client\.(archived|deleted)/, Archive, 'mute'],
  [/^client|^contact/, Users, 'brand'],
  [/^project\.created/, FolderKanban, 'violet'],
  [/^project|^task/, FolderKanban, 'violet'],
  [/^payment\.received|^payment\.paid/, CreditCard, 'ok'],
  [/^recurring/, Repeat, 'ok'],
  [/^payment|^expense/, Wallet, 'brand'],
  [/^invoice\.overdue/, Receipt, 'danger'],
  [/^invoice/, Receipt, 'brand'],
  [/^server\.down/, Server, 'danger'],
  [/^server|^database|^application/, Server, 'brand'],
  [/^domain|^dns/, Globe, 'brand'],
  [/^alert\.resolved|^incident\.resolved/, CircleCheck, 'ok'],
  [/^alert|^incident/, TriangleAlert, 'danger'],
  [/^integration/, Plug, 'violet'],
  [/^testimonial/, Quote, 'violet'],
  [/^document/, FileText, 'brand'],
  [/^secret/, KeyRound, 'warn'],
  [/^user|^settings|^backup|^demo/, Settings, 'mute'],
  [/^check/, ShieldCheck, 'brand'],
];
const TONE = {
  brand: 'bg-brand-ice text-brand',
  violet: 'bg-violet-soft text-violet',
  ok: 'bg-ok-soft text-ok',
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn-ink',
  mute: 'bg-mute-soft text-ink-soft',
};

export function actionVisual(action) {
  const rule = RULES.find(([re]) => re.test(action ?? ''));
  return rule ? { icon: rule[1], tone: rule[2] } : { icon: Activity, tone: 'mute' };
}

export function Timeline({ items, loading, compact = false }) {
  if (loading && !items) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <ol className="relative">
      {items.map((item, i) => {
        const { icon: Icon, tone } = actionVisual(item.action);
        return (
          <li key={item.id} className={cx('relative flex gap-3', compact ? 'pb-3.5' : 'pb-5')}>
            {i < items.length - 1 && <span className="absolute left-4 top-9 h-[calc(100%-28px)] w-px bg-gradient-to-b from-line to-transparent" aria-hidden />}
            <span className={cx('relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', TONE[tone])}>
              <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-snug text-ink">{item.summary}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-soft" title={dateTime(item.created_at)}>
                {item.user_name ?? 'Sistema'} · {relative(item.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
