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
  - `sensor_readings` - Time-series sensor data with userId, sensorType, value, unit, deviceId
  - `equipment` - Tank equipment with on/off state and settings
  - `tanks` - User tank configurations
  - `devices` - Registered IoT devices (Golioth) with goliothDeviceId mapped to userId

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
- `GET /api/devices` - Get user's registered IoT devices
- `POST /api/devices` - Register a new Golioth device
- `GET /api/devices/unclaimed` - Get list of unclaimed devices available to claim
- `POST /api/devices/:id/claim` - Claim an unclaimed device
- `POST /api/devices/:id/unclaim` - Release a claimed device
- `PATCH /api/devices/:id` - Update device name
- `POST /webhooks/golioth` - Webhook endpoint for Golioth to push sensor data

### Golioth IoT Integration
The app integrates with Golioth IoT platform to receive sensor data from hardware devices:

**How it works (Auto-Registration):**
1. Configure Golioth Pipelines to send webhook to `/webhooks/golioth`
2. When an unknown device sends data, it's automatically created as "unclaimed"
3. User goes to Settings page and claims the device to link it to their account
4. Once claimed, sensor data is stored in `sensor_readings` table linked to user account
5. Unclaimed devices don't store sensor readings until claimed by a user

**Golioth Webhook Payload Format:**
```json
{
  "deviceId": "your-golioth-device-id",
  "temp": 78.5
}
```
Alternative field names supported: `device_id`, `temperature`, or nested in `data` object.

**Security:**
- Set `GOLIOTH_WEBHOOK_SECRET` environment variable
- Golioth should send this in `X-Webhook-Secret` or `Authorization` header

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