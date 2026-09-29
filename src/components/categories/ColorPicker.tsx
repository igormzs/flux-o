import { useEffect, useState } from "react";
import { Check, Eyedropper } from "@phosphor-icons/react";
import { categoryStyle, PALETTE, toHex } from "@/lib/categories";

/** Column names for the generated rows (see PALETTE), used for screen readers. */
const HUES = ["red", "orange", "yellow", "green", "teal", "blue", "violet", "pink"];
const CLASSIC = ["mint", "teal", "lavender", "electric blue", "pink", "yellow", "peach", "coral"];

const PALETTE_HEXES = new Set(PALETTE.flatMap((row) => row.colors));
const HEX_RE = /^#[0-9a-f]{6}$/i;

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

const ColorPicker = ({ value, onChange }: ColorPickerProps) => {
  const hex = toHex(value);
  const isCustom = !PALETTE_HEXES.has(hex);
  const [draft, setDraft] = useState(hex);
  useEffect(() => setDraft(hex), [hex]);

  const swatch = (color: string, label: string) => {
    const selected = color === hex;
    return (
      <button
        key={color}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={label}
        title={label}
        onClick={() => onChange(color)}
        style={categoryStyle(color)}
        className={`cat aspect-square w-full rounded-full bg-[var(--cat-tone)] flex items-center justify-center transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
        }`}
      >
        {selected && <Check size={14} weight="bold" className="text-[var(--cat-ink)]" />}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Color" className="space-y-2 max-w-sm">
        {PALETTE.map((row) => (
          <div key={row.name} className="grid grid-cols-8 gap-2">
            {row.colors.map((c, i) =>
              swatch(c, row.name === "Classic" ? `Classic ${CLASSIC[i]}` : `${row.name} ${HUES[i]}`),
            )}
          </div>
        ))}
      </div>

      {/* Any other color: the system color picker, or a hex code. */}
      <div className="flex items-center gap-2">
        <label
          className={`cat relative w-9 h-9 shrink-0 rounded-full bg-[var(--cat-tone)] flex items-center justify-center cursor-pointer ${
            isCustom ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
          }`}
          style={categoryStyle(hex)}
          title="Pick a custom color"
        >
          <Eyedropper size={16} weight="bold" className="text-[var(--cat-ink)]" />
          <input
            type="color"
            aria-label="Custom color"
            value={hex}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <label htmlFor="category-hex" className="sr-only">Hex color code</label>
        <input
          id="category-hex"
          value={draft}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            const next = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setDraft(next);
            if (HEX_RE.test(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => setDraft(hex)}
          className="h-9 w-28 rounded-lg bg-muted px-3 font-mono text-sm text-foreground uppercase outline-none focus:ring-2 focus:ring-primary/30"
        />
        <span className="text-xs text-muted-foreground">Custom</span>
      </div>
    </div>
  );
};

export default ColorPicker;
