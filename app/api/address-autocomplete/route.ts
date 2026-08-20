import { NextResponse, type NextRequest } from "next/server";

// Proxies to Google's Places Autocomplete (New) API so the browser never
// sees the API key. Requires GOOGLE_PLACES_API_KEY to be set — with it
// unset (the default) this just returns no suggestions, and the address
// field falls back to plain typing, same as before this was added.
export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input")?.trim() || "";
  if (input.length < 4) return NextResponse.json({ suggestions: [] });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestions: [] });

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["au"],
        // Soft bias toward NSW (most certifier jobs), not a hard filter —
        // addresses just over the border still show up if typed.
        locationBias: {
          rectangle: {
            low: { latitude: -37.6, longitude: 140.9 },
            high: { latitude: -28.1, longitude: 153.7 },
          },
        },
      }),
    });
    if (!res.ok) return NextResponse.json({ suggestions: [] });

    const data = await res.json();
    type Prediction = { placePrediction?: { text?: { text?: string } } };
    const suggestions = ((data.suggestions || []) as Prediction[]).map((s) => s.placePrediction?.text?.text).filter((v): v is string => !!v);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
