package com.verchuk.electro.config;

import com.verchuk.electro.model.*;
import com.verchuk.electro.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.*;

/**
 * Инициализатор тестовых данных для разработки и тестирования
 * Запускается после основного DataInitializer
 */
@Component
@Order(2)
public class TestDataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ApplianceRepository applianceRepository;

    @Autowired
    private ManufacturerRepository manufacturerRepository;

    @Autowired
    private RoomTypeRepository roomTypeRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private ProjectApplianceRepository projectApplianceRepository;

    @Autowired
    private ElectricalSymbolRepository electricalSymbolRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Value("${app.test-data.enabled:true}")
    private boolean testDataEnabled;

    @Override
    public void run(String... args) {
        if (!testDataEnabled) {
            System.out.println("Test data initialization is disabled");
            return;
        }

        System.out.println("Starting test data initialization...");

        try {
            // Выполняем все в одной транзакции
            transactionTemplate.execute(status -> {
                try {
                    // 1. Создание тестовых пользователей
                    createTestUsers();

                    // 2. Создание категорий
                    Map<String, Category> categories = createCategories();

                    // 3. Производители и приборы
                    Map<String, Manufacturer> manufacturers = createManufacturers();
                    createAppliances(categories, manufacturers);

                    // 4. Создание типов помещений
                    Map<String, RoomType> roomTypes = createRoomTypes();

                    // 5. Создание тестовых проектов
                    createTestProjects(roomTypes);

                    System.out.println("Test data initialization completed successfully");
                    return null;
                } catch (Exception e) {
                    System.err.println("Error during test data initialization: " + e.getMessage());
                    e.printStackTrace();
                    status.setRollbackOnly();
                    throw new RuntimeException(e);
                }
            });
        } catch (Exception e) {
            System.err.println("Failed to initialize test data: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void createTestUsers() {
        Role designerRole = roleRepository.findByName(Role.RoleName.DESIGNER)
                .orElseThrow(() -> new RuntimeException("Designer role not found"));

        // Создаем тестового дизайнера
        if (!userRepository.existsByUsername("designer")) {
            Set<Role> roles = new HashSet<>();
            roles.add(designerRole);

            User designer = User.builder()
                    .username("designer")
                    .email("designer@electro.local")
                    .password(passwordEncoder.encode("designer123"))
                    .firstName("Иван")
                    .lastName("Петров")
                    .phoneNumber("+375291234567")
                    .birthDate(LocalDate.of(1985, 5, 15))
                    .enabled(true)
                    .roles(roles)
                    .build();

            userRepository.save(designer);
            System.out.println("Test designer user created: username=designer, password=designer123");
        }

        // Создаем еще одного дизайнера
        if (!userRepository.existsByUsername("designer2")) {
            Set<Role> roles = new HashSet<>();
            roles.add(designerRole);

            User designer2 = User.builder()
                    .username("designer2")
                    .email("designer2@electro.local")
                    .password(passwordEncoder.encode("designer123"))
                    .firstName("Мария")
                    .lastName("Сидорова")
                    .phoneNumber("+375292345678")
                    .birthDate(LocalDate.of(1990, 8, 20))
                    .enabled(true)
                    .roles(roles)
                    .build();

            userRepository.save(designer2);
            System.out.println("Test designer2 user created: username=designer2, password=designer123");
        }
    }

    private Map<String, Category> createCategories() {
        Map<String, Category> categoryMap = new HashMap<>();

        String[] categoryNames = {
                "Кухонная техника",
                "Бытовая техника",
                "Бытовая электроника",
                "Водонагревательное оборудование",
                "Стиральная техника",
                "Отопительное оборудование",
                "Осветительное оборудование"
        };

        for (String name : categoryNames) {
            Category category = categoryRepository.findByName(name)
                    .orElseGet(() -> {
                        Category newCategory = Category.builder()
                                .name(name)
                                .description("Категория: " + name)
                                .build();
                        return categoryRepository.save(newCategory);
                    });
            categoryMap.put(name, category);
        }

        System.out.println("Categories created/verified: " + categoryMap.size());
        return categoryMap;
    }

    /**
     * Тестовые производители для привязки к каталогу приборов.
     */
    private Map<String, Manufacturer> createManufacturers() {
        Map<String, Manufacturer> map = new HashMap<>();
        record M(String key, String name, String email, String site) {}
        List<M> defs = Arrays.asList(
                new M("Samsung", "Samsung", "support@samsung.com", "https://www.samsung.com"),
                new M("Bosch", "Bosch", "info@bosch.com", "https://www.bosch.com"),
                new M("Philips", "Philips", "support@philips.com", "https://www.philips.com"),
                new M("Dyson", "Dyson", "askdyson@dyson.com", "https://www.dyson.com"),
                new M("Lenovo", "Lenovo", "lenovo@lenovo.com", "https://www.lenovo.com"),
                new M("Ariston", "Ariston", "info@ariston.com", "https://www.ariston.com"),
                new M("LG", "LG", "support@lg.com", "https://www.lg.com"),
                new M("Indesit", "Indesit", "info@indesit.com", "https://www.indesit.com"),
                new M("Korting", "Korting", "info@korting.ru", "https://www.korting.ru"),
                new M("Tefal", "Tefal", "info@tefal.com", "https://www.tefal.com"),
                new M("Sony", "Sony", "support@sony.com", "https://www.sony.com"),
                new M("HP", "HP", "support@hp.com", "https://www.hp.com")
        );
        for (M d : defs) {
            Manufacturer m = manufacturerRepository.findByNameIgnoreCase(d.name)
                    .orElseGet(() -> manufacturerRepository.save(Manufacturer.builder()
                            .name(d.name)
                            .description("Демо-производитель для тестовых данных ElectroPlanner")
                            .email(d.email)
                            .websiteUrl(d.site)
                            .active(true)
                            .build()));
            map.put(d.key, m);
        }
        System.out.println("Manufacturers created/verified: " + map.size());
        return map;
    }

    private Manufacturer guessManufacturer(String applianceName, Map<String, Manufacturer> manufacturers) {
        if (applianceName == null) {
            return null;
        }
        String n = applianceName.toLowerCase(Locale.ROOT);
        if (n.contains("samsung")) return manufacturers.get("Samsung");
        if (n.contains("bosch")) return manufacturers.get("Bosch");
        if (n.contains("philips")) return manufacturers.get("Philips");
        if (n.contains("dyson")) return manufacturers.get("Dyson");
        if (n.contains("lenovo")) return manufacturers.get("Lenovo");
        if (n.contains("ariston")) return manufacturers.get("Ariston");
        if (n.contains(" lg") || n.contains("lg ")) return manufacturers.get("LG");
        if (n.contains("indesit")) return manufacturers.get("Indesit");
        if (n.contains("korting")) return manufacturers.get("Korting");
        if (n.contains("tefal")) return manufacturers.get("Tefal");
        if (n.contains("playstation") || n.contains("sony")) return manufacturers.get("Sony");
        if (n.contains(" hp") || n.contains("hp laser")) return manufacturers.get("HP");
        return null;
    }

    private void createAppliances(Map<String, Category> categories, Map<String, Manufacturer> manufacturers) {
        // Приборы из файла ГОТОВЫЕ_ПРИБОРЫ_ДЛЯ_КОПИРОВАНИЯ.txt
        List<ApplianceData> appliances = Arrays.asList(
                new ApplianceData("Микроволновка Samsung ME83KRW", 1200, 220, 5.5, 450.00,
                        "Samsung ME83KRW", "IP20", "Кухонная техника", "Микроволны.jpg"),
                new ApplianceData("Электрический чайник Bosch TWK8611", 2400, 220, 10.9, 120.00,
                        "Bosch TWK8611", "IPX4", "Кухонная техника", "чайник.jpg"),
                new ApplianceData("Утюг Philips GC5030", 2400, 220, 10.9, 150.00,
                        "Philips GC5030", "IP20", "Бытовая техника", "утюг.jpg"),
                new ApplianceData("Пылесос Dyson V15", 600, 220, 2.7, 800.00,
                        "Dyson V15 Detect", "IP20", "Бытовая техника", "пылесос.jpg"),
                new ApplianceData("Телевизор Samsung QE55Q70A", 150, 220, 0.7, 1200.00,
                        "Samsung QE55Q70A", "IP20", "Бытовая электроника", "телевизор.jpg"),
                new ApplianceData("Ноутбук Lenovo ThinkPad X1", 65, 220, 0.3, 1500.00,
                        "Lenovo ThinkPad X1 Carbon", "IP20", "Бытовая электроника", "ноут.jpg"),
                new ApplianceData("Электрический водонагреватель Ariston ABS VLS", 2000, 220, 9.1, 600.00,
                        "Ariston ABS VLS 50", "IPX4", "Водонагревательное оборудование", "электроводогрелка.jpg"),
                new ApplianceData("Электрическая духовка Bosch HBN331E1", 3500, 220, 15.9, 900.00,
                        "Bosch HBN331E1", "IP20", "Кухонная техника", "духовка.jpg"),
                new ApplianceData("Сушильная машина LG RC90V9AV2W", 2500, 220, 11.4, 1800.00,
                        "LG RC90V9AV2W", "IPX4", "Стиральная техника", "сушилка.jpg"),
                // Дополнительные приборы
                new ApplianceData("Холодильник Samsung RB33J3000SA", 150, 220, 0.7, 1200.00,
                        "Samsung RB33J3000SA", "IP20", "Кухонная техника", "fridge.jpg"),
                new ApplianceData("Стиральная машина LG F2J6HS0W", 2100, 220, 9.5, 1100.00,
                        "LG F2J6HS0W", "IPX4", "Стиральная техника", "stiralka.jpg"),
                new ApplianceData("Морозильная камера Indesit DF 5180 W", 200, 220, 0.9, 800.00,
                        "Indesit DF 5180 W", "IP20", "Кухонная техника", "Морозильная камера.jpg"),
                new ApplianceData("Блендер Bosch MSM67170", 750, 220, 3.4, 200.00,
                        "Bosch MSM67170", "IPX4", "Кухонная техника", "Блендер.jpg"),
                new ApplianceData("Вытяжка Korting KDI 6050 X", 200, 220, 0.9, 400.00,
                        "Korting KDI 6050 X", "IP20", "Кухонная техника", "Вытяжка.jpg"),
                new ApplianceData("Тостер Tefal TT1D10", 900, 220, 4.1, 150.00,
                        "Tefal TT1D10", "IP20", "Кухонная техника", "Тостер.jpg"),
                new ApplianceData("Электрический гриль Tefal GC306012", 2000, 220, 9.1, 350.00,
                        "Tefal GC306012", "IP20", "Кухонная техника", "Электрический гриль.jpg"),
                new ApplianceData("Светильник LED Philips Hue", 10, 220, 0.05, 250.00,
                        "Philips Hue White", "IP20", "Осветительное оборудование", "Светильник LED.jpg"),
                new ApplianceData("Игровая консоль PlayStation 5", 350, 220, 1.6, 800.00,
                        "PlayStation 5", "IP20", "Бытовая электроника", "Игровая консоль PlayStation 5.jpg"),
                new ApplianceData("Принтер HP LaserJet Pro M404dn", 300, 220, 1.4, 500.00,
                        "HP LaserJet Pro M404dn", "IP20", "Бытовая электроника", "Принтер HP LaserJet Pro M404dn.jpg")
        );

        for (ApplianceData data : appliances) {
            if (!applianceRepository.findByActiveTrue().stream()
                    .anyMatch(a -> a.getName().equals(data.name))) {

                // Загружаем категории заново в текущей транзакции, чтобы они были managed entities
                Set<Category> applianceCategories = new HashSet<>();
                String[] categoryNames = data.categories.split(",");
                for (String catName : categoryNames) {
                    catName = catName.trim();
                    // Загружаем категорию заново из базы, чтобы она была managed entity
                    categoryRepository.findByName(catName).ifPresent(applianceCategories::add);
                }

                String imageUrl = copyImageToUploads(data.imageFileName);
                Manufacturer mfr = guessManufacturer(data.name, manufacturers);

                // Создаем прибор сначала без категорий (как в ApplianceService)
                Appliance appliance = Appliance.builder()
                        .name(data.name)
                        .description(null)
                        .powerConsumption(BigDecimal.valueOf(data.powerW))
                        .voltage(BigDecimal.valueOf(data.voltage))
                        .current(BigDecimal.valueOf(data.current))
                        .price(BigDecimal.valueOf(data.price))
                        .model(data.model)
                        .ipRating(data.ipRating)
                        .color("Белый")
                        .width(BigDecimal.valueOf(40))
                        .height(BigDecimal.valueOf(40))
                        .imageUrl(imageUrl)
                        .manufacturer(mfr)
                        .active(true)
                        .categories(new HashSet<>())
                        .build();

                // Сохраняем прибор сначала
                appliance = applianceRepository.save(appliance);
                
                // Затем добавляем категории через getCategories().addAll() (правильный способ для ManyToMany)
                appliance.getCategories().addAll(applianceCategories);
                
                // Сохраняем снова с категориями
                applianceRepository.save(appliance);
                System.out.println("Created appliance: " + data.name);
            }
        }

        System.out.println("Appliances created/verified: " + appliances.size());
    }

    private String copyImageToUploads(String imageFileName) {
        try {
            // Путь к папке uploads/appliances - проверяем несколько вариантов
            Path uploadsDir = null;
            String workingDir = System.getProperty("user.dir");
            
            // Вариант 1: В Docker контейнере (относительно /app)
            Path dockerUploads = Paths.get("/app", "uploads", "appliances");
            if (Files.exists(Paths.get("/app"))) {
                uploadsDir = dockerUploads;
            }
            
            // Вариант 2: Локально в рабочей директории
            if (uploadsDir == null) {
                Path localUploads1 = Paths.get(workingDir, "uploads", "appliances").toAbsolutePath().normalize();
                if (Files.exists(localUploads1.getParent()) || Files.exists(localUploads1)) {
                    uploadsDir = localUploads1;
                }
            }
            
            // Вариант 3: В родительской директории (если запускаем из target)
            if (uploadsDir == null) {
                Path parentUploads = Paths.get(workingDir, "..", "uploads", "appliances").toAbsolutePath().normalize();
                if (Files.exists(parentUploads)) {
                    uploadsDir = parentUploads;
                }
            }
            
            // Если не нашли, создаем в рабочей директории
            if (uploadsDir == null) {
                uploadsDir = Paths.get(workingDir, "uploads", "appliances").toAbsolutePath().normalize();
            }

            Files.createDirectories(uploadsDir);

            // Ищем исходный файл в uploads/appliances (где он уже должен быть)
            Path sourceFile = null;
            
            // Вариант 1: В Docker контейнере в uploads/appliances
            Path dockerSource = Paths.get("/app", "uploads", "appliances", imageFileName);
            if (Files.exists(dockerSource)) {
                sourceFile = dockerSource;
            }
            
            // Вариант 2: Локально в uploads/appliances (в найденной директории)
            if (sourceFile == null || !Files.exists(sourceFile)) {
                Path localSource1 = uploadsDir.resolve(imageFileName);
                if (Files.exists(localSource1)) {
                    sourceFile = localSource1;
                }
            }
            
            // Вариант 3: В родительской директории uploads/appliances
            if (sourceFile == null || !Files.exists(sourceFile)) {
                Path parentSource = Paths.get(workingDir, "..", "uploads", "appliances", imageFileName).toAbsolutePath().normalize();
                if (Files.exists(parentSource)) {
                    sourceFile = parentSource;
                }
            }
            
            // Вариант 4: В папке images в Docker (для обратной совместимости)
            if (sourceFile == null || !Files.exists(sourceFile)) {
                Path imagesPath = Paths.get("/app", "images", imageFileName);
                if (Files.exists(imagesPath)) {
                    sourceFile = imagesPath;
                }
            }
            
            // Вариант 5: Локально в images (для обратной совместимости)
            if (sourceFile == null || !Files.exists(sourceFile)) {
                Path localImages = Paths.get(workingDir, "images", imageFileName).normalize();
                if (Files.exists(localImages)) {
                    sourceFile = localImages;
                }
            }
            
            // Вариант 6: В родительской директории images
            if (sourceFile == null || !Files.exists(sourceFile)) {
                Path parentImages = Paths.get(workingDir, "..", "images", imageFileName).toAbsolutePath().normalize();
                if (Files.exists(parentImages)) {
                    sourceFile = parentImages;
                }
            }

            if (sourceFile == null || !Files.exists(sourceFile)) {
                System.out.println("Warning: Image file not found: " + imageFileName + 
                    " (searched in uploads/appliances and images, workingDir=" + workingDir + ")");
                return null;
            }

            // Копируем файл с новым UUID именем в uploads/appliances
            String extension = "";
            int lastDotIndex = imageFileName.lastIndexOf('.');
            if (lastDotIndex > 0) {
                extension = imageFileName.substring(lastDotIndex);
            }
            String newFileName = UUID.randomUUID().toString() + extension;
            Path targetFile = uploadsDir.resolve(newFileName);

            Files.copy(sourceFile, targetFile, StandardCopyOption.REPLACE_EXISTING);
            System.out.println("Copied image: " + imageFileName + " -> " + newFileName + " (from " + sourceFile + " to " + uploadsDir + ")");

            // Возвращаем полный путь для сохранения в БД
            return "/api/files/" + newFileName;
        } catch (IOException e) {
            System.err.println("Error copying image file " + imageFileName + ": " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    private Map<String, RoomType> createRoomTypes() {
        Map<String, RoomType> roomTypeMap = new HashMap<>();

        List<RoomTypeData> roomTypes = Arrays.asList(
                new RoomTypeData("Жилая комната", "Стандартная жилая комната", 1.0, null),
                new RoomTypeData("Спальня", "Спальня", 1.0, null),
                new RoomTypeData("Гостиная", "Гостиная комната", 1.0, null),
                new RoomTypeData("Детская", "Детская комната", 1.0, null),
                new RoomTypeData("Кухня", "Кухня", 1.2, null),
                new RoomTypeData("Ванная", "Ванная комната", 0.5, null),
                new RoomTypeData("Санузел", "Санузел", 0.5, null),
                new RoomTypeData("Туалет", "Туалет", 0.5, null),
                new RoomTypeData("Прихожая", "Прихожая", 0.8, null),
                new RoomTypeData("Коридор", "Коридор", 0.8, null),
                new RoomTypeData("Балкон", "Балкон", 1.0, null),
                new RoomTypeData("Лоджия", "Лоджия", 1.0, null),
                new RoomTypeData("Кладовка", "Кладовка", 0.5, null),
                new RoomTypeData("Чердак", "Чердак", 0.5, null)
        );

        for (RoomTypeData data : roomTypes) {
            RoomType roomType = roomTypeRepository.findByName(data.name)
                    .orElseGet(() -> {
                        RoomType newRoomType = RoomType.builder()
                                .name(data.name)
                                .description(data.description)
                                .minCoefficient(BigDecimal.valueOf(data.minCoeff))
                                .maxCoefficient(data.maxCoeff != null ? BigDecimal.valueOf(data.maxCoeff) : null)
                                .build();
                        return roomTypeRepository.save(newRoomType);
                    });
            roomTypeMap.put(data.name, roomType);
        }

        System.out.println("Room types created/verified: " + roomTypeMap.size());
        return roomTypeMap;
    }

    private void createTestProjects(Map<String, RoomType> roomTypes) {
        Optional<User> designerOpt = userRepository.findByUsername("designer");
        if (designerOpt.isEmpty()) {
            designerOpt = userRepository.findByUsername("admin");
        }

        if (designerOpt.isEmpty()) {
            System.out.println("Warning: No designer or admin found, skipping project creation");
            return;
        }

        User designer = designerOpt.get();

        // Проект 1: Квартира 65 м²
        boolean project1Exists = projectRepository.findAll().stream()
                .anyMatch(p -> p.getName() != null && p.getName().contains("Квартира 65"));
        if (!project1Exists) {
            Project project1 = Project.builder()
                    .name("Квартира 65 м²")
                    .description("Тип: Квартира")
                    .designer(designer)
                    .groundingSystem("TN-S")
                    .inputVoltage(230)
                    .inputPhaseCount(1)
                    .build();
            project1 = projectRepository.save(project1);

            // Комнаты для проекта 1
            Room room1_1 = createRoom(project1, roomTypes.get("Гостиная"), "Гостиная", BigDecimal.valueOf(20), 100, 100, 400, 500);
            Room room1_2 = createRoom(project1, roomTypes.get("Спальня"), "Спальня", BigDecimal.valueOf(15), 100, 600, 300, 500);
            Room room1_3 = createRoom(project1, roomTypes.get("Кухня"), "Кухня", BigDecimal.valueOf(12), 500, 100, 400, 300);
            Room room1_4 = createRoom(project1, roomTypes.get("Ванная"), "Ванная", BigDecimal.valueOf(6), 500, 400, 200, 300);
            Room room1_5 = createRoom(project1, roomTypes.get("Прихожая"), "Прихожая", BigDecimal.valueOf(12), 100, 100, 400, 300);

            // Добавляем приборы в проект 1
            addAppliancesToProject(project1, room1_1, room1_2, room1_3, room1_4, room1_5);

            System.out.println("Created test project: Квартира 65 м²");
        }

        // Проект 2: Частный дом 120 м²
        boolean project2Exists = projectRepository.findAll().stream()
                .anyMatch(p -> p.getName() != null && p.getName().contains("Частный дом 120"));
        if (!project2Exists) {
            Project project2 = Project.builder()
                    .name("Частный дом 120 м²")
                    .description("Тип: Дом")
                    .designer(designer)
                    .groundingSystem("TN-C-S")
                    .inputVoltage(230)
                    .inputPhaseCount(1)
                    .build();
            project2 = projectRepository.save(project2);

            // Комнаты для проекта 2
            Room room2_1 = createRoom(project2, roomTypes.get("Гостиная"), "Гостиная", BigDecimal.valueOf(30), 100, 100, 600, 500);
            Room room2_2 = createRoom(project2, roomTypes.get("Спальня"), "Спальня 1", BigDecimal.valueOf(18), 100, 600, 400, 500);
            Room room2_3 = createRoom(project2, roomTypes.get("Спальня"), "Спальня 2", BigDecimal.valueOf(18), 500, 600, 400, 500);
            Room room2_4 = createRoom(project2, roomTypes.get("Кухня"), "Кухня", BigDecimal.valueOf(15), 500, 100, 400, 375);
            Room room2_5 = createRoom(project2, roomTypes.get("Ванная"), "Ванная", BigDecimal.valueOf(8), 900, 100, 300, 400);
            Room room2_6 = createRoom(project2, roomTypes.get("Туалет"), "Туалет", BigDecimal.valueOf(3), 900, 500, 150, 200);
            Room room2_7 = createRoom(project2, roomTypes.get("Прихожая"), "Прихожая", BigDecimal.valueOf(15), 100, 100, 400, 375);
            Room room2_8 = createRoom(project2, roomTypes.get("Кладовка"), "Кладовка", BigDecimal.valueOf(5), 900, 700, 200, 250);

            // Добавляем приборы в проект 2
            addAppliancesToProject(project2, room2_1, room2_2, room2_3, room2_4, room2_5, room2_6, room2_7, room2_8);

            System.out.println("Created test project: Частный дом 120 м²");
        }

        // Проект 3: Трехфазный дом (для тестирования валидаций)
        boolean project3Exists = projectRepository.findAll().stream()
                .anyMatch(p -> p.getName() != null && p.getName().contains("Трехфазный дом"));
        if (!project3Exists) {
            Project project3 = Project.builder()
                    .name("Трехфазный дом 150 м²")
                    .description("Тип: Дом")
                    .designer(designer)
                    .groundingSystem("TN-C-S")
                    .inputVoltage(400)
                    .inputPhaseCount(3)
                    .penConductorSection(BigDecimal.valueOf(16))
                    .build();
            project3 = projectRepository.save(project3);

            Room room3_1 = createRoom(project3, roomTypes.get("Гостиная"), "Гостиная", BigDecimal.valueOf(35), 100, 100, 700, 500);
            Room room3_2 = createRoom(project3, roomTypes.get("Кухня"), "Кухня", BigDecimal.valueOf(18), 100, 600, 500, 400);

            // Добавляем приборы в проект 3
            addAppliancesToProject(project3, room3_1, room3_2);

            System.out.println("Created test project: Трехфазный дом 150 м²");
        }
    }

    private Room createRoom(Project project, RoomType roomType, String name, BigDecimal area,
                           double posX, double posY, double width, double height) {
        // Определяем лимиты в зависимости от типа комнаты
        Integer maxOutlets = 5;
        Integer maxSwitches = 3;
        Integer maxDoors = 1;
        Integer maxWindows = 2;
        Integer maxLights = 2;

        String nameLC = name.toLowerCase(Locale.ROOT);
        if (nameLC.contains("кухн")) {
            maxOutlets = 8;
            maxSwitches = 4;
            maxDoors = 1;
            maxWindows = 1;
            maxLights = 3;
        } else if (nameLC.contains("ванн") || nameLC.contains("санузел") || nameLC.contains("туалет")) {
            maxOutlets = 3;
            maxSwitches = 1;
            maxDoors = 1;
            maxWindows = 1;
            maxLights = 2;
        } else if (nameLC.contains("прихож")) {
            maxOutlets = 3;
            maxSwitches = 2;
            maxDoors = 2;
            maxWindows = 1;
            maxLights = 2;
        } else if (nameLC.contains("кладов") || nameLC.contains("чердак")) {
            maxOutlets = 2;
            maxSwitches = 1;
            maxDoors = 1;
            maxWindows = 0;
            maxLights = 1;
        }

        Room room = Room.builder()
                .name(name)
                .area(area)
                .roomType(roomType)
                .project(project)
                .positionX(BigDecimal.valueOf(posX))
                .positionY(BigDecimal.valueOf(posY))
                .width(BigDecimal.valueOf(width))
                .height(BigDecimal.valueOf(height))
                .windowCount(1)
                .socketGroups(2)
                .socketsPerGroup(2)
                .socketGroupsConfig("[{\"socketsCount\":2},{\"socketsCount\":2}]")
                .maxOutlets(maxOutlets)
                .maxSwitches(maxSwitches)
                .maxDoors(maxDoors)
                .maxWindows(maxWindows)
                .maxLights(maxLights)
                .build();

        return roomRepository.save(room);
    }

    private void addAppliancesToProject(Project project, Room... rooms) {
        // Получаем все активные приборы
        List<Appliance> allAppliances = applianceRepository.findByActiveTrue();
        if (allAppliances.isEmpty()) {
            System.out.println("Warning: No active appliances found, skipping appliance addition to project: " + project.getName());
            return;
        }

        // Создаем карту комнат по типам для удобного поиска
        Map<String, List<Room>> roomsByType = new HashMap<>();
        for (Room room : rooms) {
            String roomTypeName = room.getRoomType() != null ? room.getRoomType().getName() : "unknown";
            roomsByType.computeIfAbsent(roomTypeName, k -> new ArrayList<>()).add(room);
        }

        int addedCount = 0;
        // Распределяем приборы по комнатам в зависимости от категорий
        for (Appliance appliance : allAppliances) {
            Room targetRoom = null;
            
            // Ищем подходящую комнату на основе категорий прибора
            if (appliance.getCategories() != null && !appliance.getCategories().isEmpty()) {
                for (Category category : appliance.getCategories()) {
                    String categoryName = category.getName();
                    
                    // Маппинг категорий на типы комнат
                    if (categoryName.contains("Кухонная")) {
                        List<Room> kitchens = roomsByType.get("Кухня");
                        if (kitchens != null && !kitchens.isEmpty()) {
                            targetRoom = kitchens.get(0);
                            break;
                        }
                    } else if (categoryName.contains("Стиральная") || categoryName.contains("Водонагревательное")) {
                        List<Room> bathrooms = roomsByType.get("Ванная");
                        if (bathrooms != null && !bathrooms.isEmpty()) {
                            targetRoom = bathrooms.get(0);
                            break;
                        }
                    } else if (categoryName.contains("Осветительное")) {
                        // Освещение можно добавить в любую комнату
                        if (rooms.length > 0) {
                            targetRoom = rooms[0];
                            break;
                        }
                    } else {
                        // Для остальных категорий добавляем в первую доступную комнату
                        if (rooms.length > 0) {
                            targetRoom = rooms[0];
                            break;
                        }
                    }
                }
            }
            
            // Если не нашли подходящую комнату, добавляем в первую доступную
            if (targetRoom == null && rooms.length > 0) {
                targetRoom = rooms[0];
            }

            // Создаем финальную переменную для использования в лямбде
            final Room finalTargetRoom = targetRoom;
            final Long targetRoomId = finalTargetRoom != null ? finalTargetRoom.getId() : null;

            // Проверяем, не добавлен ли уже этот прибор в проект
            boolean alreadyExists = projectApplianceRepository.findByProject(project).stream()
                    .anyMatch(pa -> pa.getAppliance().getId().equals(appliance.getId()) && 
                                  (targetRoomId == null ? pa.getRoom() == null : 
                                   (pa.getRoom() != null && pa.getRoom().getId().equals(targetRoomId))));

            if (!alreadyExists) {
                BigDecimal totalPower = appliance.getPowerConsumption().multiply(BigDecimal.valueOf(1));
                
                ProjectAppliance projectAppliance = ProjectAppliance.builder()
                        .project(project)
                        .appliance(appliance)
                        .room(finalTargetRoom)
                        .quantity(1)
                        .totalPower(totalPower)
                        .build();

                projectApplianceRepository.save(projectAppliance);
                addedCount++;
            }
        }

        System.out.println("Added " + addedCount + " appliances to project: " + project.getName());
    }

    // Вспомогательные классы для данных
    private static class ApplianceData {
        String name;
        double powerW;
        double voltage;
        double current;
        double price;
        String model;
        String ipRating;
        String categories;
        String imageFileName;

        ApplianceData(String name, double powerW, double voltage, double current, double price,
                     String model, String ipRating, String categories, String imageFileName) {
            this.name = name;
            this.powerW = powerW;
            this.voltage = voltage;
            this.current = current;
            this.price = price;
            this.model = model;
            this.ipRating = ipRating;
            this.categories = categories;
            this.imageFileName = imageFileName;
        }
    }

    private static class RoomTypeData {
        String name;
        String description;
        double minCoeff;
        Double maxCoeff;

        RoomTypeData(String name, String description, double minCoeff, Double maxCoeff) {
            this.name = name;
            this.description = description;
            this.minCoeff = minCoeff;
            this.maxCoeff = maxCoeff;
        }
    }
}

