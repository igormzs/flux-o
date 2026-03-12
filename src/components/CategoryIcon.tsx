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
  type IconProps,
} from "@phosphor-icons/react";
import type { CategoryId } from "@/lib/storage";
import { ComponentType } from "react";

const iconMap: Record<string, ComponentType<IconProps>> = {
  food: Pizza,
  grocery: ShoppingCart,
  rent: House,
  subscriptions: Television,
  nightlife: BeerBottle,
  utilities: Plug,
  selfcare: Gift,
  travel: AirplaneTilt,
};

interface CategoryIconProps {
  categoryId: string;
  size?: number;
  weight?: IconProps["weight"];
  className?: string;
}

const CategoryIcon = ({ categoryId, size = 20, weight = "duotone", className }: CategoryIconProps) => {
  const Icon = iconMap[categoryId] ?? CurrencyDollar;
  return <Icon size={size} weight={weight} className={className} />;
};

export default CategoryIcon;
