"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COLOMBIA_DEPARTAMENTOS,
  formatoDepartamentoEtiqueta,
  municipiosDelDepartamento,
} from "@/lib/colombiaGeo";

export function ColombiaFields({
  departamento,
  ciudad,
  onDepartamento,
  onCiudad,
}: {
  departamento: string;
  ciudad: string;
  onDepartamento: (value: string) => void;
  onCiudad: (value: string) => void;
}) {
  const cities = useMemo(
    () => municipiosDelDepartamento(departamento),
    [departamento],
  );

  useEffect(() => {
    if (ciudad && cities.length > 0 && !cities.includes(ciudad)) {
      onCiudad("");
    }
  }, [cities, ciudad, onCiudad]);

  return (
    <>
      <label className="reserve-row">
        <span>Departamento</span>
        <select
          required
          value={departamento}
          onChange={(event) => onDepartamento(event.target.value)}
          className="reserve-input appearance-none bg-transparent"
        >
          <option value="">Elige</option>
          {COLOMBIA_DEPARTAMENTOS.map((item) => (
            <option key={item} value={item}>
              {formatoDepartamentoEtiqueta(item)}
            </option>
          ))}
        </select>
      </label>
      <label className="reserve-row">
        <span>Ciudad</span>
        <select
          required
          value={ciudad}
          disabled={!departamento}
          onChange={(event) => onCiudad(event.target.value)}
          className="reserve-input appearance-none bg-transparent disabled:opacity-40"
        >
          <option value="">{departamento ? "Elige" : "Primero el departamento"}</option>
          {cities.map((item) => (
            <option key={item} value={item}>
              {formatoDepartamentoEtiqueta(item)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
