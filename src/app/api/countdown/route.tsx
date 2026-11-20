import { ImageResponse } from "next/og";
import { ROBOTO_LIGHT_DIGITS, ROBOTO_REGULAR_LATIN } from "@/server/countdownFonts";

export const dynamic = "force-dynamic";

const W = 600;
const H = 152;

function part(value: number, label: string) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 168 }}>
      <div style={{ display: "flex", fontFamily: "Roboto", fontWeight: 300, fontSize: 92, lineHeight: 1, letterSpacing: -2 }}>
        {String(value).padStart(2, "0")}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 14,
          fontFamily: "Roboto",
          fontWeight: 400,
          fontSize: 22,
          letterSpacing: 4,
          color: "rgba(255,255,255,0.78)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function rule() {
  return <div style={{ display: "flex", width: 2, height: 84, marginTop: 6, background: "rgba(255,255,255,0.24)" }} />;
}

/**
 * Cuenta regresiva del correo de descuento. Un correo no ejecuta código: esta imagen se dibuja
 * al abrirlo, con lo que falta en ese momento. Fondo transparente, texto blanco (va sobre la tarjeta lila).
 */
export async function GET(request: Request) {
  const until = Number(new URL(request.url).searchParams.get("t"));
  const left = Number.isFinite(until) ? Math.max(0, until - Date.now()) : 0;
  const minutes = Math.ceil(left / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  const body =
    minutes <= 0 ? (
      <div style={{ display: "flex", fontFamily: "Roboto", fontWeight: 400, fontSize: 34, color: "rgba(255,255,255,0.9)" }}>
        Este descuento ya venció
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
        {days > 0 ? part(days, days === 1 ? "DÍA" : "DÍAS") : null}
        {days > 0 ? rule() : null}
        {part(hours, hours === 1 ? "HORA" : "HORAS")}
        {rule()}
        {part(mins, "MIN")}
      </div>
    );

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
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
      height: H,
      fonts: [
        { name: "Roboto", data: Buffer.from(ROBOTO_LIGHT_DIGITS, "base64"), weight: 300, style: "normal" },
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
