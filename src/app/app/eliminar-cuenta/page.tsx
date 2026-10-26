import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { siteUrl } from "@/lib/site";

const CONTACT = "comunicaciones@moraring.com";
const UPDATED = "October 17, 2026";

export const metadata: Metadata = {
  title: "Delete your Mora Ring account",
  description:
    "How to request deletion of your Mora Ring account and Círculo cloud data. What we remove, what stays on your phone, and how long it takes.",
  alternates: { canonical: "/app/eliminar-cuenta" },
  openGraph: {
    title: `Delete your account — ${BRAND.name}`,
    description: "Steps to delete your Mora Ring account and associated cloud data.",
    url: siteUrl("/app/eliminar-cuenta"),
    locale: "en_US",
  },
  robots: { index: false, follow: false },
};

export default function EliminarCuentaAppPage() {
  return (
    <div className="relative overflow-hidden" lang="en">
      <div className="hero-wash border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-16 text-center sm:pt-20">
          <BrandLogo variant="mark" className="h-14 w-14 object-contain drop-shadow-sm" priority />
          <BrandLogo
            variant="wordmark"
            className="mt-5 h-7 w-auto max-w-[min(100%,220px)] object-contain opacity-90"
            alt=""
          />
          <p className="kicker mt-8">Mora Ring · Account</p>
          <h1 className="display mt-3 text-[clamp(2.1rem,6vw,3.25rem)] leading-[1.06] text-ink">
            Delete your Mora Ring account
          </h1>
          <p className="title-whisper mt-4 max-w-lg text-[clamp(1.05rem,2.8vw,1.25rem)] text-soft">
            Request removal of your account and associated Círculo data stored in the cloud.
          </p>
          <p className="mt-6 text-[13px] text-soft">Last updated · {UPDATED}</p>
        </div>
      </div>

      <article className="mx-auto max-w-2xl space-y-5 px-6 pb-28 pt-10 sm:space-y-6">
        <section className="reserve-sheet border border-line-strong/40 p-6 sm:p-8">
          <p className="text-[15px] leading-7 text-soft">
            This page is for the <strong className="font-medium text-ink">Mora Ring</strong> app
            (Android and iOS), published by <strong className="font-medium text-ink">Mora</strong>.
            Use it to request deletion of your <strong className="font-medium text-ink">account</strong>{" "}
            and Círculo data we store in the cloud.
          </p>
        </section>

        <section className="reserve-sheet border border-line-strong/30 p-6 sm:p-8">
          <p className="kicker">01</p>
          <h2 className="mt-2 font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
            How to request deletion
          </h2>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-[15px] leading-7 text-soft">
            <li>
              Email{" "}
              <a
                href={`mailto:${CONTACT}?subject=${encodeURIComponent("Delete Mora Ring account")}`}
                className="font-medium text-ink underline decoration-bloom underline-offset-2"
              >
                {CONTACT}
              </a>{" "}
              with the subject line{" "}
              <strong className="font-medium text-ink">Delete Mora Ring account</strong>.
            </li>
            <li>Use the same email address you use to sign in to Círculo.</li>
            <li>
              We confirm your request and delete the account. We process requests as soon as we can,
              within <strong className="font-medium text-ink">30 days</strong> at most.
            </li>
          </ol>
          <p className="mt-5 text-[15px] leading-7 text-soft">
            On iPhone, in Mora Ring:{" "}
            <strong className="font-medium text-ink">Me → Mora account → Close and delete my cloud</strong>.
            On Android, use the email steps above for now.
          </p>
        </section>

        <section className="reserve-sheet border border-line-strong/30 p-6 sm:p-8">
          <p className="kicker">02</p>
          <h2 className="mt-2 font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
            Data we delete
          </h2>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-[15px] leading-7 text-soft">
            <li>Your account (email and Firebase Authentication access).</li>
            <li>Your place in Círculo and invitations you created.</li>
            <li>Daily summaries you uploaded (steps, sleep, cycle tide summaries).</li>
            <li>Ring records stored in the cloud and linked to that account.</li>
          </ul>
        </section>

        <section className="reserve-sheet border border-line-strong/30 p-6 sm:p-8">
          <p className="kicker">03</p>
          <h2 className="mt-2 font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
            Data we keep
          </h2>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-[15px] leading-7 text-soft">
            <li>
              Data that lives only on your phone (cycle journal, intimacy notes, full on-device ring
              history). That is not in our cloud. To remove it, clear app data or uninstall the app.
            </li>
            <li>Store orders at mora.ring, if any, for as long as tax law requires.</li>
            <li>
              Technical backups for up to <strong className="font-medium text-ink">180 days</strong>{" "}
              after the live account is deleted.
            </li>
          </ul>
        </section>

        <footer className="reserve-sheet border border-line-strong/30 p-6 text-center sm:p-8">
          <p className="text-[14px] leading-7 text-soft">
            Questions?{" "}
            <a
              href={`mailto:${CONTACT}`}
              className="font-medium text-ink underline decoration-bloom underline-offset-2"
            >
              {CONTACT}
            </a>
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px] font-medium text-ink/70">
            <Link href="/privacidad" className="underline-offset-2 hover:text-ink hover:underline">
              Privacy
            </Link>
            <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
              moraring.com
            </Link>
          </div>
        </footer>
      </article>
    </div>
  );
}
