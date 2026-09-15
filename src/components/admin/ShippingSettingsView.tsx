"use client";

import { useEffect, useState } from "react";
import type { CommerceSettings, EnviaCarrier } from "@/commerce/types";
import { ColombiaFields } from "@/components/checkout/ColombiaFields";
import { formatMoney } from "@/lib/catalog";
import { useAdminAuth } from "./AdminAuth";

const CARRIERS: { id: EnviaCarrier; label: string }[] = [
  { id: "coordinadora", label: "Coordinadora" },
  { id: "servientrega", label: "Servientrega" },
  { id: "deprisa", label: "Deprisa" },
];

export function ShippingSettingsView() {
  const { authorizedFetch } = useAdminAuth();
  const [settings, setSettings] = useState<CommerceSettings | null>(null);
  const [city, setCity] = useState("");
  const [depto, setDepto] = useState("");
  const [cop, setCop] = useState("16000");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    void authorizedFetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data: { settings?: CommerceSettings }) => setSettings(data.settings ?? null));
  }, [authorizedFetch]);

  if (!settings) return <p className="text-white/40">Cargando origen…</p>;
  const current = settings;

  async function persist(next: CommerceSettings) {
    setSettings(next);
    const res = await authorizedFetch("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(next),
    });
    const data = (await res.json()) as { ok?: boolean };
    setSaved(data.ok ? "Guardado" : "No se pudo guardar");
  }

  function patchOrigin(partial: Partial<CommerceSettings["origin"]>) {
    void persist({ ...current, origin: { ...current.origin, ...partial } });
  }

  return (
    <div className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Origen</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">De dónde salen.</h1>
      <p className="mt-2 text-sm leading-6 text-white/45">
        El checkout cotiza contra Envia.com (Coordinadora, Servientrega, Deprisa). Si la API no
        responde, usamos la tarifa de respaldo o por ciudad.
      </p>

      <div className="mt-8 overflow-hidden rounded-3xl bg-white text-[#16141f]">
        <ColombiaFields
          departamento={current.origin.departamento}
          ciudad={current.origin.ciudad}
          onDepartamento={(value) => patchOrigin({ departamento: value, ciudad: "" })}
          onCiudad={(value) => patchOrigin({ ciudad: value })}
        />
        <label className="reserve-row">
          <span>Dirección de despacho</span>
          <input
            defaultValue={current.origin.direccion}
            onBlur={(event) => patchOrigin({ direccion: event.target.value })}
            className="reserve-input"
          />
        </label>
        <label className="reserve-row">
          <span>Teléfono origen</span>
          <input
            defaultValue={current.origin.phone}
            onBlur={(event) => patchOrigin({ phone: event.target.value })}
            className="reserve-input"
          />
        </label>
        <label className="reserve-row">
          <span>Nombre en la guía</span>
          <input
            defaultValue={current.origin.name}
            onBlur={(event) => patchOrigin({ name: event.target.value })}
            className="reserve-input"
          />
        </label>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["pesoKg", "Peso kg"],
            ["largoCm", "Largo cm"],
            ["anchoCm", "Ancho cm"],
            ["altoCm", "Alto cm"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="rounded-2xl bg-white/[0.05] p-3 text-[11px] uppercase tracking-[0.1em] text-white/40">
            {label}
            <input
              type="number"
              step="0.1"
              defaultValue={current.package[key]}
              onBlur={(event) =>
                void persist({
                  ...current,
                  package: {
                    ...current.package,
                    [key]: Number(event.target.value),
                  },
                })
              }
              className="mt-2 w-full bg-transparent text-[16px] normal-case tracking-normal text-white outline-none"
            />
          </label>
        ))}
      </div>

      <label className="mt-6 flex items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          checked={current.quoteAutomatic}
          onChange={(event) =>
            void persist({ ...current, quoteAutomatic: event.target.checked })
          }
        />
        Cotizar automático con Envia
      </label>

      <div className="mt-5 flex flex-wrap gap-2">
        {CARRIERS.map((carrier) => (
          <button
            key={carrier.id}
            type="button"
            onClick={() => void persist({ ...current, favoriteCarrier: carrier.id })}
            className={`rounded-full px-4 py-2 text-[13px] ${
              current.favoriteCarrier === carrier.id
                ? "bg-white text-[#0e0d14]"
                : "bg-white/8 text-white/60"
            }`}
          >
            {carrier.label}
          </button>
        ))}
      </div>

      <label className="mt-6 block text-[11px] uppercase tracking-[0.12em] text-white/40">
        Tarifa de respaldo
        <input
          type="number"
          defaultValue={current.fallbackShippingCop}
          onBlur={(event) =>
            void persist({
              ...current,
              fallbackShippingCop: Number(event.target.value),
            })
          }
          className="mt-2 h-11 w-full rounded-2xl bg-white/8 px-3 text-[16px] normal-case tracking-normal text-white"
        />
      </label>

      <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
        Envío gratis desde (0 = no)
        <input
          type="number"
          defaultValue={current.freeShippingFromCop ?? 0}
          onBlur={(event) =>
            void persist({
              ...current,
              freeShippingFromCop: Number(event.target.value) || undefined,
            })
          }
          className="mt-2 h-11 w-full rounded-2xl bg-white/8 px-3 text-[16px] normal-case tracking-normal text-white"
        />
      </label>

      <h2 className="mt-10 text-lg">Tarifas por ciudad</h2>
      <div className="mt-3 overflow-hidden rounded-3xl bg-white text-[#16141f]">
        <ColombiaFields
          departamento={depto}
          ciudad={city}
          onDepartamento={(value) => {
            setDepto(value);
            setCity("");
          }}
          onCiudad={setCity}
        />
        <label className="reserve-row">
          <span>Precio COP</span>
          <input
            value={cop}
            onChange={(event) => setCop(event.target.value)}
            className="reserve-input"
          />
        </label>
      </div>
      <button
        type="button"
        className="mt-3 h-10 rounded-full bg-white px-4 text-[13px] text-[#0e0d14]"
        onClick={() => {
          if (!city) return;
          void persist({
            ...current,
            cityRates: [
              ...current.cityRates.filter(
                (rate) => !(rate.ciudad === city && rate.departamento === depto),
              ),
              { ciudad: city, departamento: depto, cop: Number(cop) || 0 },
            ],
          });
        }}
      >
        Añadir ciudad
      </button>
      <ul className="mt-4 space-y-2 text-sm text-white/70">
        {current.cityRates.map((rate) => (
          <li key={`${rate.departamento}-${rate.ciudad}`} className="flex justify-between">
            <span>
              {rate.ciudad} {rate.departamento ? `· ${rate.departamento}` : ""}
            </span>
            <span>
              {formatMoney(rate.cop)}{" "}
              <button
                type="button"
                className="text-white/35"
                onClick={() =>
                  void persist({
                    ...current,
                    cityRates: current.cityRates.filter((item) => item !== rate),
                  })
                }
              >
                quitar
              </button>
            </span>
          </li>
        ))}
      </ul>
      {saved ? <p className="mt-6 text-[12px] text-white/35">{saved}</p> : null}
    </div>
  );
}
