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
  let Icon: ComponentType<IconProps>;
  if (customIcon && iconMap[customIcon]) {
    Icon = iconMap[customIcon];
  } else {
    Icon = iconMap[categoryId] ?? CurrencyDollar;
  }
  return <Icon size={size} weight={weight} className={className} />;
};

export default CategoryIcon;
