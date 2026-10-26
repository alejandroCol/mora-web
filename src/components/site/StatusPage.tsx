import type { ReactNode } from "react";

export function StatusPage({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="hero-wash flex min-h-[70dvh] flex-col items-center justify-center px-6 py-24 text-center">
      <p className="kicker">{kicker}</p>
      <h1 className="display mt-3 max-w-[16ch] text-[clamp(2.1rem,6vw,3.25rem)] leading-[1.06] text-ink">
        {title}
      </h1>
      <p className="mt-4 max-w-sm text-[15px] leading-7 text-soft">{body}</p>
      {children ? <div className="mt-8 flex flex-col items-center gap-4">{children}</div> : null}
    </div>
  );
}
