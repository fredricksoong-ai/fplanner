# FPLanner Design System - Extracted Colors & Typography

This document contains the complete design system extracted from the FPLanner application at https://fplanner.onrender.com/#my-team/leagues

## Color Palette

### Primary Colors
- **Primary Purple**: `#37003c` - Main brand color
- **Primary Hover**: `#2a002e` - Darker shade for hover states
- **Accent Purple**: `#6b1970` - Secondary accent color

### Secondary Colors
- **Secondary Green**: `#00ff88` - Success/action color
- **Secondary Hover**: `#00d970` - Darker green for hover states

### Background Colors (Light Mode)
- **Background Primary**: `#f6f4f6` - Main background
- **Background Secondary**: `#edeaed` - Card/secondary surfaces
- **Background Tertiary**: `#e4e1e4` - Tertiary surfaces

### Text Colors (Light Mode)
- **Text Primary**: `#110d12` - Main text color (near black)
- **Text Secondary**: `#52505a` - Secondary text (medium gray)
- **Text Tertiary**: `#7a7882` - Tertiary text (lighter gray)

### Border Colors
- **Border Color**: `#d4d1d4` - Standard borders
- **Border Dark**: `#bfbcc0` - Darker borders

### Status Colors
- **Success**: `#00ff88` - Success states
- **Danger**: `#dc2626` - Error/danger states
- **Warning**: `#f59e0b` - Warning states

### Shadow
- **Shadow**: `rgba(17, 13, 18, 0.08)` - Subtle shadow for depth

### Heatmap Colors (Light Mode)
- **Red Background**: `#fee2e2`
- **Red Text**: `#991b1b`
- **Yellow Background**: `#fef9c3`
- **Yellow Text**: `#854d0e`
- **Light Green Background**: `#dcfce7`
- **Light Green Text**: `#166534`
- **Dark Green Background**: `#bbf7d0`
- **Dark Green Text**: `#14532d`
- **Gray Background**: `#edeaed`
- **Gray Text**: `#52505a`

## Typography

### Font Family
- **Primary Font**: `'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Available weights: 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold), 800 (Extra-bold)

### Font Sizes

#### Desktop
- **H1**: `1.5rem` (24px) - Font weight: 700, Letter spacing: -0.02em
- **H2**: `1.25rem` (20px) - Font weight: 700
- **H3**: `1rem` (16px) - Font weight: 700
- **Body**: `0.875rem` (14px) - Font weight: 400
- **Small**: `0.75rem` (12px) - Font weight: 400
- **Navigation Links**: `0.875rem` (14px) - Font weight: 500
- **Countdown**: `0.75rem` (12px)

#### Mobile
- **H1**: `1.25rem` (20px) - Font weight: 700
- **H2**: `1rem` (16px) - Font weight: 700
- **H3**: `0.875rem` (14px) - Font weight: 600
- **Body**: `0.75rem` (12px) - Font weight: 400
- **Text Secondary**: `0.7rem` (11.2px)
- **Text Tertiary**: `0.65rem` (10.4px)
- **Countdown**: `0.65rem` (10.4px)

### Line Heights
- **Headings**: `1.2`
- **Body Text**: `1.6`
- **Mobile Body**: `1.4`

## Background Pattern

The application uses a subtle gradient pattern overlay:
```css
background-image: 
    radial-gradient(circle at 20% 30%, rgba(168, 85, 247, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(34, 197, 94, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 40% 80%, rgba(251, 191, 36, 0.02) 0%, transparent 50%);
background-attachment: fixed;
```

## Spacing System

### Padding
- **XS**: `0.25rem` (4px)
- **SM**: `0.5rem` (8px)
- **MD**: `0.75rem` (12px)
- **LG**: `1rem` (16px)
- **XL**: `1.5rem` (24px)
- **2XL**: `2rem` (32px)

### Gaps
- **XS**: `0.25rem` (4px)
- **SM**: `0.5rem` (8px)
- **MD**: `0.75rem` (12px)
- **LG**: `1rem` (16px)

## Border Radius

- **Small**: `0.25rem` (4px)
- **Medium**: `0.5rem` (8px)
- **Large**: `0.75rem` (12px)

## Shadows

- **Small**: `0 1px 3px var(--shadow)`
- **Medium**: `0 2px 8px var(--shadow)`
- **Large**: `0 4px 16px var(--shadow)`

## Component Styles

### Navigation
- Background: `var(--bg-secondary)` (#edeaed)
- Padding: `1rem 2rem` (desktop), `0.5rem 1rem` (mobile)
- Box Shadow: `0 2px 8px var(--shadow)`
- Sticky positioning at top

### Buttons
- **Primary**: Background `var(--primary-color)`, color white, padding `0.5rem 1rem`, border-radius `0.5rem`
- **Secondary**: Background `var(--bg-tertiary)`, border `1px solid var(--border-color)`, padding `0.5rem 1rem`, border-radius `0.5rem`

### Inputs
- Background: `var(--bg-primary)`
- Border: `1px solid var(--border-color)`
- Border-radius: `0.5rem`
- Padding: `0.5rem 1rem`
- Focus: Border color changes to `var(--primary-color)` with shadow `0 0 0 3px rgba(55, 0, 60, 0.1)`

### Cards
- Background: `var(--bg-secondary)`
- Border-radius: `0.5rem`
- Padding: `1.5rem` (desktop), `1rem` (mobile)
- Box-shadow: `0 1px 3px var(--shadow)`

## Responsive Breakpoints

- **Mobile**: `max-width: 767px`
- **Tablet**: `768px - 1023px`
- **Desktop**: `min-width: 1024px`
- **Large Desktop**: `max-width: 1400px` (container)

## Files Generated

1. **design-mockup-replica.html** - Complete pixel-perfect HTML replica with embedded styles
2. **design-system.css** - Standalone CSS file with all design system variables and utilities
3. **DESIGN_SYSTEM_EXTRACTED.md** - This documentation file

## Usage

To use the design system in your project:

1. Include the CSS file:
```html
<link rel="stylesheet" href="design-system.css">
```

2. Use CSS variables in your styles:
```css
.my-component {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
}
```

3. Use the typography classes:
```html
<h1>Main Heading</h1>
<p class="mobile-body">Mobile body text</p>
```

## External Dependencies

- **Font Awesome 6.4.0**: For icons
- **Google Fonts - Figtree**: For typography

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```



