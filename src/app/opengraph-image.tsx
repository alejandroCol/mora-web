import { ImageResponse } from "next/og";

export const alt = "Mora — Un anillo. Un estado.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          <div style={{ fontSize: 36, opacity: 0.62 }}>Un anillo. Un estado.</div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.4 }}>Aero · Titan · Colombia</div>
      </div>
    ),
    { ...size },
  );
}
