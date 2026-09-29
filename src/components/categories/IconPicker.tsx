import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { loadIconCatalog } from "@/lib/icon-loader";
import type { CatalogIcon } from "@/lib/icon-catalog";

type Catalog = Awaited<ReturnType<typeof loadIconCatalog>>;

interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
}

/** "ShoppingCart" → "Shopping cart", for labels and tooltips. */
const humanize = (name: string) => {
  const words = name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const IconPicker = ({ value, onChange }: IconPickerProps) => {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    loadIconCatalog().then((mod) => alive && setCatalog(mod));
    return () => {
      alive = false;
    };
  }, []);

  const groups = useMemo(() => {
    if (!catalog) return [];
    const hits = catalog.searchIcons(query);
    if (query.trim()) return [{ group: `${hits.length} ${hits.length === 1 ? "match" : "matches"}`, icons: hits }];
    return catalog.ICON_GROUPS.map((group) => ({ group, icons: hits.filter((i) => i.group === group) }));
  }, [catalog, query]);

  const button = ({ name, Icon }: CatalogIcon) => {
    const selected = name === value;
    return (
      <button
        key={name}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={humanize(name)}
        title={humanize(name)}
        onClick={() => onChange(name)}
        className={`aspect-square w-full rounded-lg flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon size={20} weight="duotone" />
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 h-10 rounded-lg bg-muted px-3 focus-within:ring-2 focus-within:ring-primary/30">
        <MagnifyingGlass size={16} className="text-muted-foreground shrink-0" />
        <label htmlFor="icon-search" className="sr-only">Search icons</label>
        <input
          id="icon-search"
          type="search"
          placeholder="Search icons — try “gym” or “coffee”"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
            <X size={14} weight="bold" />
          </button>
        )}
      </div>

      <div role="radiogroup" aria-label="Icon" className="max-h-64 overflow-y-auto scrollbar-none space-y-3 pr-0.5">
        {!catalog && <p className="text-xs text-muted-foreground py-6 text-center">Loading icons…</p>}
        {catalog && groups.every((g) => !g.icons.length) && (
          <p className="text-xs text-muted-foreground py-6 text-center">No icons match “{query.trim()}”.</p>
        )}
        {groups.map(({ group, icons }) =>
          icons.length ? (
            <div key={group}>
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{group}</p>
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">{icons.map(button)}</div>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
};

export default IconPicker;
