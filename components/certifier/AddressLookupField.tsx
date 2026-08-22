"use client";

import { useEffect, useRef, useState } from "react";
import { extractLotDpFromAddress, matchCouncilByAddress } from "@/lib/constants";

const inputCls = "w-full px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

// The development address, its Lot/Section/DP and the council that goes
// with it, filled in together because in practice they're one piece of
// information. Typing the address offers matching addresses; picking one
// (or pausing on what's typed) looks up the parcel and the council and
// fills those two fields in.
//
// Every field stays a plain, editable input the whole time. A lookup that
// finds nothing — an unregistered address, a new subdivision, the lookup
// service being down — leaves them exactly as typed, which is why the
// hints below say "edit if wrong" rather than presenting the result as
// settled.
export function AddressLookupField({
  address,
  onAddressChange,
  lotSectionDp,
  onLotSectionDpChange,
  onCouncilMatched,
  councilLga,
  addressLabel = "Property address",
  required = false,
}: {
  address: string;
  onAddressChange: (value: string) => void;
  lotSectionDp: string;
  onLotSectionDpChange: (value: string) => void;
  onCouncilMatched: (lga: string) => void;
  councilLga: string;
  addressLabel?: string;
  required?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [looking, setLooking] = useState(false);
  const suggestDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The callbacks and current values are read through a ref because the
  // debounced lookups below fire long after the keystroke that scheduled
  // them, by which time the values captured in that closure are stale.
  // Kept up to date in an effect rather than during render, which React
  // doesn't allow.
  const latest = useRef({ lotSectionDp, councilLga, onLotSectionDpChange, onCouncilMatched });
  useEffect(() => {
    latest.current = { lotSectionDp, councilLga, onLotSectionDpChange, onCouncilMatched };
  });

  // What the address text alone tells us, applied straight away — no
  // waiting on the network when the address already says "Lot 12 DP123456"
  // or names a suburb we know the council for.
  function applyLocal(value: string) {
    if (!latest.current.councilLga) {
      const match = matchCouncilByAddress(value);
      if (match) latest.current.onCouncilMatched(match.name);
    }
    if (!latest.current.lotSectionDp) {
      const lotDp = extractLotDpFromAddress(value);
      if (lotDp) latest.current.onLotSectionDpChange(lotDp);
    }
  }

  async function lookupDetails(value: string) {
    setLooking(true);
    try {
      const res = await fetch(`/api/address-details?address=${encodeURIComponent(value)}`);
      const data = await res.json();
      // Only ever fills a blank field — never overwrites something the
      // certifier typed themselves.
      if (data.lotSectionDp && !latest.current.lotSectionDp) latest.current.onLotSectionDpChange(data.lotSectionDp);
      if (data.lga && !latest.current.councilLga) latest.current.onCouncilMatched(data.lga);
    } catch {
      // Leave the fields alone — they're typed in by hand instead.
    } finally {
      setLooking(false);
    }
  }

  function handleChange(value: string) {
    onAddressChange(value);
    applyLocal(value);

    const trimmed = value.trim();
    if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
    if (lookupDebounce.current) clearTimeout(lookupDebounce.current);
    if (trimmed.length < 4) {
      setSuggestions([]);
      return;
    }

    suggestDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-autocomplete?input=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);

    // Longer than the typeahead: this only wants to run once the address
    // looks finished, not on the way there.
    lookupDebounce.current = setTimeout(() => lookupDetails(trimmed), 900);
  }

  function selectSuggestion(value: string) {
    onAddressChange(value);
    applyLocal(value);
    setSuggestions([]);
    setShowSuggestions(false);
    if (lookupDebounce.current) clearTimeout(lookupDebounce.current);
    lookupDetails(value);
  }

  useEffect(
    () => () => {
      if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
      if (lookupDebounce.current) clearTimeout(lookupDebounce.current);
    },
    []
  );

  return (
    <>
      <div className="relative">
        <label className={labelCls}>{addressLabel}</label>
        <input
          name="address"
          required={required}
          value={address}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          autoComplete="off"
          placeholder="e.g. 12 Example Street, Suburb NSW 2000"
          className={inputCls}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => selectSuggestion(s)}
                className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-t border-slate-50 first:border-t-0"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {looking && <div className="text-[11px] text-slate-400 mt-1">Looking up the lot and council…</div>}
        {!looking && councilLga && <div className="text-[11px] text-teal-700 mt-1">Council: {councilLga} — matched from the address, edit below if wrong.</div>}
      </div>
      <div>
        <label className={labelCls}>Lot / Section / DP</label>
        <input name="lotSectionDp" value={lotSectionDp} onChange={(e) => onLotSectionDpChange(e.target.value)} placeholder="e.g. 12/-/DP12345" className={inputCls} />
        <div className="text-[11px] text-slate-400 mt-1">Filled in from the address where NSW has it on record — type it in yourself if it&rsquo;s blank or wrong.</div>
      </div>
    </>
  );
}
