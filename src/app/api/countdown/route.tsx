import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/catalog";
import { offerDeadline } from "@/lib/offerDeadline";
import { ROBOTO_LIGHT_LATIN, ROBOTO_REGULAR_LATIN } from "@/server/countdownFonts";

export const dynamic = "force-dynamic";

/** Todo va al doble: el correo lo muestra a 300 px de ancho. */
const W = 600;
const SOFT = "rgba(255,255,255,0.82)";
const DEEP = "#5a4da6";

/** Fuera de los que dibujan: la hora se lee una vez por petición. */
const nowMs = () => new Date().getTime();

function label(text: string) {
  return (
    <div style={{ display: "flex", fontFamily: "Roboto", fontWeight: 400, fontSize: 24, letterSpacing: 5, color: SOFT }}>
      {text}
    </div>
  );
}

function part(value: number, unit: string) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 168 }}>
      <div style={{ display: "flex", fontFamily: "Roboto", fontWeight: 300, fontSize: 92, lineHeight: 1, letterSpacing: -2 }}>
        {String(value).padStart(2, "0")}
      </div>
      <div style={{ display: "flex", marginTop: 14, fontFamily: "Roboto", fontWeight: 400, fontSize: 22, letterSpacing: 4, color: SOFT }}>
        {unit}
      </div>
    </div>
  );
}

function rule() {
  return <div style={{ display: "flex", width: 2, height: 84, marginTop: 6, background: "rgba(255,255,255,0.24)" }} />;
}

function clock(until: number, now: number) {
  const minutes = Math.ceil(Math.max(0, until - now) / 60_000);
  if (minutes <= 0) {
    return (
      <div style={{ display: "flex", height: 132, alignItems: "center", fontFamily: "Roboto", fontWeight: 400, fontSize: 34 }}>
        Este descuento ya venció
      </div>
    );
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return (
    <div style={{ display: "flex", height: 132, alignItems: "flex-start", justifyContent: "center" }}>
      {days > 0 ? part(days, days === 1 ? "DÍA" : "DÍAS") : null}
      {days > 0 ? rule() : null}
      {part(hours, hours === 1 ? "HORA" : "HORAS")}
      {rule()}
      {part(minutes % 60, "MIN")}
    </div>
  );
}

function respond(body: ReactNode, height: number) {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
        }}
      >
        {body}
      </div>
    ),
    {
      width: W,
      height,
      fonts: [
        { name: "Roboto", data: Buffer.from(ROBOTO_LIGHT_LATIN, "base64"), weight: 300, style: "normal" },
        { name: "Roboto", data: Buffer.from(ROBOTO_REGULAR_LATIN, "base64"), weight: 400, style: "normal" },
      ],
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}

/**
 * Tarjeta del correo de descuento, dibujada como imagen al abrirlo: fondo transparente y texto blanco,
 * sobre la tarjeta lila del correo. Va como imagen porque Gmail en modo oscuro vuelve negro el texto
 * blanco, y porque un correo no puede contar hacia atrás: aquí sale lo que falta en ese momento.
 *
 * `?p=10` (porcentaje) o `?a=50000` (monto), `&s=` ahorro en pesos, `&t=` vencimiento (opcional).
 * Solo con `?t=` devuelve la cuenta regresiva suelta (correos enviados antes de este cambio).
 */
export async function GET(request: Request) {
  const now = nowMs();
  const params = new URL(request.url).searchParams;
  const until = Number(params.get("t"));
  const hasDeadline = Number.isFinite(until) && until > 0;
  const percent = Math.round(Number(params.get("p")));
  const amount = Math.round(Number(params.get("a")));
  const saving = Math.round(Number(params.get("s")));

  if (!(percent > 0) && !(amount > 0)) {
    return respond(clock(hasDeadline ? until : 0, now), 152);
  }

  const expired = hasDeadline && until <= now;
  const figure =
    percent > 0 ? (
      <div style={{ display: "flex", alignItems: "flex-start", height: 176 }}>
        <div style={{ display: "flex", fontFamily: "Roboto", fontWeight: 300, fontSize: 184, lineHeight: 1, letterSpacing: -6 }}>
          {String(Math.min(99, percent))}
        </div>
        <div style={{ display: "flex", marginTop: 18, marginLeft: 10, fontFamily: "Roboto", fontWeight: 300, fontSize: 84, lineHeight: 1 }}>
          %
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", height: 176, fontFamily: "Roboto", fontWeight: 300, fontSize: 96, letterSpacing: -3 }}>
        {`−${formatMoney(amount)}`}
      </div>
    );

  const body = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      {label("SOLO PARA TI")}
      <div style={{ display: "flex", marginTop: 22 }}>{figure}</div>
      <div style={{ display: "flex", marginTop: 14, fontFamily: "Roboto", fontWeight: 400, fontSize: 36 }}>
        {percent > 0 ? "de descuento en tu pedido" : "menos en tu pedido"}
      </div>
      {percent > 0 && saving > 0 ? (
        <div style={{ display: "flex", marginTop: 10, fontFamily: "Roboto", fontWeight: 300, fontSize: 28, color: SOFT }}>
          {`Ahorras ${formatMoney(saving)}`}
        </div>
      ) : null}
      {hasDeadline ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", width: "100%", height: 2, marginTop: 40, background: "rgba(255,255,255,0.22)" }} />
          <div style={{ display: "flex", marginTop: 40 }}>{label("TERMINA EN")}</div>
          <div style={{ display: "flex", marginTop: 24 }}>{clock(until, now)}</div>
          <div style={{ display: "flex", marginTop: 22, fontFamily: "Roboto", fontWeight: 300, fontSize: 24, color: SOFT }}>
            {`Hasta el ${offerDeadline(until)}`}
          </div>
        </div>
      ) : null}
      {expired ? null : (
        <div
          style={{
            display: "flex",
            marginTop: 48,
            height: 104,
            padding: "0 64px",
            alignItems: "center",
            borderRadius: 52,
            background: "#ffffff",
            color: DEEP,
            fontFamily: "Roboto",
            fontWeight: 400,
            fontSize: 31,
          }}
        >
          Usar mi descuento
        </div>
      )}
    </div>
  );

  const height =
    30 + 22 + 176 + 14 + 46 + (percent > 0 && saving > 0 ? 46 : 0) + (hasDeadline ? 40 + 2 + 40 + 30 + 24 + 132 + 22 + 34 : 0) + (expired ? 0 : 48 + 104) + 8;
  return respond(body, height);
}
