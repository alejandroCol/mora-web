export function AddiCuotasButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`addi-cuotas ${className ?? ""}`}
      aria-label="Paga en cuotas con Addi"
    >
      <span className="addi-cuotas-kicker">paga en cuotas con</span>
      <img
        className="addi-cuotas-logo"
        src="/pay/addi-wordmark.png"
        alt=""
        width={96}
        height={36}
      />
    </button>
  );
}
