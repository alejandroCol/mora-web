import { ImageResponse } from "next/og";
import { getSalesPresentation } from "@/server/salesPolicy";

export const alt = "Mora — Pro y Ultra. Colombia.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const sales = await getSalesPresentation();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#16141f",
          color: "#f4f1ea",
          padding: "72px",
        }}
      >
        <div style={{ fontSize: 22, letterSpacing: 6, textTransform: "uppercase", opacity: 0.45 }}>
          Smart ring
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 92, letterSpacing: -4, fontWeight: 500 }}>Mora</div>
          <div style={{ fontSize: 36, opacity: 0.62 }}>{sales.ogLine}</div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.4 }}>Pro · Ultra · Colombia</div>
      </div>
    ),
    { ...size },
  );
}
