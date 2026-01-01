# Design Guidelines: Salt Water Tank Monitoring & Control App

## Design Approach
**System Selected**: Material Design  
**Justification**: Data-dense monitoring application requiring clear visual hierarchy, responsive components, and strong feedback mechanisms for sensor readings and controls. Material Design's elevation system and component library excel at organizing complex information on both mobile and desktop viewports.

## Core Design Elements

### A. Typography
- **Primary Font**: Roboto (Google Fonts CDN)
- **Headings**: Roboto Medium (500) - Sensor names, section titles
- **Data Values**: Roboto Mono - Large numeric readings (temperature, pH, salinity)
- **Body Text**: Roboto Regular (400) - Labels, descriptions, settings
- **Scale**: Mobile-first approach with responsive sizing (text-sm to text-2xl for data values)

### B. Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Component padding: p-4, p-6
- Section margins: mb-6, mb-8
- Card spacing: gap-4, space-y-6
- Tight data displays: gap-2

**Grid Structure**:
- Mobile (base): Single column, stacked cards
- Tablet (md:): 2-column grid for sensor cards
- Desktop (lg:): 3-column dashboard layout with sidebar

### C. Component Library

**Authentication**:
- Centered login card (max-w-md) with elevated surface
- Email/password inputs with floating labels
- Primary CTA button, "Forgot Password" link
- Tank logo/icon at top

**Dashboard Layout**:
- Top app bar: Tank name, user menu, notifications icon
- Main content: Grid of sensor cards (Temperature, pH, Salinity, Ammonia, Nitrite, Nitrate, Dissolved Oxygen)
- Bottom navigation (mobile) or side rail (desktop) for: Dashboard, Controls, History, Settings

**Sensor Cards**:
- Card elevation with current reading prominently displayed
- Label + large numeric value + unit
- Mini sparkline chart showing 24hr trend
- Status indicator (normal/warning/critical) via subtle border treatment
- Last updated timestamp (text-xs)

**Control Panels**:
- Segmented sections for different equipment (Heater, Filter, Lights, Dosing Pumps)
- Toggle switches for on/off controls
- Sliders for variable controls (light intensity, flow rate)
- Confirmation dialogs for critical actions

**Data Visualization**:
- Line charts for historical sensor trends (Chart.js or similar)
- Time range selector (24h, 7d, 30d)
- Responsive chart containers that scale appropriately

**Navigation**:
- Mobile: Bottom navigation bar with 4-5 primary actions (icons from Material Icons)
- Desktop: Persistent side drawer (w-64) with expanded labels

### D. Responsive Behavior
- Mobile (< 768px): Stacked layout, full-width cards, bottom nav
- Tablet (768-1024px): 2-column grid, side nav appears as drawer
- Desktop (> 1024px): 3-column grid with persistent sidebar, expanded data tables

### E. Key Interactions
- Pull-to-refresh on mobile for latest sensor data
- Real-time updates via WebSocket with subtle animation on value change
- Swipe actions on mobile for quick access to sensor history
- No hover states on control switches - rely on clear on/off states with visual feedback

## Icons
**Library**: Material Icons (CDN)
- Use filled variants for active states
- Outlined variants for inactive/default states
- Standard icons: sensors, thermostat, water_drop, lightbulb, settings, history

## Images
No hero images required. This is a utility application focused on data display. App icon/logo only at login and in header.

## Accessibility
- WCAG AA compliant contrast ratios for all text
- Large touch targets (min 44x44px) for mobile controls
- Proper ARIA labels for all sensor readings and controls
- Keyboard navigation support for all interactive elements
- Screen reader announcements for critical sensor alerts