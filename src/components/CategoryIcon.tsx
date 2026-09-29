import {
  Pizza,
  ShoppingCart,
  House,
  Television,
  BeerBottle,
  Plug,
  Gift,
  AirplaneTilt,
  CurrencyDollar,
  Car,
  Heart,
  Star,
  Coffee,
  Dog,
  Cat,
  GameController,
  MusicNote,
  GraduationCap,
  Barbell,
  FirstAid,
  Scissors,
  PaintBrush,
  Wrench,
  Phone,
  Laptop,
  Book,
  Briefcase,
  ShoppingBag,
  Baby,
  type IconProps,
} from "@phosphor-icons/react";
import { useEffect, type ComponentType } from "react";
import { loadIconCatalog, useIconCatalog } from "@/lib/icon-loader";

/**
 * v1's 28 icons (plus the per-category defaults) ship in the main bundle, so
 * existing categories render immediately. Anything else comes from the lazily
 * loaded catalog below.
 */
const iconMap: Record<string, ComponentType<IconProps>> = {
  food: Pizza,
  grocery: ShoppingCart,
  rent: House,
  subscriptions: Television,
  nightlife: BeerBottle,
  utilities: Plug,
  selfcare: Gift,
  travel: AirplaneTilt,
  // Named icons for custom categories
  Pizza,
  ShoppingCart,
  House,
  Television,
  BeerBottle,
  Plug,
  Gift,
  AirplaneTilt,
  CurrencyDollar,
  Car,
  Heart,
  Star,
  Coffee,
  Dog,
  Cat,
  GameController,
  MusicNote,
  GraduationCap,
  Barbell,
  FirstAid,
  Scissors,
  PaintBrush,
  Wrench,
  Phone,
  Laptop,
  Book,
  Briefcase,
  ShoppingBag,
  Baby,
};

interface CategoryIconProps {
  categoryId: string;
  customIcon?: string;
  size?: number;
  weight?: IconProps["weight"];
  className?: string;
}

const CategoryIcon = ({ categoryId, customIcon, size = 20, weight = "duotone", className }: CategoryIconProps) => {
  const loaded = useIconCatalog();
  const eager = (customIcon && iconMap[customIcon]) || (!customIcon && iconMap[categoryId]);
  const fromCatalog = !eager && customIcon ? loaded?.ICON_CATALOG.find((i) => i.name === customIcon)?.Icon : undefined;
  const needsCatalog = !eager && !!customIcon && !loaded;

  useEffect(() => {
    if (needsCatalog) loadIconCatalog();
  }, [needsCatalog]);

  // Keep the space while the catalog loads, so rows don't shift.
  if (needsCatalog) return <span aria-hidden style={{ width: size, height: size, display: "inline-block" }} className={className} />;
  const Icon = eager || fromCatalog || CurrencyDollar;
  return <Icon size={size} weight={weight} className={className} />;
};

export default CategoryIcon;
