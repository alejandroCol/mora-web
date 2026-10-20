export function AddiMark({
  className,
}: {
  className?: string;
}) {
  return (
    <span className={`addi-mark ${className ?? ""}`} aria-hidden>
      <img src="/pay/addi.png" alt="" width={80} height={36} />
    </span>
  );
}
