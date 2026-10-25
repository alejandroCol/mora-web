"use client";

import { useEffect, useState } from "react";
import { formatFollowers, type CreatorRecordView } from "@/lib/creatorApplication";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { useAdminAuth } from "./AdminAuth";

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ShotThumb({
  id,
  index,
  load,
}: {
  id: string;
  index: number;
  load: (input: string) => Promise<Response>;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    void load(`/api/admin/creadores/${id}/shot/${index}`)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, index, load]);

  if (!url) {
    return <span className="block h-24 w-20 animate-pulse rounded-xl bg-[#f0eef6]" />;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block h-24 w-20 overflow-hidden rounded-xl">
      <img src={url} alt="" className="h-full w-full object-cover" />
    </a>
  );
}

export function CreadoresView() {
  const { authorizedFetch } = useAdminAuth();
  const [creators, setCreators] = useState<CreatorRecordView[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void authorizedFetch("/api/admin/creadores")
      .then(async (res) => {
        const data = (await res.json()) as { ok?: boolean; creators?: CreatorRecordView[]; error?: string };
        if (cancelled) return;
        if (data.creators) setCreators(data.creators);
        else setError(data.error || "No se pudieron abrir los registros.");
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron abrir los registros.");
      });
    return () => {
      cancelled = true;
    };
  }, [authorizedFetch]);

  if (!creators && !error) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <BrandLoader label="Leyendo creadores" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-[13px] text-[#6e6e73]">Creadores</p>
      <h1 className="font-display mt-1">Registros.</h1>
      <p className="mt-2 text-[15px] text-[#6e6e73]">
        {error || (creators?.length ? `${creators.length} postulaciones` : "Todavía no hay registros.")}
      </p>
      <div className="mt-6 grid gap-3">
        {creators?.map((item) => (
          <article
            key={item.id}
            className="rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] sm:p-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[1.15rem] tracking-[-0.03em]">{item.name}</h2>
              <time className="shrink-0 text-[12px] text-[#6e6e73]">{when(item.createdAt)}</time>
            </div>
            <p className="mt-1 text-[14px] text-[#6e6e73]">
              <a href={`mailto:${item.email}`}>{item.email}</a>
              {" · "}
              <a href={`https://wa.me/${item.phone.replace(/\D/g, "")}`}>{item.phone}</a>
            </p>
            <p className="mt-3 text-[15px]">
              {item.network}
              <span className="text-[#6e6e73]"> · {formatFollowers(item.followers)} seguidores</span>
            </p>
            {item.secondary ? <p className="mt-1 text-[14px] text-[#6e6e73]">También {item.secondary}</p> : null}
            <p className="mt-3 text-[15px] leading-relaxed">{item.audience}</p>
            {item.shotCount > 0 ? (
              <div className="mt-3 flex gap-2">
                {Array.from({ length: item.shotCount }, (_, index) => (
                  <ShotThumb
                    key={`${item.id}-${index + 1}`}
                    id={item.id}
                    index={index + 1}
                    load={authorizedFetch}
                  />
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
