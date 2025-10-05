# e-Rocks Mineral Explorer - Design Guidelines

## Design Approach
**Hybrid System Approach** - Material Design foundation with custom enhancements for geological content presentation. Drawing inspiration from scientific databases like The Met Collection, Natural History Museum Digital Collections, and research platforms like Google Scholar for information hierarchy while emphasizing the visual beauty of mineral specimens.

## Core Design Principles
- **Clarity First**: Scientific accuracy and readability take priority
- **Visual Prominence**: Mineral images are hero elements throughout
- **Information Density**: Efficient display of technical data without overwhelming
- **Exploratory Navigation**: Encourage discovery through intuitive browsing

## Color Palette

### Dark Mode (Primary)
- **Background**: 222 15% 10% (deep charcoal, subtle warm undertone)
- **Surface**: 220 13% 15% (elevated surfaces)
- **Surface Variant**: 220 12% 20% (cards, panels)
- **Primary**: 200 90% 55% (bright cyan-blue, represents crystalline clarity)
- **Primary Hover**: 200 90% 48%
- **Accent**: 30 85% 55% (amber/gold for rare/featured minerals)
- **Text Primary**: 220 10% 95%
- **Text Secondary**: 220 10% 70%
- **Border**: 220 10% 25%

### Light Mode
- **Background**: 210 20% 98%
- **Surface**: 0 0% 100%
- **Surface Variant**: 210 15% 96%
- **Primary**: 200 85% 45%
- **Primary Hover**: 200 85% 38%
- **Accent**: 30 80% 50%
- **Text Primary**: 222 15% 15%
- **Text Secondary**: 222 10% 40%
- **Border**: 220 10% 85%

### Semantic Colors
- **Success**: 142 70% 45% (verified data)
- **Warning**: 38 90% 55% (incomplete information)
- **Info**: 200 90% 55% (additional details available)

## Typography

### Font Stack
- **Primary**: Inter (Google Fonts) - modern, highly legible for technical content
- **Data/Monospace**: 'JetBrains Mono' (Google Fonts) - chemical formulas, coordinates

### Type Scale
- **Display**: 3.5rem/4rem (56px/64px) - font-bold - Main landing hero
- **H1**: 2.5rem/3rem (40px/48px) - font-bold - Page titles
- **H2**: 2rem/2.5rem (32px/40px) - font-semibold - Section headers
- **H3**: 1.5rem/2rem (24px/32px) - font-semibold - Card titles, mineral names
- **Body Large**: 1.125rem/1.75rem (18px/28px) - font-normal - Descriptions
- **Body**: 1rem/1.5rem (16px/24px) - font-normal - Primary content
- **Body Small**: 0.875rem/1.25rem (14px/20px) - font-normal - Metadata
- **Caption**: 0.75rem/1rem (12px/16px) - font-medium - Labels, tags

## Layout System

### Spacing Units
Using Tailwind spacing primitives: **2, 3, 4, 6, 8, 12, 16, 24**

Common patterns:
- Component padding: p-4 to p-6 (mobile) / p-6 to p-8 (desktop)
- Section spacing: py-12 (mobile) / py-16 to py-24 (desktop)
- Card gaps: gap-4 (mobile) / gap-6 (desktop)
- Grid gaps: gap-6 (mobile) / gap-8 (desktop)

### Grid System
- **Container**: max-w-7xl mx-auto px-4 md:px-6
- **Mineral Grid**: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
- **Detail Layout**: Two-column split on desktop (60/40 for image/data)

## Component Library

### Navigation
- **Top Bar**: Fixed, backdrop-blur, 64px height
- **Logo**: Left-aligned, includes mineral icon
- **Search Bar**: Prominent center position, expandable, min-width 400px desktop
- **User Actions**: Right-aligned (favorites, settings, API status)

### Hero Section
- **Layout**: Full-width, min-h-[500px], split design
- **Left**: Headline + description + primary CTA
- **Right**: Rotating featured mineral image gallery (3-4 specimens)
- **Background**: Subtle gradient overlay on dark surface

### Search Interface
- **Input**: Large, rounded-lg, with icon prefix
- **Filters**: Collapsible sidebar (desktop) / bottom sheet (mobile)
- **Filter Options**: Checkboxes for properties, sliders for numeric ranges
- **Active Filters**: Chip display above results with clear-all

### Mineral Cards
- **Image**: 16:9 aspect ratio, rounded-lg, hover scale-105 transition
- **Content**: p-4, includes name (H3), chemical formula (mono), location (caption)
- **Footer**: Flex row with metadata icons (crystal system, hardness)
- **Interaction**: Cursor pointer, shadow-md, hover:shadow-xl
- **Loading State**: Skeleton shimmer animation

### Detail View
- **Image Gallery**: Large primary image with thumbnail strip below
- **Zoom**: Click to expand, pinch-zoom enabled on mobile
- **Data Sections**: 
  - Overview (grid, 2-col properties)
  - Chemistry (table format)
  - Physical Properties (icon + value pairs)
  - Localities (map integration + list)
  - Related Minerals (horizontal scroll cards)

### Data Display
- **Property Pairs**: Label (text-secondary, caption) + Value (text-primary, body)
- **Tables**: Striped rows, hover state, sticky headers for long lists
- **Chemical Formulas**: Monospace font, slight background highlight
- **Tags**: Rounded-full, px-3 py-1, varied colors for categories

### Buttons
- **Primary**: bg-primary, text-white, px-6 py-3, rounded-lg, font-medium
- **Secondary**: border-2 border-primary, text-primary, transparent bg
- **Text**: No border, text-primary, underline on hover
- **Icon Buttons**: 40x40, rounded-full, centered icon

### Forms (API Key Input)
- **Input Fields**: rounded-lg, border-2, p-3, focus:border-primary
- **Labels**: text-sm font-medium mb-2
- **Helper Text**: text-xs text-secondary mt-1
- **Validation**: Real-time with color indicators

### Loading States
- **Skeleton**: Animated gradient shimmer on surface-variant
- **Spinner**: Primary color, 40px, center of viewport for full-page loads
- **Progressive**: Load images after content structure

### Empty States
- **Icon**: Large (96px), text-secondary
- **Message**: H3 + body paragraph explaining context
- **Action**: Primary button suggesting next step

## Images

### Hero Section
Large featured mineral specimen image (1920x800px optimal):
- High-quality macro photography of crystalline structure
- Dramatic lighting showing facets and color
- Suggested: Azurite, Fluorite, or Amethyst cluster
- Position: Right 40% of hero, with soft vignette edge

### Mineral Gallery
Collection of diverse mineral specimens:
- Various crystal systems and colors represented
- Consistent lighting and white/neutral backgrounds
- High resolution for zoom functionality
- Aspect ratio: 4:3 or 16:9 standardized across catalog

### Placeholder Strategy
Use Unsplash Source with geology/mineral/crystal queries for POC phase

## Animations

**Minimal Approach** - Use sparingly:
- **Card Hover**: scale-105, shadow transition (150ms)
- **Image Load**: Fade-in (300ms)
- **Modal**: Slide-up from bottom (250ms ease-out)
- **Filter Toggle**: Smooth expand/collapse (200ms)
- **NO**: Parallax, complex scroll-driven effects, or distracting motion

## Responsive Behavior

### Breakpoints
- **Mobile**: < 768px - Single column, bottom nav, drawer filters
- **Tablet**: 768-1024px - 2-column grid, top nav
- **Desktop**: > 1024px - 3-4 column grid, sidebar filters

### Mobile Optimizations
- Stack detail view sections vertically
- Thumb-friendly button sizes (min 44px)
- Simplified header with hamburger menu
- Fixed search at top
- Swipeable image galleries

## Accessibility

- WCAG AA contrast ratios maintained
- Focus indicators visible (2px primary color ring)
- Alt text for all mineral images describing specimen
- Keyboard navigation for all interactions
- Screen reader labels for icon buttons
- Skip to content link
- Semantic HTML structure