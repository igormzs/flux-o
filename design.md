# Flux-o Design System & Style Guide

Flux-o is a modern, high-fidelity personal finance dashboard designed with a focus on **transparency**, **flow**, and **premium aesthetics**. This document serves as the source of truth for all design decisions and UI patterns within the application.

## 1. Visual Identity

### Core Concept
The name **Flux-o** represents the "flow" (flux) of money and organization (o). The visual style uses **Glassmorphism** and **Vibrant Gradients** against a deep, muted background to create a "glowing" effect that feels alive and interactive.

---

## 2. Color Palette

### Base Colors (Dark & Light Mode)
The application fully supports both Light and Dark themes, managed via the `.light` class on the `html` element. The variables dynamically shift to provide optimal contrast.
| Role | Color (HSL Dark) | CSS Variable | Use Case |
|------|-------------|--------------|----------|
| **Background** | `240 10% 6%` | `--background` | Page background |
| **Card** | `240 8% 10%` | `--card` | Component containers |
| **Primary** | `160 60% 60%` | `--primary` | Active states, main buttons (Mint) |
| **Secondary** | `260 50% 70%` | `--secondary` | Secondary accents (Lavender) |
| **Accent** | `330 70% 70%` | `--accent` | High-visibility highlights (Pink) |
| **Muted** | `240 6% 16%` | `--muted` | Sub-elements, secondary backgrounds |

### Semantic Colors
- **Success/Mint**: `--mint` (160 60% 60%) - Positive flow, groceries.
- **Warning/Yellow**: `--yellow` (45 90% 65%) - Attention, utilities.
- **Destructive/Coral**: `--coral` (10 75% 65%) - Negative flow, transport.
- **Information/Electric**: `--electric` (210 90% 65%) - Secondary indicators, general info.
- **Warm/Peach**: `--peach` (25 80% 70%) - Custom highlights.
- **Accent/Teal**: `--teal` (180 50% 55%) - Gradient end points.

### Gradients
- **Mint Flow Background**: `bg-gradient-to-r from-mint to-teal`
- **Pastel Glow Background**: `bg-gradient-to-r from-mint via-lavender to-pink`
- **Mint Text Gradient**: Use the utility class `.text-gradient-mint`
- **Pastel Text Gradient**: Use the utility class `.text-gradient-pastel`

---

## 3. Typography

The design uses two primary font families from Google Fonts.

### Display: Space Grotesk
Used for headings, titles, and numerical data to provide a modern, technical, and high-impact look.
- **Use Case**: `h1`, `h2`, `h3`, Balance Amounts, Widget Titles.
- **Weights**: 600 (Semibold), 700 (Bold).

### Body: DM Sans
Used for all body text, labels, and descriptive content for maximum readability and a premium feel.
- **Use Case**: Paragraphs, Button Labels, Category Names, Settings.
- **Weights**: 400 (Regular), 500 (Medium).

---

## 4. UI Patterns & Components

### Glassmorphism (The "Glass Card")
All main containers use the `.glass-card` utility.
- **Properties**: `bg-card/60`, `backdrop-blur-xl`, `border-glass-border`, `rounded-2xl`.
- **Logic**: Provides depth and transparency, allowing background elements to softly bleed through.

### Category Pills
Use the `.category-pill` utility class for any standardized tag or categorization label.
- **Properties**: `px-4 py-2 rounded-full text-sm font-medium transition-all duration-200`.

### Animations
Custom keyframe animations are configured in `tailwind.config.ts`:
- **Fade In**: `animate-fade-in` (0.4s ease-out)
- **Scale In**: `animate-scale-in` (0.3s ease-out)
- **Bounce In**: `animate-bounce-in` (0.5s cubic-bezier)
- **Accordion Dropdown**: `animate-accordion-down` and `animate-accordion-up`

### Border Radii
- **Cards**: `1rem` (16px) - `--radius`
- **Buttons/Pills**: `9999px` (Full) - For a modern, rounded aesthetic.
- **Input Fields**: `0.75rem` (12px) - Slightly sharper than cards for distinction.

### Icons
- **Library**: [Phosphor Icons](https://phosphoricons.com/)
- **Weight**: `duotone` is preferred for widgets and navigation to add visual depth.
- **Standard Size**: `20px` for general use, `24px` for main navigation.

---

## 5. Layout & Spacing

### Grid System
The application uses an **8px grid system** for consistent spacing.
- **Standard Padding**: `p-6` (24px) for cards.
- **Section Gap**: `gap-6` or `gap-8` (32px) between major layout components.
- **Max Width**: `max-w-7xl` (1280px) for the main dashboard container.

### Responsive Breakpoints
- **Mobile (< 768px)**: Single column layout, bottom navigation.
- **Tablet (< 1024px)**: Single column but wider containers.
- **Desktop (>= 1024px)**: Grid layout (`lg:grid-cols-3`), side-by-side charts, sidebar navigation.

---

## 6. Best Practices for Developers

1. **Gradients over Solid Colors**: When creating charts or highlights, prefer the predefined linear gradients in `SpendingChart.tsx` (`GRADIENT_COLORS`).
2. **Animation**: Use `framer-motion` for all transitions. Standard transitions should be `0.2s - 0.4s` with `ease-out`.
3. **Icons**: Always use SVG icons. Never use emojis for UI elements.
4. **Interactive States**: Every clickable element MUST have a `cursor-pointer` and a subtle hover effect (e.g., `hover:bg-muted/40` or `hover:scale-[1.02]`).
