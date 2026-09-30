export function parseLooseNumber(raw: string, decimals = 0) {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (decimals <= 0) {
    const n = Number(trimmed.replace(/[^\d-]/g, ""));
    return Number.isFinite(n) ? Math.abs(n) : 0;
  }
  const normalized = trimmed.replace(/\s/g, "").replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function MoneyInput({
  value,
  decimals = 0,
  className,
  onCommit,
  ariaLabel,
}: {
  value: number;
  decimals?: number;
  className?: string;
  onCommit: (value: number) => void;
  ariaLabel?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      defaultValue={value ? String(value) : ""}
      key={`${value}-${decimals}`}
      onBlur={(event) => {
        const next = parseLooseNumber(event.target.value, decimals);
        if (next !== value) onCommit(next);
        event.target.value = next ? String(next) : "";
      }}
      className={className}
    />
  );
}
