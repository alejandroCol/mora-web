"use client";

import { useEffect, useRef } from "react";
import { PhoneFilm, type PhoneFilmHandle } from "@/components/uso/PhoneFilm";

export function FilmSheet({
  src,
  label,
  title,
  onClose,
}: {
  src: string;
  label: string;
  title: string;
  onClose: () => void;
}) {
  const filmRef = useRef<PhoneFilmHandle>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      className="uso-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onClick={() => closeRef.current()}
    >
      <div className="uso-modal-bar">
        <button
          type="button"
          className="uso-modal-btn"
          aria-label="Pantalla completa"
          onClick={(event) => {
            event.stopPropagation();
            filmRef.current?.expand();
          }}
        >
          <ExpandIcon />
        </button>
        <button
          type="button"
          className="uso-modal-btn"
          aria-label="Cerrar"
          onClick={(event) => {
            event.stopPropagation();
            closeRef.current();
          }}
        >
          <CloseIcon />
        </button>
      </div>
      <div onClick={(event) => event.stopPropagation()}>
        <PhoneFilm ref={filmRef} src={src} label={label} />
      </div>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
