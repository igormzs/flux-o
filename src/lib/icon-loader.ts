import { useSyncExternalStore } from "react";

/**
 * The full picker catalog (~200 icons) is its own chunk, loaded the first
 * time the picker opens or a category uses an icon outside v1's set.
 */
type Catalog = typeof import("./icon-catalog");
let catalog: Catalog | null = null;
let loading: Promise<Catalog> | null = null;
const listeners = new Set<() => void>();

/** Loads the icon catalog once; every subscriber re-renders when it arrives. */
export function loadIconCatalog(): Promise<Catalog> {
  loading ??= import("./icon-catalog").then((mod) => {
    catalog = mod;
    listeners.forEach((l) => l());
    return mod;
  });
  return loading;
}

/** The catalog if it has loaded, else null (without triggering a load). */
export function useIconCatalog() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => catalog,
  );
}
