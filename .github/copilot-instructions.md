# Electro — Copilot Instructions (Root)

## About the Project

**Electro** is a web application for designing electrical power supply for residential premises according to TKP 339-2022 standards (Belarus). The system allows creating projects, managing rooms and electrical equipment, calculating loads, generating specifications, and exporting documentation to PDF.

**Author:** Verchuk  
**Stack:** React 19 (CRA) + Spring Boot 3.5.7 (Java 17) + PostgreSQL 15

---

## Monorepo Structure

```
diploma/
├── docker-compose.yml            # Orchestration of all services
├── electro-frontend/             # React SPA (port 3000 dev / 80 docker)
│   └── src/
│       ├── api/api.js            # Axios HTTP client
│       ├── components/           # Reusable components
│       ├── context/AuthContext.js # Authentication via React Context
│       ├── pages/                # Pages (routes)
│       ├── pages/admin/          # Admin panel
│       └── utils/                # Utilities (TKP validation, currency, symbols)
└── Project/electro/              # Spring Boot REST API (port 8080)
    └── src/main/java/com/verchuk/electro/
        ├── config/               # DataInitializer, WebSocket, Mail
        ├── controller/           # 26 REST controllers
        ├── dto/request/          # 21 request DTOs
        ├── dto/response/         # 32 response DTOs
        ├── model/                # 21 JPA entities
        ├── repository/           # 19 JPA repositories
        ├── service/              # 30 services
        ├── security/             # JWT, SecurityConfig, filters
        └── exception/            # Global error handling
```

---

## Running the Project

### Docker (production-like)

```bash
docker-compose up --build
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:8080
- PostgreSQL → localhost:5433

### Local Development

**Backend:**
```bash
cd Project/electro
./mvnw spring-boot:run
# Or mvnw.cmd on Windows
```
Requires PostgreSQL on localhost:5432, database `electrodb`, user `postgres`/`1111`.

**Frontend:**
```bash
cd electro-frontend
npm install --legacy-peer-deps
npm start
```
Dev server on http://localhost:3000, proxies API to http://localhost:8080.

### Test Data

When `APP_TEST_DATA_ENABLED=true` (default), the following are created:
- Roles: DESIGNER, ADMIN
- Admin: `admin` / `admin123`
- Electrical symbols with prices
- Cable types
- Room type coefficients

---

## Архитектура

### Аутентификация
- JWT (HMAC-SHA-512), срок жизни 24 часа
- Токен хранится в `localStorage`, передаётся через `Authorization: Bearer <token>`
- Роли: **DESIGNER** (обычный пользователь) и **ADMIN**

### API-маршруты (бэкенд)
| Префикс | Доступ | Назначение |
|----------|--------|------------|
| `/api/auth/**` | Публичный | Логин, регистрация |
| `/api/designer/**` | DESIGNER, ADMIN | Проекты, комнаты, расчёты |
| `/api/admin/**` | ADMIN | Управление пользователями, справочниками |
| `/api/appliances`, `/api/manufacturers`, `/api/categories` | Авторизованный | Каталоги (только чтение) |
| `/api/chat/**` | DESIGNER, ADMIN | Чат поддержки |
| `/api/files/**` | Авторизованный | Загрузка/скачивание файлов |
| `/ws/**` | Авторизованный | WebSocket (STOMP + SockJS) |

### WebSocket
- Эндпоинт: `/ws` (SockJS fallback)
- Брокер: `/topic`, `/queue`
- Отправка: `/app/send` → публикация в `/topic/messages`

### Docker-среда
- **client** (nginx) → проксирует `/api/` и `/ws/` на `server:8080`
- **server** (Spring Boot JAR) → подключается к `db:5432`
- **db** (PostgreSQL 15 Alpine) → данные в named volume `electro-postgres-data`

---

## Code Conventions

### General
- UI Language: **Russian** (UI texts, user messages)
- Code Language: **English** (variables, classes, code comments)
- API communicates via **JSON**; dates in ISO 8601
- Files uploaded via `multipart/form-data`, stored in `uploads/`

### Naming
- Frontend: `camelCase` for variables/functions, `PascalCase` for components
- Backend: `camelCase` for fields, `PascalCase` for classes, REST endpoints in `kebab-case`
- DTOs: `*Request` for incoming, `*Response` for outgoing

### Adding a New Entity
Follow the checklist in `Project/electro/docs/ENTITY_SCAFFOLD.md`:
1. JPA Entity → 2. Repository → 3. DTOs (Request + Response) → 4. Service → 5. Controllers (public + admin) → 6. TestDataInitializer → 7. Frontend API + pages

---

## Domain

The project is designed for **electrical design engineers** and operates according to the **TKP 339-2022 standard** (Republic of Belarus).

### Key Concepts
- **Project** — design object (apartment/house) with parameters (grounding system, voltage)
- **Room** — a room with type (kitchen, bedroom, bathroom), area, and power coefficients
- **Appliance** — specific equipment model from the catalog (power, current, voltage, price)
- **Electrical Point** — outlet/switch/light fixture on the floor plan
- **Electrical Symbol** — symbolic notation per TKP 339 (SVG)
- **Circuit** — group of electrical points with circuit breaker and RCD
- **Cable Run** — cable routing path
- **Specification** — final equipment and materials list with prices
- **Load Calculation** — calculation of total power, currents, cable cross-sections

### TKP 339 — Key Rules
- Minimum number of outlets depends on room type
- Bathrooms have safety zones (0, 1, 2, 3) with IP-rating restrictions
- Separate lines are mandatory for high-power appliances (electric stove, water heater)
- RCD is mandatory for wet rooms
- Cable cross-section calculation based on allowable current

---

## Constraints and Notes
- Maximum upload file size: **10 MB**
- Currency: **BYN** (Belarusian ruble), conversion from USD via NBRB API
- Email sent via Yandex SMTP (electrocalc@yandex.ru)
- Backend tests are minimal (one context test), coverage needs expansion
