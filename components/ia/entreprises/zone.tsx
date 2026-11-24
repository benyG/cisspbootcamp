"use client";

import { type ReactNode, createContext, useContext, useState } from "react";

import type { Zone } from "@/lib/enterprise";

const ZoneContext = createContext<{ zone: Zone; setZone: (z: Zone) => void }>({ zone: "africa", setZone: () => undefined });

/** One price zone for the whole page: the ladder's switch also moves the sovereign offers' prices. */
export function ZoneProvider({ initial, children }: { initial: Zone; children: ReactNode }) {
  const [zone, setZone] = useState<Zone>(initial);
  return <ZoneContext.Provider value={{ zone, setZone }}>{children}</ZoneContext.Provider>;
}

export const useZone = () => useContext(ZoneContext);
