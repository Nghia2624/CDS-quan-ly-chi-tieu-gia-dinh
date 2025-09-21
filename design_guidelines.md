# Family Expense Management Chatbot - Design Guidelines

## Design Approach
**Selected Approach**: Reference-Based Design inspired by modern fintech apps like Notion and Linear, with Vietnamese cultural considerations for family-oriented financial management.

**Justification**: This is a utility-focused productivity application requiring clear information hierarchy, efficient data entry, and intuitive navigation for family financial management.

## Core Design Elements

### Color Palette
**Primary Colors:**
- Light Mode: 220 85% 25% (Deep blue for trust and stability)
- Dark Mode: 220 15% 85% (Light blue-gray for readability)

**Background Colors:**
- Light Mode: 210 40% 98% (Warm white)
- Dark Mode: 220 25% 8% (Dark blue-gray)

**Accent Colors:**
- Success (income/savings): 142 70% 45% (Balanced green)
- Warning (high spending): 25 85% 55% (Warm orange)
- Error: 0 70% 50% (Standard red)

### Typography
**Font Stack**: Inter via Google Fonts CDN
- Headers: 600-700 weight
- Body text: 400-500 weight
- UI labels: 500 weight
- Sizes: text-xs to text-2xl for hierarchy

### Layout System
**Spacing Units**: Consistent use of Tailwind units 2, 4, 6, 8, 12, 16
- Component padding: p-4, p-6
- Section margins: m-8, m-12
- Grid gaps: gap-4, gap-6
- Button spacing: px-4 py-2, px-6 py-3

## Component Library

### Navigation
- Fixed sidebar for desktop with expense categories
- Bottom tab navigation for mobile (Dashboard, Add Expense, Chat, Stats, Profile)
- Clean navigation with subtle hover states

### Forms & Data Entry
- Large, thumb-friendly input fields for mobile expense entry
- Smart input suggestions for common Vietnamese expenses
- Currency formatting with VND symbol
- Category pills/tags with color coding

### Chat Interface
- WhatsApp-inspired chat bubbles
- User messages: right-aligned with primary color background
- AI responses: left-aligned with neutral background
- Typing indicators and message timestamps

### Data Visualization
- Clean, minimal charts using libraries like Chart.js or Recharts
- Consistent color coding across all visualizations
- Mobile-responsive chart scaling

### Cards & Information Display
- Subtle shadow cards: shadow-sm
- Expense summary cards with category icons
- Family member expense cards with avatars

## Vietnamese Cultural Considerations

### Content Presentation
- Clear hierarchy for family roles (father/mother accounts)
- Cultural expense categories: "Đám cưới", "Đám ma", "Tết", "Học phí"
- Respectful language for financial discussions
- VND currency formatting with proper comma separators

### Family-Centric Design
- Shared expense views with clear attribution
- Family budget overview dashboard
- Respectful iconography for cultural events

## Mobile-First Responsive Design
- Touch-friendly 44px minimum tap targets
- Swipe gestures for expense categorization
- Progressive web app capabilities
- Optimized for Vietnamese mobile usage patterns

## Accessibility & Usability
- High contrast ratios for financial data readability
- Clear focus states for keyboard navigation
- Loading states for AI processing
- Error states with helpful Vietnamese messages
- Consistent dark mode throughout all components including form inputs

## Key Design Principles
1. **Clarity**: Financial data must be immediately comprehensible
2. **Efficiency**: Quick expense entry with minimal friction
3. **Trust**: Professional appearance building confidence in financial management
4. **Cultural Sensitivity**: Appropriate for Vietnamese family financial discussions
5. **Mobile Excellence**: Optimized for smartphone-first usage in Vietnam