# Electro Backend — Copilot Instructions

## Overview

Spring Boot 3.5.7, Java 17, PostgreSQL 15. REST API on port 8080.

**Key Dependencies (pom.xml):**
- Spring Boot: Web, Data JPA, Security, Validation, WebSocket, Mail
- PostgreSQL (runtime) + H2 (tests)
- JWT: `io.jsonwebtoken` v0.12.3 (jjwt-api, jjwt-impl, jjwt-jackson)
- PDF: iText 7 v8.0.2 (html2pdf)
- Excel: Apache POI v5.2.5 (poi-ooxml)
- Lombok

---

## Package Structure

```
src/main/java/com/verchuk/electro/
├── ElectroApplication.java         # @SpringBootApplication — entry point
├── config/
│   ├── DataInitializer.java        # @Order(1) — roles, admin, symbols, cables
│   ├── TestDataInitializer.java    # Test data (if APP_TEST_DATA_ENABLED=true)
│   ├── MailConfig.java             # Yandex SMTP (smtp.yandex.ru:465)
│   ├── WebSocketConfig.java        # STOMP + SockJS, /ws endpoint
│   └── WebSocketSecurityConfig.java
├── security/
│   ├── SecurityConfig.java         # CORS, role-based access, BCrypt, STATELESS
│   ├── JwtUtils.java               # HMAC-SHA-512, 24h expiry
│   ├── JwtAuthenticationFilter.java # OncePerRequestFilter — token validation
│   ├── AuthEntryPointJwt.java      # 401 handling
│   └── UserDetailsServiceImpl.java  # loadUserByUsername from DB
├── controller/                      # 26 REST controllers
├── service/                         # 30 services (business logic)
├── repository/                      # 19 JPA repositories
├── model/                           # 21 JPA entities
├── dto/
│   ├── request/                     # 21 request DTOs (with jakarta.validation)
│   └── response/                    # 32 response DTOs
└── exception/
    ├── GlobalExceptionHandler.java  # @RestControllerAdvice
    ├── ResourceNotFoundException.java
    └── BadRequestException.java
```

---

## Configuration (`application.properties`)

```properties
# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/electrodb
spring.datasource.username=postgres
spring.datasource.password=1111
spring.jpa.hibernate.ddl-auto=update

# Server
server.port=8080

# JWT
app.jwt.secret=<256+ bit key>
app.jwt.expiration-ms=86400000    # 24 hours

# Files
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB

# Test Data
app.test-data.enabled=true

# CORS — all origins allowed (restricted via nginx in Docker)
```

In Docker: DB → `jdbc:postgresql://db:5432/electrodb`, password `123`.

---

## Authentication and Security

### Authorization Flow
1. `POST /api/auth/login` → `AuthService.login()` → `AuthenticationManager.authenticate()`
2. JWT generation: `JwtUtils.generateToken(username)` → HMAC-SHA-512
3. Response: `JwtResponse { token, type="Bearer", id, username, email, roles[] }`
4. Frontend stores token in `localStorage`
5. Each request: `Authorization: Bearer <token>`
6. `JwtAuthenticationFilter` (OncePerRequestFilter) validates token
7. `SecurityConfig` checks role for endpoint

### Role Model
| Role | Access |
|------|--------|
| **DESIGNER** | `/api/designer/**`, `/api/chat/**`, catalogs (read-only) |
| **ADMIN** | All above + `/api/admin/**` |

### SecurityConfig — Key Rules
```java
.requestMatchers("/api/auth/**").permitAll()
.requestMatchers("/api/admin/**").hasRole("ADMIN")
.requestMatchers("/api/designer/**").hasAnyRole("DESIGNER", "ADMIN")
.requestMatchers("/api/chat/**").hasAnyRole("DESIGNER", "ADMIN")
.requestMatchers("/ws/**").authenticated()
.anyRequest().authenticated()
```

Sessions: `STATELESS`. CORS: all origins. CSRF: disabled (JWT). Passwords: BCrypt.

---

## REST-контроллеры (26)

### Авторизация
| Контроллер | Базовый путь | Эндпоинты |
|------------|-------------|-----------|
| AuthController | `/api/auth` | `POST /register`, `POST /login` |

### Дизайнерские операции
| Контроллер | Базовый путь | Эндпоинты |
|------------|-------------|-----------|
| ProjectController | `/api/designer/projects` | CRUD: GET, POST, PUT, DELETE |
| RoomController | `/api/designer/projects/{projectId}/rooms` | CRUD + `GET /{roomId}/walls` |
| CalculationController | `/api/designer/projects/{projectId}/calculations` | `GET /` — отчёт расчёта |
| CircuitController | `/api/designer/projects/{projectId}/circuits` | CRUD |
| SpecificationController | — | Генерация спецификации |
| SavedSpecificationController | — | Сохранение/загрузка/сравнение |
| FloorPlanController | — | Управление планом этажа |
| ElectricalPointController | — | CRUD электрических точек |
| WallController | — | CRUD стен |
| CableRunController | — | CRUD кабельных трасс |
| ProjectApplianceController | — | Привязка приборов к проекту |
| PdfExportController | `/api/designer/projects/{projectId}` | `GET /export/specification.pdf`, `GET /export/calculation.pdf`, `POST /send-email` |

### Каталоги (read-only для авторизованных)
| Контроллер | Базовый путь |
|------------|-------------|
| ApplianceController | `/api/appliances` |
| ManufacturerController | `/api/manufacturers` |
| CategoryController | `/api/categories` |
| RoomTypeController | `/api/room-types` |
| CableTypeController | `/api/cable-types` |
| ElectricalSymbolController | `/api/electrical-symbols` |

### Файлы и чат
| Контроллер | Базовый путь | Назначение |
|------------|-------------|------------|
| FileController | `/api/files` | `POST /upload`, `GET /{filename}`, `DELETE /{filename}` |
| ChatController | `/api/chat` | CRUD сообщений + `@MessageMapping("/send")` → `/topic/messages` |

### Админ-операции (ADMIN only)
| Контроллер | Базовый путь | Назначение |
|------------|-------------|------------|
| AdminController | `/api/admin` | CRUD: users, appliances, room-types, projects + статистика |
| AdminCableTypeController | `/api/admin/cable-types` | CRUD типов кабелей |
| AdminManufacturerController | `/api/admin/manufacturers` | CRUD + Excel import/export |
| AdminApplianceExcelController | — | Excel import/export приборов |
| UserController | `/api/user` | Профиль текущего пользователя |

---

## JPA-сущности (21)

### Ядро
| Сущность | Ключевые поля | Связи |
|----------|---------------|-------|
| **User** | username, email, password, firstName, lastName, photoUrl, enabled | ManyToMany → Role, OneToMany → Project |
| **Role** | name (DESIGNER / ADMIN) | ManyToMany → User |
| **Project** | name, description, groundingSystem, inputVoltage, inputPhaseCount, totalArea | ManyToOne → User, OneToMany → Room, ProjectAppliance |
| **Room** | name, area, windowCount, socketGroups, positionX/Y, width, height, polygonPoints (JSON) | ManyToOne → RoomType, Project; OneToMany → ElectricalPoint |
| **RoomType** | name, description, minCoefficient, maxCoefficient | — |

### Каталог
| Сущность | Ключевые поля |
|----------|---------------|
| **Appliance** | name, powerConsumption, voltage, current, price, ipRating, imageUrl, active | ManyToOne → Manufacturer, ManyToMany → Category |
| **Manufacturer** | name, legalName, logoUrl, email, websiteUrl, social* | OneToMany → Appliance |
| **Category** | name, description | ManyToMany → Appliance |
| **ProjectAppliance** | quantity (default 1), totalPower | ManyToOne → Project, Appliance, Room |

### Электрическая инфраструктура
| Сущность | Ключевые поля |
|----------|---------------|
| **ElectricalPoint** | positionX/Y, heightFromFloor, rotation, group, ratedPowerW, installationScope | ManyToOne → FloorPlan, Room, ElectricalSymbol, Circuit, CableType |
| **ElectricalSymbol** | name, svgPath, type (outlet/switch/light/panel/junction_box), category, price, ipRating | — |
| **Circuit** | name, breakerRatingA, rcdRatingMa, phase, installationScope | ManyToOne → Project |
| **CableType** | name, material (Cu/Al), crossSectionMm2, pricePerMeter, active | — |
| **CableRun** | — | Связи с Circuit, Wall |

### План этажа
| Сущность | Ключевые поля |
|----------|---------------|
| **FloorPlan** | width/height (см, default 1000×800), scale | OneToOne → Project, OneToMany → Wall, ElectricalPoint |
| **Wall** | startX/Y, endX/Y, thickness (default 20), wallType | ManyToOne → FloorPlan, Room; OneToMany → WallOpening |
| **WallOpening** | — | ManyToOne → Wall |

### Прочее
| Сущность | Назначение |
|----------|------------|
| **SavedSpecification** | JSON-снимок спецификации и расчёта (для сравнения версий) |
| **ChatMessage** | Сообщения чата поддержки |
| **InstallationScope** (enum) | PLANNED / INSTALLED |
| **PlacementRule** | Правила размещения приборов |

---

## Сервисы (30)

### Ключевые сервисы расчётов
| Сервис | Назначение |
|--------|------------|
| **CalculationService** | Главный расчётный движок: мощность, ток, стоимость, длины кабелей |
| **CalculationNormsProvider** | Нормативные коэффициенты для расчётов |
| **TKP339CalculationService** | Расчёты по стандарту ТКП 339-2022 |
| **TKP339ValidationService** | Валидация по ТКП 339 |
| **Tkp339NormsProvider** | Нормы и правила ТКП 339 |
| **SpecificationService** | Генерация ведомости оборудования |
| **SavedSpecificationService** | Сохранение/загрузка снимков спецификаций |
| **ElectricalSymbolSelectorService** | Автоподбор символов по типу помещения и зоне |

### Экспорт и интеграции
| Сервис | Назначение |
|--------|------------|
| **PdfExportService** | Генерация PDF (iText HTML2PDF) |
| **ExcelDataExchangeService** | Excel import/export (Apache POI) |
| **EmailService** | Отправка документов на email (Yandex SMTP) |
| **FileService** | Загрузка/скачивание файлов (`uploads/` директория) |

### CRUD-сервисы
AuthService, UserService, ProjectService, RoomService, RoomTypeService, ApplianceService, ManufacturerService, CategoryService, ProjectApplianceService, ElectricalPointService, ElectricalSymbolService, CircuitService, CableRunService, CableTypeService, WallService, FloorPlanService, ChatService, StatisticsService.

---

## DTO Conventions

### Request DTO (21)
- Package: `dto/request/`
- Suffix: `*Request` (e.g. `ProjectRequest`, `RoomRequest`)
- Validation: `jakarta.validation` (`@NotBlank`, `@NotNull`, `@Min`, `@Max`, `@Email`)

### Response DTO (32)
- Package: `dto/response/`
- Suffix: `*Response` (e.g. `ProjectResponse`, `JwtResponse`)
- Key: `JwtResponse` (token + user + roles), `CalculationReportResponse` (full calculation), `SpecificationResponse` (specification), `ProjectSnapshotResponse` (project snapshot)

---

## WebSocket

```java
@EnableWebSocketMessageBroker
// Endpoint: /ws (SockJS fallback)
// SimpleBroker: /topic, /queue
// App destination prefix: /app
// Topics: /topic/messages, /topic/messages/deleted
```

`ChatController.@MessageMapping("/send")` → process → publish to `/topic/messages`.

---

## Data Initialization

### DataInitializer (@Order(1))
Always runs:
- Roles: DESIGNER, ADMIN
- Admin: `admin` / `admin123` (BCrypt)
- Electrical symbols with prices and SVG paths
- Cable types (various standards)
- Room type coefficients (default 1.0)

### TestDataInitializer
When `app.test-data.enabled=true` — additional test data.

---

## Error Handling

`GlobalExceptionHandler` (@RestControllerAdvice):
- `ResourceNotFoundException` → 404
- `BadRequestException` → 400
- `MethodArgumentNotValidException` → 400 (with validation details)
- `AccessDeniedException` → 403
- Other → 500

---

## File Storage

```
uploads/
├── appliances/       # Appliance images
├── manufacturers/    # Manufacturer logos
├── profiles/         # User photos
├── chat/             # Chat attachments
└── general/          # Other files
```

Upload: `POST /api/files/upload` (multipart, max 10MB). Download: `GET /api/files/{filename}`.

---

## Docker Build

Multi-stage:
1. `maven:3.9.6-amazoncorretto-17` — `mvn clean package -DskipTests` (retry 5×)
2. `amazoncorretto:17-alpine-jdk` — `java -jar app.jar`
3. Port: 8080, volume: `uploads/`

---

## Tests

Minimal coverage:
- `ElectroApplicationTests.java` — Spring context loading
- Framework: JUnit 5, Spring Security Test
- **Coverage needs expansion** (unit + integration tests)

---

## Patterns and Conventions

### Architectural
- **Layered Architecture**: Controller → Service → Repository → JPA Entity
- **DTO Mapping**: Controller converts Entity ↔ DTO (manual, no MapStruct)
- **Stateless REST**: JWT, no server sessions
- **Cascade Deletion**: projects → rooms → points (via JPA `cascade`)

### Naming
- Classes: `PascalCase` (e.g. `ProjectController`, `CalculationService`)
- Fields/Methods: `camelCase`
- REST paths: `kebab-case` (e.g. `/cable-types`, `/floor-plan`)
- DTOs: `*Request` (input), `*Response` (output)
- Controllers: `*Controller`
- Services: `*Service`
- Repositories: `*Repository`

### When Adding a New Entity
File `docs/ENTITY_SCAFFOLD.md`:
1. JPA Entity (@Entity, @Table, fields, active flag)
2. JpaRepository with custom queries
3. Request/Response DTOs with validation
4. Service with CRUD + business logic
5. Controllers (public `/api/...` + admin `/api/admin/...`)
6. DataInitializer / TestDataInitializer
7. Frontend API + pages
8. Excel import/export (optional)
9. File upload (optional)
