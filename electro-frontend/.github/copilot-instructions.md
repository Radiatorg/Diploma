# Electro Frontend — Copilot Instructions

## Overview

React 19 SPA (Create React App), port 3000 (dev) / 80 (nginx in Docker).

**Key Dependencies:**
- `react@^19.2.0`, `react-router-dom@^7.9.5`
- `axios@^1.13.2` — HTTP client
- `three@^0.183.2` — 3D floor plan visualization
- `@stomp/stompjs@^7.0.0` + `sockjs-client@^1.6.1` — WebSocket chat
- `recharts@^3.6.0` — charts in admin statistics
- `jspdf@^3.0.4` + `jspdf-autotable@^5.0.2` — PDF export

---

## Project Structure

```
src/
├── api/api.js                    # Axios client: interceptors, all API modules
├── context/AuthContext.js        # React Context for auth (JWT + roles)
├── components/
│   ├── Layout.js                 # Main layout: header, navigation, footer
│   ├── ProtectedRoute.js         # Route wrapper with role checking
│   ├── UI/
│   │   ├── Modal.js              # Reusable modal dialog
│   │   └── Pagination.js         # Pagination controls
│   ├── AdminNavPanel/            # Admin navigation sidebar
│   ├── FloorPlanCanvas/          # 2D canvas for floor drawing
│   ├── CalculationSheet/         # Display calculation results
│   ├── ElectricalSpecification/  # Display specification
│   ├── ElectricalSymbolsLibrary/ # Electrical symbols library
│   ├── ChatWidget/               # WebSocket chat (STOMP)
│   ├── CurrencyConverter/        # USD→BYN converter (NBRB rate)
│   ├── TKP339Recommendations/    # TKP 339 standard recommendations
│   ├── RoomEditor/               # Room properties editor
│   ├── RoomPropertiesPanel/      # Room details panel
│   ├── RoomAppliancesManager/    # Appliance management in room
│   ├── RoomLayoutEditor/         # Room arrangement
│   ├── ProjectAppliancesList/    # List of appliances in project
│   ├── ProjectEquipmentList/     # Equipment inventory
│   ├── SpecificationComparison/  # Specification comparison
│   ├── ApplianceCardModal/       # Appliance details modal
│   ├── ApplianceDimensionsPreview/ # 3D appliance size preview
│   └── ImageModal/               # Image gallery/lightbox
├── pages/
│   ├── Home.js                   # Dashboard with quick actions
│   ├── Login.js / Register.js    # Authentication / registration
│   ├── Profile.js                # Profile with photo upload
│   ├── Projects.js               # Projects list (filter, sort, paginate)
│   ├── ProjectForm.js            # Create/edit project
│   ├── ProjectDetail.js          # Project overview: rooms, appliances, calculations
│   ├── RoomForm.js               # Create/edit room
│   ├── RoomNotes.js              # Room notes
│   ├── Appliances.js             # Appliances catalog (search, categories, modal)
│   ├── ProjectApplianceForm.js   # Link appliance to project
│   ├── ManufacturerDetail.js     # Manufacturer details
│   ├── FloorPlanEditor.js        # 2D floor plan editor (Canvas)
│   ├── FloorPlan3D.js            # 3D visualization (Three.js + OrbitControls)
│   ├── StepByStepCalculator.js   # Step-by-step load calculation
│   ├── Support.js                # Support/chat page
│   └── admin/
│       ├── Users.js              # User CRUD
│       ├── AdminAppliances.js    # Appliance CRUD, catalog management
│       ├── AdminManufacturers.js # Manufacturer CRUD
│       ├── AdminElectricalSymbols.js # TKP 339 symbols library
│       ├── RoomTypes.js          # Room type CRUD
│       ├── AdminProjects.js      # All projects overview
│       ├── AdminProjectDetail.js # Project view (admin)
│       └── Statistics.js         # Statistics (Recharts: BarChart, PieChart)
├── utils/
│   ├── apiOrigin.js              # API base URL configuration + fileAbsoluteUrl()
│   ├── currencyService.js        # USD→BYN rate (NBRB API, 1-hour cache)
│   ├── electricalSymbolSelector.js # Auto-select symbols per TKP 339
│   └── tkp339Validations.js      # Validations and calculations per TKP 339-2022
└── config/
    └── footerSocial.js           # Footer social links (env → fallback)
```

---

## Routing (react-router-dom v7)

### Public Routes
| Path | Component |
|------|----------|
| `/login` | Login |
| `/register` | Register |

### Protected Routes (DESIGNER + ADMIN)
| Path | Component |
|------|-----------|
| `/` | Home |
| `/profile` | Profile |
| `/projects` | Projects |
| `/projects/new` | ProjectForm |
| `/projects/:id` | ProjectDetail |
| `/projects/:id/edit` | ProjectForm |
| `/projects/:id/rooms/new` | RoomForm |
| `/projects/:projectId/rooms/:roomId/edit` | RoomForm |
| `/projects/:projectId/rooms/:roomId/notes` | RoomNotes |
| `/appliances` | Appliances |
| `/manufacturers/:id` | ManufacturerDetail |
| `/projects/:projectId/appliances/new` | ProjectApplianceForm |
| `/projects/:projectId/appliances/:projectApplianceId/edit` | ProjectApplianceForm |
| `/projects/:projectId/floor-plan` | FloorPlanEditor |
| `/projects/:projectId/floor-plan/3d` | FloorPlan3D |
| `/projects/:projectId/calculator` | StepByStepCalculator |
| `/calculator` | StepByStepCalculator |
| `/support` | Support |

### Admin Routes (ADMIN only)
| Path | Component |
|------|-----------|
| `/admin/users` | Users |
| `/admin/appliances` | AdminAppliances |
| `/admin/manufacturers` | AdminManufacturers |
| `/admin/electrical-symbols` | AdminElectricalSymbols |
| `/admin/room-types` | RoomTypes |
| `/admin/projects` | AdminProjects |
| `/admin/statistics` | Statistics |

---

## API Layer (`src/api/api.js`)

Single Axios instance with:
- **Base URL**: `${API_ORIGIN}/api` (from `src/utils/apiOrigin.js`)
- **Request interceptor**: adds `Authorization: Bearer <token>` from `localStorage`
- **Response interceptor**: on `401` — clears `localStorage` and redirects to `/login`

### Exported API Modules

| Module | Purpose |
| `authAPI` | login, register |
| `userAPI` | getProfile, updateProfile, deleteProfile |
| `projectAPI` | Projects CRUD |
| `roomAPI` | Rooms CRUD within project |
| `applianceAPI` | Appliances catalog (read-only) |
| `manufacturerAPI` | Manufacturers and their appliances |
| `categoryAPI` | Appliance categories |
| `projectApplianceAPI` | Link appliances to project |
| `calculationAPI` | Get load calculation |
| `specificationAPI` | Generate specification |
| `savedSpecificationAPI` | Save/load specifications |
| `pdfExportAPI` | PDF export (specification, calculation) |
| `emailAPI` | Send documents via email |
| `floorPlanAPI` | Floor plan management |
| `wallAPI` | Walls |
| `electricalPointAPI` | Electrical points |
| `circuitAPI` | Circuits |
| `cableRunAPI` | Cable runs |
| `fileAPI` | File upload/download |
| `chatAPI` | Chat messages |
| `adminAPI` | Admin operations (users, appliances, statistics) |

---

## Authentication (`AuthContext`)

React Context + `localStorage`. Hook `useAuth()` available in all components.

**State:** `user` (object with roles), `loading` (initialization flag)

**Methods:**
- `login(username, password)` → `{ success, error }`
- `register(userData)` → `{ success, error }`
- `logout()` — clears localStorage + state
- `hasRole(role)`, `isDesigner()`, `isAdmin()` — role checking
- `updateUser(userData)` — update profile in context

**Storage:** `localStorage.token` (JWT), `localStorage.user` (JSON)

---

## Patterns and Conventions

### Components
- Functional components + hooks (no classes)
- Styles: **separate .css files** next to component (no CSS Modules, no styled-components)
- Each major component in its own folder: `ComponentName/ComponentName.js` + `ComponentName.css`
- `PascalCase` for component names and files
- `camelCase` for variables, functions, props

### State Management
- `useState` / `useEffect` — local state
- `AuthContext` — only global context
- No Redux/Zustand/MobX — state passed via props and context

### Common UI Patterns
- Modals: `UI/Modal` component (props: `show`, `title`, `onClose`, `onConfirm`, `type`)
- Pagination: `UI/Pagination` component (props: `currentPage`, `totalPages`, `onPageChange`)
- Forms: controlled inputs, `useState` for fields, submit → API → redirect
- Tables/lists: `Array.map()` → JSX, sort/filter in state
- Loading: `loading` flag + spinner/text "Loading..."
- Errors: `try/catch` → `setError(message)` → display above form

### Navigation
- `useNavigate()` for programmatic navigation
- `useParams()` for route parameters
- `<Link>` for links in JSX

### Layout
- Header hidden on `/login`, `/register`
- Fullscreen mode on `/projects/:id/floor-plan/3d`
- Fixed `ChatWidget` for authenticated users
- Scroll-to-top button after 300px scroll

---

## TKP 339 Utilities (`src/utils/tkp339Validations.js`)

Key functions for validation per Belarusian standard:
- `calculateMinOutlets(roomType, area)` — minimum outlets by room type
- `validateRoomArea(roomType, area)` — check allowed area
- `validateSocketGroups(...)` — validate socket groups
- `requiresRCD(roomType)` — RCD required?
- `requiresSeparateLine(appliancePower)` — separate line for high-power appliances
- `getRequiredIPRatingForOutlet/Switch/Light(roomType, zone)` — required IP rating
- `checkBathroomOutletPlacement(zone, ipRating)` — bathroom safety zones

---

## Docker Build (Production)

Multi-stage:
1. `node:20-alpine` — `npm install --legacy-peer-deps` → `npm run build`
2. `nginx:alpine` — copies build + nginx.conf, listens on port 80

Nginx proxies `/api/` and `/ws/` to `server:8080`, SPA fallback `try_files → /index.html`.
