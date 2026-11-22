"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import { promoPriceOf } from "@/commerce/promos";
import { colorPitchClose, colorShots } from "@/crm/colorPitch";
import { toJpeg } from "@/crm/jpeg";
import { useLivePromo, usePricing } from "@/components/sales/SalesProvider";
import { catalog, formatMoney, productTitle, type ModelId } from "@/lib/catalog";

type SendResult = boolean | void | Promise<boolean | void>;

async function galleryOf(modelId: ModelId) {
  const response = await fetch(`/api/gallery?model=${modelId}`);
  if (!response.ok) throw new Error("No se pudieron cargar las fotos.");
  const data = (await response.json()) as { images?: GalleryImage[] };
  return (data.images ?? []).map((image) => ({ ...image, modelId }));
}

async function jpegFile(src: string, name: string) {
  const response = await fetch(src);
  if (!response.ok) throw new Error("No se pudo traer la foto.");
  return toJpeg(await response.blob(), name);
}

export function useColorPitch({
  windowOpen,
  paused,
  onSend,
  onSendFile,
}: {
  windowOpen: boolean;
  paused: boolean;
  onSend: (text: string) => SendResult;
  onSendFile: (file: File, caption: string) => SendResult;
}) {
  const pricing = usePricing();
  const promo = useLivePromo();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [problem, setProblem] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!windowOpen) setOpen(false);
  }, [windowOpen]);

  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (sending) return;
      const node = event.target as Node;
      if (box.current?.contains(node) || chip.current?.contains(node)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !sending) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, sending]);

  function quote(modelId: ModelId) {
    const list = pricing[modelId];
    return { now: promoPriceOf(list, promo), list };
  }

  async function send(modelId: ModelId) {
    if (sending || paused || !windowOpen) return;
    setSending(true);
    setProblem("");
    let sent = 0;
    try {
      const shots = colorShots(modelId, await galleryOf(modelId));
      for (let index = 0; index < shots.length; index += 1) {
        const shot = shots[index];
        setStatus(`Enviando ${shot.label} · ${index + 1} de ${shots.length}`);
        const file = await jpegFile(shot.src, shot.fileName);
        const ok = await onSendFile(file, shot.label);
        if (ok === false) {
          setProblem(
            sent === 0
              ? `No salió ${shot.label}.`
              : `No salió ${shot.label}. Lo anterior sí se envió.`,
          );
          return;
        }
        sent += 1;
      }
      setStatus("Enviando el precio…");
      const { now, list } = quote(modelId);
      const ok = await onSend(colorPitchClose(modelId, now, now < list ? list : undefined));
      if (ok === false) {
        setProblem("Las fotos salieron. El precio no.");
        return;
      }
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar.";
      setProblem(sent === 0 ? message : `${message} Lo anterior sí se envió.`);
    } finally {
      setSending(false);
      setStatus("");
    }
  }

  const locked = !windowOpen || paused || sending;

  const panel = open ? (
    <div className="crm-pitch" ref={box} role="region" aria-label="Colores y precio">
      <p className="crm-pitch-title">Colores y precio</p>
      <p>Una foto de alguien con el anillo, por color. El precio sale al final.</p>
      {sending ? <p className="crm-pitch-status">{status}</p> : null}
      {problem ? <p className="crm-pitch-problem">{problem}</p> : null}
      <div className="crm-pitch-actions">
        {catalog.map((item) => {
          const { now } = quote(item.id);
          return (
            <button key={item.id} type="button" disabled={locked} onClick={() => void send(item.id)}>
              <strong>{productTitle(item.id)}</strong>
              <span>{formatMoney(now)}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  const trigger = (
    <button
      ref={chip}
      type="button"
      disabled={locked}
      aria-expanded={open}
      title="Una foto de alguien con el anillo, por color, y el precio al final"
      onClick={() => {
        setProblem("");
        setOpen((value) => !value);
      }}
      className={`crm-sell ${open ? "is-on" : ""}`}
    >
      Colores $
    </button>
  );

  return { busy: sending, panel, chip: trigger };
}
