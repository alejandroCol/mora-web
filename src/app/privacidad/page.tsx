import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { siteUrl } from "@/lib/site";

const UPDATED = "October 17, 2026";
const CONTACT = "hola@mora.ring";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Mora handles your data in the Mora Ring app, Círculo, and moraring.com. Wellness, not medical care. Cycle data stays on your phone.",
  alternates: { canonical: "/privacidad" },
  openGraph: {
    title: `Privacy Policy — ${BRAND.name}`,
    description:
      "Transparency about ring data, the app, Círculo, and the store. Optional cloud summaries; local cycle tracking.",
    url: siteUrl("/privacidad"),
    locale: "en_US",
  },
  robots: { index: true, follow: true },
};

type Section = {
  id: string;
  kicker: string;
  title: string;
  body: ReactNode;
};

const sections: Section[] = [
  {
    id: "who",
    kicker: "01",
    title: "Who we are",
    body: (
      <>
        <p>
          <strong className="font-medium text-ink">{BRAND.name}</strong> (“Mora”, “we”, “us”) operates
          the <strong className="font-medium text-ink">Mora Ring</strong> app for iPhone and Android,
          the <strong className="font-medium text-ink">Círculo</strong> service at{" "}
          <Link href="/circulo" className="text-ink underline decoration-bloom/80 underline-offset-2">
            moraring.com/circulo
          </Link>
          , and this store and support site at{" "}
          <Link href="/" className="text-ink underline decoration-bloom/80 underline-offset-2">
            moraring.com
          </Link>
          .
        </p>
        <p>
          Mora is a <strong className="font-medium text-ink">wellness</strong> experience. We are not a
          medical service and our products are not certified clinical devices.
        </p>
      </>
    ),
  },
  {
    id: "data",
    kicker: "02",
    title: "Data we process",
    body: (
      <>
        <p>Depending on how you use Mora, we may process:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
          <li>
            <strong className="font-medium text-ink">Account:</strong> email and credentials (Firebase
            Authentication) if you sign in to Círculo or create an account in the app.
          </li>
          <li>
            <strong className="font-medium text-ink">Ring profile:</strong> sex, age, height, weight,
            and preferences (units, notifications, visual tone). Used for day estimates, not clinical
            reports.
          </li>
          <li>
            <strong className="font-medium text-ink">Ring data:</strong> sleep, steps, activity, heart
            rate, recovery (HRV), blood oxygen, stress/tide, skin temperature, and other wellness
            readings depending on model. Synced over Bluetooth and stored{" "}
            <strong className="font-medium text-ink">on your phone first</strong>.
          </li>
          <li>
            <strong className="font-medium text-ink">Cycle (optional):</strong> period dates, estimated
            fertile window, and intimacy if you enable it.{" "}
            <strong className="font-medium text-ink">Stays on the device only</strong> and is not
            included in summaries you upload to Círculo.
          </li>
          <li>
            <strong className="font-medium text-ink">Círculo (optional):</strong> if you turn on “Upload
            daily summaries”, we send aggregated summaries (e.g. steps, sleep, tide). We do not upload
            heart-rate series or cycle data.
          </li>
          <li>
            <strong className="font-medium text-ink">Store:</strong> name, contact, shipping address, and
            payment data processed by payment providers; we do not store full card numbers on our
            servers.
          </li>
          <li>
            <strong className="font-medium text-ink">Technical use:</strong> minimal diagnostic logs, app
            identifiers, and aggregated analytics to improve stability (e.g. Firebase), without selling
            your health history.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "where",
    kicker: "03",
    title: "Where your data lives",
    body: (
      <>
        <p>
          The ring talks to the app over <strong className="font-medium text-ink">Bluetooth</strong>.
          Most of your history stays in local phone storage until you choose to share summaries or use
          Círculo.
        </p>
        <p>
          Cloud services (account, Círculo, opt-in summaries) use{" "}
          <strong className="font-medium text-ink">Google Firebase</strong> (Firestore, Cloud Functions,
          Authentication), with traffic encrypted in transit (HTTPS/TLS).
        </p>
      </>
    ),
  },
  {
    id: "purposes",
    kicker: "04",
    title: "Why we use it",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
        <li>Show sleep, movement, tide, and other ring signals in the app.</li>
        <li>Pair your ring, gentle reminders, and settings you choose.</li>
        <li>Run Círculo: invites, shared steps, and summaries you opt into.</li>
        <li>Process orders, shipping, and store support messages.</li>
        <li>Meet legal obligations and protect service security.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    kicker: "05",
    title: "Who we share with",
    body: (
      <>
        <p>
          <strong className="font-medium text-ink">We do not sell</strong> your personal data or wellness
          history.
        </p>
        <p>We share only what is needed with:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
          <li>
            <strong className="font-medium text-ink">People in your Círculo</strong>, according to what
            you choose to share.
          </li>
          <li>
            <strong className="font-medium text-ink">Service providers</strong> that help us operate
            (hosting, transactional email, payments, messaging), under contract and limited access.
          </li>
          <li>
            <strong className="font-medium text-ink">Authorities</strong>, when required by law.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "permissions",
    kicker: "06",
    title: "Phone permissions",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
        <li>
          <strong className="font-medium text-ink">Bluetooth:</strong> required to find and sync the
          ring.
        </li>
        <li>
          <strong className="font-medium text-ink">Notifications:</strong> optional, for gentle alerts
          and cycle reminders if enabled.
        </li>
        <li>
          <strong className="font-medium text-ink">Location (Android):</strong> on some devices the OS
          requires it for BLE scanning; Mora does not use maps or track where you go.
        </li>
      </ul>
    ),
  },
  {
    id: "control",
    kicker: "07",
    title: "Your choices",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-bloom">
        <li>Turn off “Upload daily summaries” in Profile at any time.</li>
        <li>Unpair the ring or delete app data from your phone settings.</li>
        <li>
          Sign out of Círculo, or request full account deletion at{" "}
          <Link href="/app/eliminar-cuenta" className="text-ink underline decoration-bloom/80 underline-offset-2">
            moraring.com/app/eliminar-cuenta
          </Link>
          .
        </li>
        <li>
          Email{" "}
          <a
            href={`mailto:${CONTACT}`}
            className="text-ink underline decoration-bloom/80 underline-offset-2"
          >
            {CONTACT}
          </a>{" "}
          for access, correction, or deletion of data tied to your account.
        </li>
      </ul>
    ),
  },
  {
    id: "children",
    kicker: "08",
    title: "Children",
    body: (
      <p>
        Mora Ring is not directed at children under 13. If you believe we collected a child’s data
        without parental consent, contact us and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    kicker: "09",
    title: "Changes",
    body: (
      <p>
        We may update this policy. We will post the revision date on this page. Continued use after a
        change means you have read the current version.
      </p>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <div className="relative overflow-hidden" lang="en">
      <div className="hero-wash border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-16 text-center sm:pt-20">
          <div className="frame-in flex flex-col items-center">
            <BrandLogo variant="mark" className="h-14 w-14 object-contain drop-shadow-sm" priority />
            <BrandLogo
              variant="wordmark"
              className="mt-5 h-7 w-auto max-w-[min(100%,220px)] object-contain opacity-90"
              alt=""
            />
            <p className="kicker mt-8">Legal · Wellness</p>
            <h1 className="display mt-3 text-[clamp(2.1rem,6vw,3.25rem)] leading-[1.06] text-ink">
              Privacy Policy
            </h1>
            <p className="title-whisper mt-4 max-w-lg text-[clamp(1.05rem,2.8vw,1.25rem)] text-soft">
              Your ring lives on your phone. Círculo only uploads summaries if you turn it on.
            </p>
            <p className="mt-6 text-[13px] text-soft">Last updated · {UPDATED}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-24 pt-0 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-14 lg:pb-32">
        <nav
          aria-label="On this page"
          className="frame-in reserve-sheet sticky top-6 z-10 hidden h-fit p-5 lg:block"
          style={{ animationDelay: "80ms" }}
        >
          <p className="kicker mb-4">On this page</p>
          <ul className="space-y-2 text-[13px]">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-xl px-2 py-1.5 text-soft transition hover:bg-lilac/40 hover:text-ink"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="-mt-16 space-y-5 sm:-mt-20 lg:mt-0 lg:space-y-6">
          <div
            className="frame-in reserve-sheet border border-line-strong/40 p-6 sm:p-8"
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-[15px] leading-7 text-soft">
              This policy describes how we handle personal data when you use{" "}
              <strong className="font-medium text-ink">Mora Ring</strong>,{" "}
              <strong className="font-medium text-ink">Círculo</strong>, and{" "}
              <strong className="font-medium text-ink">moraring.com</strong>. Ring readings are for
              wellness only; they do not replace professional medical advice.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Local first", "Círculo opt-in", "Cycle stays local"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-line bg-dawn/80 px-3 py-1 text-[11px] font-medium tracking-wide text-ink/80"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="frame-in scroll-mt-28 reserve-sheet border border-line-strong/30 p-6 sm:p-8"
              style={{ animationDelay: `${160 + index * 40}ms` }}
            >
              <p className="kicker">{section.kicker}</p>
              <h2 className="mt-2 font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
                {section.title}
              </h2>
              <div className="prose-mora mt-5 space-y-4 text-[15px] leading-7 text-soft">
                {section.body}
              </div>
            </section>
          ))}

          <footer
            className="frame-in reserve-sheet border border-line-strong/30 p-6 text-center sm:p-8"
            style={{ animationDelay: `${160 + sections.length * 40}ms` }}
          >
            <p className="text-[14px] leading-7 text-soft">
              Privacy questions?{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="font-medium text-ink underline decoration-bloom underline-offset-2"
              >
                {CONTACT}
              </a>
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-[13px] font-medium text-ink/70 underline-offset-2 hover:text-ink hover:underline"
            >
              Back to moraring.com
            </Link>
          </footer>
        </article>
      </div>
    </div>
  );
}
