export function AddiCuotasChip({ className }: { className?: string }) {
  return (
    <span className={`addi-chip ${className ?? ""}`} aria-hidden>
      <span className="addi-chip-kicker">paga en cuotas con</span>
      <img
        className="addi-chip-logo"
        src="/pay/addi-wordmark.png"
        alt=""
        width={48}
        height={12}
      />
    </span>
  );
}
