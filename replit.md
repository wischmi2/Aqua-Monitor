# ReefWatch - Salt Water Tank Monitoring & Control App

## Overview

ReefWatch is a saltwater aquarium monitoring and control application that allows users to track sensor readings (temperature, pH, salinity, ammonia, nitrite, nitrate, dissolved oxygen) and control tank equipment (heaters, filters, lights, wave makers, protein skimmers). The app follows Material Design principles with a mobile-first responsive layout, featuring real-time sensor data display, historical charts, and equipment toggle controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Charts**: Recharts library for sensor history visualization
- **Build Tool**: Vite with React plugin and path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript compiled with tsx
- **API Structure**: RESTful endpoints under /api/ prefix
- **Authentication**: Replit Auth integration using OpenID Connect (OIDC) with Passport.js
- **Session Management**: Express sessions stored in PostgreSQL via connect-pg-simple

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: shared/schema.ts contains all table definitions
- **Tables**:
  - `users` - User profiles (required for Replit Auth)
  - `sessions` - Session storage (required for Replit Auth)
  - `sensor_readings` - Time-series sensor data with userId, sensorType, value, unit
  - `equipment` - Tank equipment with on/off state and settings
  - `tanks` - User tank configurations

### Project Structure
```
client/           # Frontend React application
  src/
    components/   # React components including shadcn/ui
    pages/        # Route page components (dashboard, controls, history, settings)
    hooks/        # Custom React hooks (use-auth, use-toast, use-mobile)
    lib/          # Utilities (queryClient, utils)
server/           # Backend Express application
  index.ts        # Server entry point
  routes.ts       # API route definitions
  storage.ts      # Database operations (IStorage interface)
  db.ts           # Drizzle database connection
  replit_integrations/auth/  # Replit Auth implementation
shared/           # Shared code between client and server
  schema.ts       # Drizzle table schemas and types
  models/auth.ts  # User and session models
```

### Authentication Flow
- Uses Replit Auth via OpenID Connect
- Login redirects to /api/login, logout to /api/logout
- Protected routes use isAuthenticated middleware
- User data stored in PostgreSQL users table
- Sessions persisted in PostgreSQL sessions table

### API Endpoints
- `GET /api/auth/user` - Get current authenticated user
- `GET /api/sensors/latest` - Get latest sensor readings for user
- `GET /api/sensors/history` - Get historical sensor data with time range filter
- `POST /api/sensors` - Create new sensor reading
- `GET /api/equipment` - Get user's equipment list
- `PATCH /api/equipment/:id` - Update equipment state

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via DATABASE_URL environment variable
- **Drizzle Kit**: Schema migrations via `npm run db:push`

### Authentication
- **Replit Auth**: OIDC-based authentication using ISSUER_URL and REPL_ID environment variables
- **SESSION_SECRET**: Required for session encryption

### Frontend Libraries
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- **Recharts**: Data visualization for sensor history charts
- **Lucide React**: Icon library
- **date-fns**: Date formatting utilities

### Build & Development
- **Vite**: Development server with HMR
- **esbuild**: Production bundling for server code
- **tsx**: TypeScript execution for development