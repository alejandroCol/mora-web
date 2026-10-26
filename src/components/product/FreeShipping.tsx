export function FreeShipping({
  detail,
  className = "",
}: {
  detail?: string;
  className?: string;
}) {
  return (
    <span className={`ship-free ${className}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ship-free-icon"
        aria-hidden
      >
        <path d="M3 7.5h10.5v8.5H3z" />
        <path d="M13.5 10.5h3.6l2.9 3v2.5h-6.5" />
        <circle cx="7" cy="17.4" r="1.6" />
        <circle cx="17" cy="17.4" r="1.6" />
      </svg>
      Envío gratis
      {detail ? <span className="ship-free-detail">{detail}</span> : null}
    </span>
  );
}
