# e-Rocks Mineral Explorer

## Overview

e-Rocks Mineral Explorer is a mobile-first web application for searching and exploring mineral data. The application integrates with the Mindat API to provide comprehensive geological information including mineral properties, localities, and Strunz classifications. Built with a modern stack featuring React, Express, and PostgreSQL, it offers an intuitive interface for mineral enthusiasts and researchers to discover and study mineralogical data.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server with HMR support
- Wouter for lightweight client-side routing

**UI Design System**
- Shadcn/ui components (New York style) for consistent, accessible UI elements
- Tailwind CSS for utility-first styling with custom design tokens
- Hybrid design approach combining Material Design principles with custom geological content presentation
- Dark mode primary with light mode support
- Mobile-first responsive design philosophy

**State Management**
- TanStack Query (React Query) for server state management and caching
- React Hook Form with Zod validation for form handling
- Local component state with React hooks

**Component Architecture**
- Radix UI primitives for accessible headless components
- Custom components built on Shadcn/ui foundation
- Centralized wheel navigation menu for mobile-optimized browsing
- Reusable card-based layouts for mineral and locality data display

### Backend Architecture

**Server Framework**
- Express.js with TypeScript running on Node.js
- ESM module system for modern JavaScript features
- Session-based middleware architecture with custom logging

**API Design**
- RESTful endpoints for mineral and locality search
- Proxy service to Mindat API with rate limiting and authentication
- JSON response format with standardized error handling

**Database Layer**
- Drizzle ORM for type-safe database operations
- PostgreSQL (via Neon serverless) for primary data storage
- Schema includes: minerals, localities, Strunz classifications, users, sync jobs, and favorites

**Production-Grade Database Architecture**

*Data Storage Strategy*
- PostgreSQL as primary data store with full normalization
- Elasticsearch integration planned for search and LLM-ready data serving
- Multi-source data consolidation with provenance tracking
- Hash-based change detection for efficient syncing

*Core Tables*
- **mindat_minerals**: Complete Mindat source data (146 fields) - single source of truth for mineralogical data
- **mineral_name_index**: Canonical mineral name registry with IMA approval status, aliases, and variety relationships
- **ionic_chemistry**: User's proprietary ionic chemistry datasets (original + UTF8 supplement) with cation/anion/silicate breakdowns
- **data_sources**: Registry of all data sources with priority levels for conflict resolution
- **data_conflicts**: Tracks conflicts between sources with resolution status for exception reporting
- **minerals**: Legacy/current search table for backward compatibility
- **localities**: Geographic locations with country and regional data
- **strunzClassifications**: Hierarchical mineral classification system
- **users**: Authentication and authorization with API key management
- **sync_jobs**: Background synchronization tracking for weekly Mindat imports

**Authentication & Security**
- Session-based authentication (connect-pg-simple for PostgreSQL session storage)
- API key management for Mindat API integration
- Role-based access control (user roles)
- Audit logging middleware

### External Dependencies

**Third-Party APIs**
- **Mindat API**: Primary data source for mineral information, localities, and classifications
  - Authentication via API key stored in Replit Secrets (MINDAT_API_KEY)
  - Proxy service implemented for rate limiting and error handling
  - Production sync service (MindatSyncService) with comprehensive 146-field mapping
  - Hash-based change detection (overall + field-level) for efficient incremental updates
  - Automatic population of mineral_name_index for IMA-approved minerals
  - Batch processing with configurable pagination and error recovery

**Database Services**
- **Neon Serverless PostgreSQL**: Cloud-hosted PostgreSQL database
  - Connection via `@neondatabase/serverless` driver
  - Managed through DATABASE_URL environment variable
  - Schema migrations via Drizzle Kit

**Development Tools**
- **Replit Plugins**: Development environment enhancements
  - Runtime error modal overlay
  - Cartographer for code mapping
  - Dev banner for development mode indicators

**UI Component Libraries**
- **Radix UI**: Headless component primitives (17+ components)
- **Lucide React**: Icon library for consistent iconography
- **Embla Carousel**: Touch-friendly carousel implementation
- **CMDK**: Command palette functionality

**Styling & Design**
- **Tailwind CSS**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **Google Fonts**: Inter (primary), JetBrains Mono (monospace)

**Form & Validation**
- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **@hookform/resolvers**: Form validation integration

**Build & Development**
- **Vite**: Frontend build tool and dev server
- **esbuild**: Backend bundling for production
- **tsx**: TypeScript execution for development
- **PostCSS & Autoprefixer**: CSS processing pipeline