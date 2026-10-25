import { ImageResponse } from "next/og";

export const alt = "Flo — make your vibe-coded app production-ready";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#08080a", color: "#f2f2f3", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 600 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#f2f2f3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: "#c8f23d" }} />
          </div>
          flo
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>Your AI built the demo.</div>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02, color: "#c8f23d" }}>Flo gets it production-ready.</div>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 26, color: "#a0a0a8" }}>
          <span>Security</span>
          <span>·</span>
          <span>Bugs</span>
          <span>·</span>
          <span>Architecture</span>
          <span>·</span>
          <span>Launch roadmap</span>
        </div>
      </div>
    ),
    size,
  );
}
