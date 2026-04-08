package com.verchuk.electro.config;

import com.verchuk.electro.model.ElectricalSymbol;
import com.verchuk.electro.model.CableType;
import com.verchuk.electro.model.Role;
import com.verchuk.electro.model.RoomType;
import com.verchuk.electro.model.User;
import com.verchuk.electro.repository.CableTypeRepository;
import com.verchuk.electro.repository.ElectricalSymbolRepository;
import com.verchuk.electro.repository.RoleRepository;
import com.verchuk.electro.repository.RoomTypeRepository;
import com.verchuk.electro.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
@Order(1)
public class DataInitializer implements CommandLineRunner {
    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoomTypeRepository roomTypeRepository;  

    @Autowired
    private ElectricalSymbolRepository electricalSymbolRepository;

    @Autowired
    private CableTypeRepository cableTypeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        ensureRoleExists(Role.RoleName.DESIGNER);
        ensureRoleExists(Role.RoleName.ADMIN);
        migrateLegacyRoles();

        // Создание администратора по умолчанию
        if (!userRepository.existsByUsername("admin")) {
            Role adminRole = roleRepository.findByName(Role.RoleName.ADMIN)
                    .orElseThrow(() -> new RuntimeException("Admin role not found"));

            Set<Role> roles = new HashSet<>();
            roles.add(adminRole);

            User admin = User.builder()
                    .username("admin")
                    .email("admin@electro.local")
                    .password(passwordEncoder.encode("admin123"))
                    .firstName("Admin")
                    .lastName("User")
                    .phoneNumber("+79991234567")
                    .birthDate(LocalDate.of(1990, 1, 1))
                    .enabled(true)
                    .roles(roles)
                    .build();

            userRepository.save(admin);
            System.out.println("Default admin user created: username=admin, password=admin123");
        }

        // Инициализация коэффициентов для существующих типов помещений
        // Если у типа помещения нет коэффициента, устанавливаем значение по умолчанию 1.0
        roomTypeRepository.findAll().forEach(roomType -> {
            if (roomType.getMinCoefficient() == null) {
                roomType.setMinCoefficient(BigDecimal.valueOf(1.0));
                roomTypeRepository.save(roomType);
                System.out.println("Updated room type '" + roomType.getName() + "' with default coefficient 1.0");
            }
        });

        // Инициализация базовых электрических символов
        initializeElectricalSymbols();
        initializeCableTypes();
    }

    private void initializeElectricalSymbols() {
        // Розетка
        electricalSymbolRepository.findByName("Розетка").ifPresentOrElse(
                symbol -> {
                    // Обновляем существующий символ, если нет цены
                    if (symbol.getPrice() == null) {
                        symbol.setPrice(BigDecimal.valueOf(250));
                        symbol.setModel("Legrand Valena");
                        symbol.setIpRating("IP44");
                        symbol.setColor("Белый");
                        electricalSymbolRepository.save(symbol);
                        System.out.println("Updated electrical symbol: Розетка (added price and specs)");
                    }
                },
                () -> {
                    ElectricalSymbol outlet = ElectricalSymbol.builder()
                            .name("Розетка")
                            .type("outlet")
                            .category("power")
                            .defaultWidth(16.0)
                            .defaultHeight(16.0)
                            .price(BigDecimal.valueOf(250))
                            .model("Legrand Valena")
                            .ipRating("IP44")
                            .color("Белый")
                            .active(true)
                            .build();
                    electricalSymbolRepository.save(outlet);
                    System.out.println("Created default electrical symbol: Розетка");
                }
        );

        // Лампа/Освещение
        electricalSymbolRepository.findByName("Лампа").ifPresentOrElse(
                symbol -> {
                    if (symbol.getPrice() == null) {
                        symbol.setPrice(BigDecimal.valueOf(350));
                        symbol.setModel("LED 60W");
                        symbol.setIpRating("IP20");
                        symbol.setColor("Белый");
                        electricalSymbolRepository.save(symbol);
                        System.out.println("Updated electrical symbol: Лампа (added price and specs)");
                    }
                },
                () -> {
                    ElectricalSymbol light = ElectricalSymbol.builder()
                            .name("Лампа")
                            .type("light")
                            .category("lighting")
                            .defaultWidth(16.0)
                            .defaultHeight(16.0)
                            .price(BigDecimal.valueOf(350))
                            .model("LED 60W")
                            .ipRating("IP20")
                            .color("Белый")
                            .active(true)
                            .build();
                    electricalSymbolRepository.save(light);
                    System.out.println("Created default electrical symbol: Лампа");
                }
        );

        // Выключатель
        electricalSymbolRepository.findByName("Выключатель").ifPresentOrElse(
                symbol -> {
                    if (symbol.getPrice() == null) {
                        symbol.setPrice(BigDecimal.valueOf(180));
                        symbol.setModel("Legrand Valena");
                        symbol.setIpRating("IP44");
                        symbol.setColor("Белый");
                        electricalSymbolRepository.save(symbol);
                        System.out.println("Updated electrical symbol: Выключатель (added price and specs)");
                    }
                },
                () -> {
                    ElectricalSymbol switchSymbol = ElectricalSymbol.builder()
                            .name("Выключатель")
                            .type("switch")
                            .category("control")
                            .defaultWidth(20.0)
                            .defaultHeight(20.0)
                            .price(BigDecimal.valueOf(180))
                            .model("Legrand Valena")
                            .ipRating("IP44")
                            .color("Белый")
                            .active(true)
                            .build();
                    electricalSymbolRepository.save(switchSymbol);
                    System.out.println("Created default electrical symbol: Выключатель");
                }
        );

        // Распределительная панель
        electricalSymbolRepository.findByName("Распределительная панель").ifPresentOrElse(
                symbol -> {
                    if (symbol.getPrice() == null) {
                        symbol.setPrice(BigDecimal.valueOf(5000));
                        symbol.setModel("ABB SH200");
                        symbol.setIpRating("IP54");
                        symbol.setColor("Белый");
                        electricalSymbolRepository.save(symbol);
                        System.out.println("Updated electrical symbol: Распределительная панель (added price and specs)");
                    }
                },
                () -> {
                    ElectricalSymbol panel = ElectricalSymbol.builder()
                            .name("Распределительная панель")
                            .type("panel")
                            .category("distribution")
                            .defaultWidth(20.0)
                            .defaultHeight(20.0)
                            .price(BigDecimal.valueOf(5000))
                            .model("ABB SH200")
                            .ipRating("IP54")
                            .color("Белый")
                            .active(true)
                            .build();
                    electricalSymbolRepository.save(panel);
                    System.out.println("Created default electrical symbol: Распределительная панель");
                }
        );

        // Распределительная коробка
        electricalSymbolRepository.findByName("Распределительная коробка").ifPresentOrElse(
                symbol -> {
                    if (symbol.getPrice() == null) {
                        symbol.setPrice(BigDecimal.valueOf(150));
                        symbol.setModel("TDM 80x80x50");
                        symbol.setIpRating("IP65");
                        symbol.setColor("Белый");
                        electricalSymbolRepository.save(symbol);
                        System.out.println("Updated electrical symbol: Распределительная коробка (added price and specs)");
                    }
                },
                () -> {
                    ElectricalSymbol junctionBox = ElectricalSymbol.builder()
                            .name("Распределительная коробка")
                            .type("junction_box")
                            .category("distribution")
                            .defaultWidth(20.0)
                            .defaultHeight(20.0)
                            .price(BigDecimal.valueOf(150))
                            .model("TDM 80x80x50")
                            .ipRating("IP65")
                            .color("Белый")
                            .active(true)
                            .build();
                    electricalSymbolRepository.save(junctionBox);
                    System.out.println("Created default electrical symbol: Распределительная коробка");
                }
        );
    }

    private void initializeCableTypes() {
        if (cableTypeRepository.count() > 0) {
            return;
        }

        cableTypeRepository.save(CableType.builder()
                .name("ВВГнг-LS 3x1.5")
                .material("Cu")
                .crossSectionMm2(BigDecimal.valueOf(1.5))
                .manufacturer("ККЗ")
                .pricePerMeter(BigDecimal.valueOf(52))
                .active(true)
                .build());

        cableTypeRepository.save(CableType.builder()
                .name("ВВГнг-LS 3x2.5")
                .material("Cu")
                .crossSectionMm2(BigDecimal.valueOf(2.5))
                .manufacturer("ККЗ")
                .pricePerMeter(BigDecimal.valueOf(73))
                .active(true)
                .build());

        cableTypeRepository.save(CableType.builder()
                .name("NYM 3x4")
                .material("Cu")
                .crossSectionMm2(BigDecimal.valueOf(4.0))
                .manufacturer("Prysmian")
                .pricePerMeter(BigDecimal.valueOf(118))
                .active(true)
                .build());
    }

    private void ensureRoleExists(Role.RoleName roleName) {
        if (roleRepository.findByName(roleName).isPresent()) {
            return;
        }
        roleRepository.save(Role.builder().name(roleName).build());
    }

    private void migrateLegacyRoles() {
        try {
            Long designerId = jdbcTemplate.query(
                    "SELECT id FROM roles WHERE name = 'DESIGNER'",
                    rs -> rs.next() ? rs.getLong(1) : null);
            if (designerId == null) {
                return;
            }
            List<Long> legacyIds = jdbcTemplate.query(
                    "SELECT id FROM roles WHERE name IN ('CLIENT', 'GUEST')",
                    (rs, rowNum) -> rs.getLong(1));
            for (Long legacyId : legacyIds) {
                jdbcTemplate.update(
                        "INSERT INTO user_roles (user_id, role_id) "
                                + "SELECT ur.user_id, ? FROM user_roles ur WHERE ur.role_id = ? "
                                + "AND NOT EXISTS (SELECT 1 FROM user_roles ur2 WHERE ur2.user_id = ur.user_id AND ur2.role_id = ?)",
                        designerId,
                        legacyId,
                        designerId);
                jdbcTemplate.update("DELETE FROM user_roles WHERE role_id = ?", legacyId);
                jdbcTemplate.update("DELETE FROM roles WHERE id = ?", legacyId);
            }
        } catch (Exception e) {
            System.err.println("migrateLegacyRoles: " + e.getMessage());
        }
    }
}

