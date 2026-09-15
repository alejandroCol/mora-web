type IconProps = { className?: string };

export function IconCart({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 6h15l-1.5 9H7.5L6 6Z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.35" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconOrder({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}
