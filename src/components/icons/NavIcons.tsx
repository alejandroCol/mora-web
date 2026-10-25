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

export function IconClose({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconTrash({ className = "h-[18px] w-[18px]" }: IconProps) {
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
      <path d="M4.8 7h14.4" />
      <path d="M9.2 7V5.4A1.4 1.4 0 0 1 10.6 4h2.8a1.4 1.4 0 0 1 1.4 1.4V7" />
      <path d="M6.6 7l.8 12.2A1.6 1.6 0 0 0 9 20.8h6a1.6 1.6 0 0 0 1.6-1.6L17.4 7" />
      <path d="M10 10.6v6.2M14 10.6v6.2" />
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
