import { NextResponse, type NextRequest } from "next/server";
import { suggestNswAddresses, type Attempt } from "@/lib/nsw/spatial";

// Matching addresses for the one being typed.
//
// NSW's own ePlanning address search is the default: it's the service the
// NSW Planning Portal itself uses, it needs no API key or billing
// account, and it only knows NSW addresses — which is all this app deals
// with. Google Places is used instead when GOOGLE_PLACES_API_KEY is set,
// for a firm that wants addresses beyond NSW.
export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input")?.trim() || "";
  if (input.length < 4) return NextResponse.json({ suggestions: [] });

  // Adding &debug=1 shows what NSW actually returned, for diagnosing a
  // search that comes back empty.
  const debug = request.nextUrl.searchParams.get("debug") === "1";
  const log: Attempt[] = [];

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || debug) {
    const suggestions = await suggestNswAddresses(input, 8, log);
    return NextResponse.json(debug ? { suggestions, usingGoogleKey: !!apiKey, calls: log } : { suggestions });
  }

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
    // Falls back to the NSW search rather than showing nothing if the key
    // is rejected, over quota, or the request fails.
    if (!res.ok) return NextResponse.json({ suggestions: await suggestNswAddresses(input) });

    const data = await res.json();
    type Prediction = { placePrediction?: { text?: { text?: string } } };
    const suggestions = ((data.suggestions || []) as Prediction[]).map((s) => s.placePrediction?.text?.text).filter((v): v is string => !!v);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: await suggestNswAddresses(input) });
  }
}
