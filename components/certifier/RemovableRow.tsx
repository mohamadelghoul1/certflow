"use client";

import { createContext, useContext, useState } from "react";

// Instant removal for a server-rendered checklist row.
//
// Deleting an item is a round trip plus a re-render of the whole job
// page, and the row used to sit there the entire time looking ignored.
// This wrapper owns the row's visibility on the client: the remove
// button hides it the moment the certifier confirms, and the real
// delete catches up behind it. If the delete fails, the row comes back
// with an explanation — hiding is a promise the server still has to keep.
const RemovableRowContext = createContext<{ hide: () => void; unhide: () => void } | null>(null);

export function useRemovableRow() {
  return useContext(RemovableRowContext);
}

export function RemovableRow({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) {
    // The provider must survive so unhide can still reach the state.
    return <RemovableRowContext.Provider value={{ hide: () => setHidden(true), unhide: () => setHidden(false) }}>{null}</RemovableRowContext.Provider>;
  }
  return <RemovableRowContext.Provider value={{ hide: () => setHidden(true), unhide: () => setHidden(false) }}>{children}</RemovableRowContext.Provider>;
}
