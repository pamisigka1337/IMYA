# ПРОКАТ - Branded Clothing Rental Platform

## Overview

A full-stack web application for renting branded clothing items. Users can browse a catalog of designer clothing, make bookings with date selection, and manage their rentals. The platform includes user authentication, an admin panel for inventory and booking management, and pickup point locations.

The application is built with a React frontend and Express backend, using PostgreSQL for data persistence. It's designed as a rental marketplace with Russian language localization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state, React Context for auth state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: express-session with MemoryStore (development) / connect-pg-simple (production ready)
- **Authentication**: Session-based auth with bcryptjs for password hashing
- **API Design**: RESTful JSON API under `/api` prefix

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` - shared between frontend and backend
- **Validation**: Zod schemas generated from Drizzle schemas using drizzle-zod
- **Migrations**: Managed via `drizzle-kit push`

### Key Design Patterns
- **Monorepo Structure**: Client code in `client/`, server in `server/`, shared types in `shared/`
- **Type Sharing**: Database schemas and validation types are shared between frontend and backend
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` abstracts database operations
- **Protected Routes**: React component wrapper checks auth state before rendering protected pages

### Authentication Flow
- Session-based authentication stored server-side
- `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/me` endpoints
- Role-based access control (user/admin roles)
- Frontend AuthContext provides user state throughout the app

### Database Schema
- **users**: id, name, email, passwordHash, role
- **items**: id, brand, title, category, size, pricePerDay, deposit, images, condition, description, isActive
- **bookings**: References items and users, includes dates and status
- **pickupPoints**: Physical locations for item pickup

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Query builder and schema management

### UI Libraries
- **Radix UI**: Headless UI primitives (dialog, dropdown, select, tabs, etc.)
- **shadcn/ui**: Pre-styled component library
- **Lucide React**: Icon library
- **date-fns**: Date manipulation and formatting

### Authentication & Security
- **bcryptjs**: Password hashing
- **express-session**: Session management
- **memorystore**: In-memory session store for development

### Build & Development
- **Vite**: Frontend build tool and dev server
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the codebase

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session encryption (optional, has default for development)