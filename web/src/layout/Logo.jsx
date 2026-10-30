import { cx } from '../components/ui.jsx';

/** Marca de Web Pulsar: núcleo con anillos de pulso. */
export function PulsarMark({ size = 36, className }) {
  return (
    <span className={cx('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-[30%] bg-gradient-to-br from-[#60A5FA] via-[#2563EB] to-[#173B72] shadow-[0_8px_20px_-8px_rgba(37,99,235,0.8),inset_0_1px_0_rgba(255,255,255,0.35)]" />
      <svg viewBox="0 0 40 40" className="relative" width={size} height={size} aria-hidden>
        <circle cx="20" cy="20" r="12" fill="none" stroke="white" strokeOpacity=".3" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="7" fill="none" stroke="white" strokeOpacity=".7" strokeWidth="1.8" />
        <circle cx="20" cy="20" r="3" fill="white" />
        <circle cx="29.5" cy="12.5" r="1.6" fill="white" fillOpacity=".9" />
      </svg>
    </span>
  );
}

export function Wordmark({ collapsed = false }) {
  return (
    <div className="flex items-center gap-3">
      <PulsarMark />
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-[14.5px] font-semibold tracking-[0.14em] text-brand-deep">WEB PULSAR</p>
          <p className="text-[10.5px] font-medium tracking-[0.02em] text-ink-soft">Business Control Center</p>
        </div>
      )}
    </div>
  );
}
