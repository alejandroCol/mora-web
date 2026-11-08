import { NextResponse } from "next/server";

const BUNDLE_ID = "com.moraring.app";

export function GET() {
  const team = process.env.APPLE_TEAM_ID || process.env.NEXT_PUBLIC_APPLE_TEAM_ID || "";
  const appID = team ? `${team}.${BUNDLE_ID}` : "";
  const body = {
    applinks: {
      details: [
        {
          appIDs: appID ? [appID] : [],
          components: [{ "/": "/vincular/*", comment: "Círculo" }],
        },
      ],
    },
    webcredentials: appID ? { apps: [appID] } : undefined,
  };
  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
