"use client";

import { useEffect, useRef, useState } from "react";
import { NSW_STATE } from "@/lib/constants";

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-xs font-semibold text-placeholder mb-1";

// The applicant's address, found by typing rather than filled in box by
// box. One search line offers the same NSW address suggestions as the
// proposal address; picking one splits it into the number / street /
// suburb / postcode boxes below, which stay ordinary editable inputs —
// the suggestion services don't know every unit and new estate, so
// anything they get wrong is corrected by hand in place.

export type AddressParts = { streetNumber: string; street: string; suburb: string; state: string; postcode: string };

// The last word of the street ("ROAD", "ST", …) marks where the street
// ends and the suburb starts in NSW's comma-less address strings.
const STREET_TYPES = new Set([
  "ROAD", "RD", "STREET", "ST", "AVENUE", "AVE", "AV", "DRIVE", "DR", "COURT", "CT", "PLACE", "PL", "LANE", "LA", "CRESCENT", "CRES", "CR",
  "BOULEVARD", "BLVD", "BVD", "PARADE", "PDE", "HIGHWAY", "HWY", "CIRCUIT", "CCT", "CLOSE", "CL", "TERRACE", "TCE", "WAY", "GROVE", "GR",
  "ESPLANADE", "ESP", "PARKWAY", "PWY", "SQUARE", "SQ", "RISE", "VIEW", "WALK", "LOOP", "MEWS", "CHASE", "GARDENS", "GDNS", "CIRCLE", "CIR",
]);

function titleCase(text: string) {
  return text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Handles both suggestion shapes: Google's "12 Example St, Suburb NSW
// 2000, Australia" and NSW ePlanning's "12 EXAMPLE STREET SUBURB" (no
// commas, no state, no postcode).
export function parseAddressParts(raw: string): AddressParts {
  let text = raw.trim().replace(/,?\s*Australia\s*$/i, "");
  let state = "NSW";
  let postcode = "";

  const stateMatch = text.match(/\b(NSW|QLD|VIC|ACT|SA|WA|NT|TAS)\.?\s*(\d{4})?\s*$/i);
  if (stateMatch) {
    state = stateMatch[1].toUpperCase();
    postcode = stateMatch[2] || "";
    text = text.slice(0, stateMatch.index).trim().replace(/,\s*$/, "");
  } else {
    const postcodeMatch = text.match(/(\d{4})\s*$/);
    if (postcodeMatch) {
      postcode = postcodeMatch[1];
      text = text.slice(0, postcodeMatch.index).trim().replace(/,\s*$/, "");
    }
  }

  let streetPart = text;
  let suburb = "";
  const commaParts = text.split(",").map((s) => s.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    streetPart = commaParts[0];
    suburb = commaParts.slice(1).join(" ");
  } else {
    const words = text.split(/\s+/);
    for (let i = words.length - 2; i >= 1; i--) {
      if (STREET_TYPES.has(words[i].toUpperCase().replace(/[^A-Z]/gi, ""))) {
        streetPart = words.slice(0, i + 1).join(" ");
        suburb = words.slice(i + 1).join(" ");
        break;
      }
    }
  }

  const numberMatch = streetPart.match(/^(\d[\w/-]*)\s+(.+)$/);
  return {
    streetNumber: numberMatch ? numberMatch[1] : "",
    street: titleCase(numberMatch ? numberMatch[2] : streetPart),
    suburb: titleCase(suburb),
    state,
    postcode,
  };
}

export function ApplicantAddressField({
  label = "Applicant address",
  namePrefix = "applicant_",
  defaults,
}: {
  label?: string;
  namePrefix?: string;
  defaults?: Partial<AddressParts>;
}) {
  const [parts, setParts] = useState<AddressParts>({
    streetNumber: defaults?.streetNumber || "",
    street: defaults?.street || "",
    suburb: defaults?.suburb || "",
    state: defaults?.state || "NSW",
    postcode: defaults?.postcode || "",
  });
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(value: string) {
    setSearch(value);
    if (debounce.current) clearTimeout(debounce.current);
    const trimmed = value.trim();
    if (trimmed.length < 4) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-autocomplete?input=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        const list: string[] = data.suggestions || [];
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function selectSuggestion(value: string) {
    setParts(parseAddressParts(value));
    setSearch(value);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    []
  );

  const set = (key: keyof AddressParts) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setParts((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative mb-2">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          autoComplete="off"
          placeholder="Start typing to find the address — the boxes below fill in"
          className={inputCls}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-line rounded-md shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => selectSuggestion(s)}
                className="block w-full text-left px-3 py-2 text-sm text-muted hover:bg-hover border-t border-line first:border-t-0"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-5 gap-2">
        <input name={`${namePrefix}streetNumber`} value={parts.streetNumber} onChange={set("streetNumber")} placeholder="No." className={inputCls} />
        <input name={`${namePrefix}street`} value={parts.street} onChange={set("street")} placeholder="Street" className={`${inputCls} sm:col-span-2`} />
        <input name={`${namePrefix}suburb`} value={parts.suburb} onChange={set("suburb")} placeholder="Suburb" className={inputCls} />
        <input name={`${namePrefix}postcode`} value={parts.postcode} onChange={set("postcode")} placeholder="Postcode" className={inputCls} />
      </div>
      <select name={`${namePrefix}state`} value={parts.state} onChange={set("state")} className={`${inputCls} mt-2 sm:w-40`}>
        {NSW_STATE.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
