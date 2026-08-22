"use client";

import { useEffect, useRef, useState } from "react";
import { Search, ExternalLink } from "lucide-react";
import { matchCouncilByAddress } from "@/lib/constants";
import { extractLotDps } from "@/lib/nsw/propertyLookup";

// The NSW Planning Portal's own property search. Always available as a
// fallback: it's the authoritative source, so if our lookup can't place an
// address the certifier can check it there and paste the lot back in.
//
// Linked at its root rather than at #/find-a-property/address. That's a
// route inside a single-page app, and opened cold — which is what a link
// from here always is — the app boots at its own landing page and
// discards the route, so the deep link looked broken. The root loads the
// same search reliably.
const SPATIAL_VIEWER = "https://www.planningportal.nsw.gov.au/spatialviewer/";

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
  zoning,
  onZoningChange,
  addressLabel = "Property address",
  required = false,
}: {
  address: string;
  onAddressChange: (value: string) => void;
  lotSectionDp: string;
  onLotSectionDpChange: (value: string) => void;
  onCouncilMatched: (lga: string) => void;
  councilLga: string;
  zoning: string;
  onZoningChange: (value: string) => void;
  addressLabel?: string;
  required?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [looking, setLooking] = useState(false);
  // What the last lookup actually found, so pressing Look up always says
  // something back rather than appearing to do nothing.
  const [result, setResult] = useState<string | null>(null);
  // Every Lot/Section/Plan NSW holds for the address. A property can sit
  // across several parcels, so these are offered as tickboxes and the
  // ticked ones make up the Lot/Section/DP field — the same way the NSW
  // Planning Portal presents them.
  const [lotOptions, setLotOptions] = useState<string[]>([]);
  // Set once a search has actually run and come back empty, so an address
  // search that finds nothing says so instead of looking dead.
  const [noSuggestions, setNoSuggestions] = useState(false);

  const selectedLots = lotSectionDp
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  function setLots(lots: string[]) {
    onLotSectionDpChange(lots.join(", "));
  }

  // Ticking keeps the parcels in the order NSW listed them, so the field
  // reads the same however they were ticked. A lot typed in by hand that
  // isn't in NSW's list is kept too, rather than dropped on the next tick.
  function toggleLot(lot: string) {
    const next = new Set(selectedLots);
    if (next.has(lot)) next.delete(lot);
    else next.add(lot);
    const ordered = [...lotOptions, ...selectedLots];
    setLots(ordered.filter((l, i) => next.has(l) && ordered.indexOf(l) === i));
  }
  const suggestDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The callbacks and current values are read through a ref because the
  // debounced lookups below fire long after the keystroke that scheduled
  // them, by which time the values captured in that closure are stale.
  // Kept up to date in an effect rather than during render, which React
  // doesn't allow.
  const latest = useRef({ lotSectionDp, councilLga, zoning, onLotSectionDpChange, onCouncilMatched, onZoningChange });
  useEffect(() => {
    latest.current = { lotSectionDp, councilLga, zoning, onLotSectionDpChange, onCouncilMatched, onZoningChange };
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
      const lots = extractLotDps(value);
      if (lots.length) latest.current.onLotSectionDpChange(lots.join(", "));
    }
  }

  // `force` is set when the certifier presses Look up. Typing only ever
  // fills a blank field, so it can't quietly rewrite something they
  // entered by hand — but asking for the lookup outright is permission to
  // replace what's there, which is the whole point of pressing it.
  async function lookupDetails(value: string, force = false) {
    setLooking(true);
    setResult(null);
    try {
      const res = await fetch(`/api/address-details?address=${encodeURIComponent(value)}`);
      const data = await res.json();

      const lots: string[] = Array.isArray(data.lots) ? data.lots : [];
      setLotOptions(lots);

      const found: string[] = [];
      if (lots.length && (force || !latest.current.lotSectionDp)) {
        // Every parcel is ticked to begin with, which is right for the
        // common case of a single-lot property; untick the ones that
        // don't apply.
        latest.current.onLotSectionDpChange(lots.join(", "));
        found.push(lots.join(", "));
      }
      if (data.lga && (force || !latest.current.councilLga)) {
        latest.current.onCouncilMatched(data.lga);
        found.push(data.lga);
      }

      if (force) {
        setResult(
          found.length
            ? `Found ${found.join(" · ")}`
            : "Nothing found for that address — type the lot and council in below, or check it on the NSW Planning Portal."
        );
      }
    } catch {
      // Leave the fields alone — they're typed in by hand instead.
      if (force) setResult("The lookup couldn't be reached — type the lot and council in below.");
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
      setNoSuggestions(false);
      return;
    }

    suggestDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-autocomplete?input=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        const list: string[] = data.suggestions || [];
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
        setNoSuggestions(list.length === 0);
      } catch {
        setSuggestions([]);
        setNoSuggestions(true);
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
        <div className="flex flex-wrap items-center gap-3 mt-1.5">
          <button
            type="button"
            onClick={() => address.trim().length >= 6 && lookupDetails(address.trim(), true)}
            disabled={looking || address.trim().length < 6}
            className="flex items-center gap-1 text-[11px] font-semibold text-teal-800 hover:underline disabled:opacity-40 disabled:no-underline"
          >
            <Search size={11} /> {looking ? "Looking up…" : "Look up lot & council"}
          </button>
          <a href={SPATIAL_VIEWER} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-slate-500 hover:underline">
            <ExternalLink size={11} /> Find a property on the NSW Planning Portal
          </a>
        </div>
        {noSuggestions && (
          <div className="text-[11px] text-amber-700 mt-1">
            No matching addresses came back — type the address in full. The lot and council can still be looked up from what you type.
          </div>
        )}
        {result && <div className="text-[11px] text-slate-600 mt-1">{result}</div>}
        {!looking && !result && councilLga && <div className="text-[11px] text-teal-700 mt-1">Council: {councilLga} — matched from the address, edit below if wrong.</div>}
      </div>
      <div>
        <label className={labelCls}>Lot / Section / Plan</label>
        {lotOptions.length > 0 && (
          <div className="border border-slate-200 rounded-md p-2 mb-2">
            <div className="space-y-1">
              {lotOptions.map((lot, i) => (
                <label key={lot} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="text-slate-400 w-5 shrink-0">{i + 1}.</span>
                  <input type="checkbox" checked={selectedLots.includes(lot)} onChange={() => toggleLot(lot)} className="accent-teal-700" />
                  {lot}
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setLots(lotOptions)} className="text-[11px] font-semibold text-teal-800 hover:underline">
                Select all
              </button>
              <button type="button" onClick={() => setLots([])} className="text-[11px] text-slate-500 hover:underline">
                Select none
              </button>
            </div>
          </div>
        )}
        <input name="lotSectionDp" value={lotSectionDp} onChange={(e) => onLotSectionDpChange(e.target.value)} placeholder="e.g. 12/-/DP12345" className={inputCls} />
        <div className="text-[11px] text-slate-400 mt-1">
          {lotOptions.length > 0
            ? "Tick the parcels this job covers. You can also edit the box directly."
            : "Filled in from the address where NSW has it on record — type it in yourself if it’s blank or wrong."}
        </div>
      </div>
      <div>
        <label className={labelCls}>Land zoning</label>
        <input name="zoning" value={zoning} onChange={(e) => onZoningChange(e.target.value)} placeholder="e.g. R2 Low Density Residential" className={inputCls} />
        <div className="text-[11px] text-slate-400 mt-1">
          Zoning isn&rsquo;t available from the NSW lookup, so type it in here — the Planning Portal link above shows it for the address.
        </div>
      </div>
    </>
  );
}
