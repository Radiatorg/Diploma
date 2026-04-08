# Чеклист: новая сущность + связь с приборами

Используйте как шаблон при добавлении доменных моделей (пример в проекте: **Manufacturer** ↔ **Appliance**).

## 1. База и модель (JPA)

- [ ] Сущность в `com.verchuk.electro.model.*` с `@Entity`, `@Table`, полями и `active` при необходимости.
- [ ] Связь с `Appliance` (или другой сущностью): `@ManyToOne` / `@OneToMany`, `nullable = true` для мягкой миграции.
- [ ] `spring.jpa.hibernate.ddl-auto=update` создаст колонки; для продакшена лучше Flyway/Liquibase.

## 2. Репозиторий

- [ ] `*Repository extends JpaRepository<…, Long>` с нужными `findBy*` / `@Query`.

## 3. DTO

- [ ] `*Request` — валидация (`jakarta.validation`).
- [ ] `*Response` и при необходимости `*SummaryResponse` для вложения в другие ответы.

## 4. Сервис

- [ ] Бизнес-логика, маппинг entity → DTO.
- [ ] Проверки удаления (например, «нельзя удалить, если есть ссылки»).

## 5. Контроллеры

- [ ] Публичные/read-only API под `/api/...` (роль по `SecurityConfig`).
- [ ] Админ CRUD под `/api/admin/...` (`hasRole("ADMIN")`).

## 6. Связанные сервисы

- [ ] Обновить маппинг в `ApplianceService` (или аналоге): установка связи при create/update, поле в `*Response`.
- [ ] При необходимости — `TestDataInitializer`: создание справочника и привязка к тестовым приборам.

## 7. Фронтенд

- [ ] `src/api/api.js` — методы API.
- [ ] Страницы/модалки, маршруты в `App.js`.
- [ ] `AdminNavPanel` — пункт меню.
- [ ] Константа **`REACT_APP_API_ORIGIN`** (см. `src/utils/apiOrigin.js`) для Docker/продакшена.

## 8. Excel (если нужно)

- [ ] Колонки в `ExcelDataExchangeService`: заголовки первой строки = контракт.
- [ ] Импорт: построчные ошибки в `ExcelImportResultResponse`.

## 9. Файлы (фото)

- [ ] Подкаталог в `FileService` (`uploads/<type>/`) + поиск в `loadFile` / `deleteFile`.

---

**Быстрый ориентир по файлам для производителя:**  
`Manufacturer.java`, `ManufacturerRepository.java`, `ManufacturerService.java`, `ManufacturerController.java`, `AdminManufacturerController.java`, поле `manufacturer` в `Appliance.java`, правки `ApplianceService` / DTO, `TestDataInitializer`, фронт: `AdminManufacturers.js`, `ManufacturerDetail.js`, `api.js`.
