"use client";

import { useState } from "react";
import type { WhatsAppReferral } from "@/growth/types";
import { formatWhen } from "@/crm/labels";
import { referralImage, referralKindLabel, referralLink } from "@/crm/referral";

/**
 * Tarjeta del anuncio o publicación por la que entró el cliente.
 * `compact`: una línea con miniatura, para el hilo. Sin `compact`: ficha completa.
 */
export function CrmAdCard({
  referral,
  compact,
  className = "",
}: {
  referral: WhatsAppReferral;
  compact?: boolean;
  className?: string;
}) {
  const kind = referralKindLabel(referral);
  const link = referralLink(referral);
  const image = referralImage(referral);
  const isVideo = referral.mediaType === "video" || Boolean(referral.videoUrl);
  // Se guarda la URL que falló, no un booleano: si cambia el referral, se reintenta sola.
  const [brokenUrl, setBrokenUrl] = useState("");
  const broken = brokenUrl !== "" && brokenUrl === image;

  const thumb = image && !broken ? (
    <span className={`crm-ad-thumb ${isVideo ? "is-video" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBrokenUrl(image)} />
      {isVideo ? <span className="crm-ad-play" aria-hidden>▶</span> : null}
    </span>
  ) : (
    <span className="crm-ad-thumb is-empty" aria-hidden>
      {isVideo ? "▶" : "✦"}
    </span>
  );

  if (compact) {
    const inner = (
      <>
        {thumb}
        <span className="min-w-0">
          <span className="crm-ad-kicker">{kind}</span>
          <span className="crm-ad-title">{referral.headline || referral.body || "Click-to-WhatsApp"}</span>
        </span>
        {link ? <span className="crm-ad-cta">Ver</span> : null}
      </>
    );
    return link ? (
      <a href={link} target="_blank" rel="noreferrer" className={`crm-ad-card is-compact ${className}`}>
        {inner}
      </a>
    ) : (
      <div className={`crm-ad-card is-compact ${className}`}>{inner}</div>
    );
  }

  return (
    <div className={`crm-ad-card ${className}`}>
      <div className="crm-ad-row">
        {thumb}
        <div className="min-w-0">
          <p className="crm-ad-kicker">
            {kind}
            {referral.at ? ` · ${formatWhen(referral.at)}` : ""}
          </p>
          <p className="crm-ad-title">{referral.headline || "Sin título"}</p>
        </div>
      </div>
      {referral.body ? <p className="crm-ad-body">{referral.body}</p> : null}
      <div className="crm-ad-foot">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="crm-ad-link">
            Ver {kind.toLowerCase()}
          </a>
        ) : null}
        {referral.sourceId ? (
          <span className="crm-ad-id" title="Id del anuncio en Meta">
            #{referral.sourceId}
          </span>
        ) : null}
      </div>
    </div>
  );
}
