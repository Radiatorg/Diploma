package com.verchuk.electro.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.verchuk.electro.dto.response.EquipmentItemResponse;
import com.verchuk.electro.dto.response.CircuitSummaryResponse;
import com.verchuk.electro.dto.response.SpecificationResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.*;
import com.verchuk.electro.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SpecificationService {
    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private FloorPlanRepository floorPlanRepository;

    @Autowired
    private ElectricalPointRepository electricalPointRepository;

    @Autowired
    private ApplianceRepository applianceRepository;

    @Autowired
    private WallRepository wallRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private CableRunRepository cableRunRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public SpecificationResponse getSpecification(Long projectId) {
        var currentUser = userService.getCurrentUser();
        // Проверяем, является ли пользователь администратором
        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);
        
        Project project;
        if (isAdmin) {
            // Администратор может получить любой проект
            project = projectRepository.findById(projectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
        } else {
            // Дизайнер может получить только свои проекты
            project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
        }

        List<EquipmentItemResponse> equipmentItems = new ArrayList<>();
        BigDecimal totalEquipmentCost = BigDecimal.ZERO;
        BigDecimal existingEquipmentCost = BigDecimal.ZERO;
        BigDecimal plannedEquipmentCost = BigDecimal.ZERO;

        // Получаем все электрические точки проекта
        FloorPlan floorPlan = floorPlanRepository.findByProjectId(projectId).orElse(null);
        List<ElectricalPoint> electricalPoints = new ArrayList<>();
        if (floorPlan != null) {
            electricalPoints = electricalPointRepository.findByFloorPlanId(floorPlan.getId());
        }

        // Получаем все приборы проекта
        List<ProjectAppliance> projectAppliances = project.getProjectAppliances();
        if (projectAppliances == null) {
            projectAppliances = new ArrayList<>();
        }

        // Группируем электрические точки по типам символов
        Map<String, List<ElectricalPoint>> pointsBySymbolType = electricalPoints.stream()
                .filter(ep -> ep.getElectricalSymbol() != null)
                .collect(Collectors.groupingBy(ep -> ep.getElectricalSymbol().getType()));

        // Обрабатываем розетки
        if (pointsBySymbolType.containsKey("outlet")) {
            List<ElectricalPoint> outlets = pointsBySymbolType.get("outlet");
            Map<String, List<ElectricalPoint>> groupedOutlets = outlets.stream()
                    .collect(Collectors.groupingBy(ep -> {
                        ElectricalSymbol symbol = ep.getElectricalSymbol();
                        return symbol.getName() + "_" + (symbol.getModel() != null ? symbol.getModel() : "default");
                    }));

            for (Map.Entry<String, List<ElectricalPoint>> entry : groupedOutlets.entrySet()) {
                List<ElectricalPoint> group = entry.getValue();
                ElectricalSymbol symbol = group.get(0).getElectricalSymbol();
                int quantity = group.size();
                BigDecimal unitPrice = symbol.getPrice() != null ? symbol.getPrice() : BigDecimal.ZERO;
                BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(quantity));

                BigDecimal nominalPower = group.stream()
                        .map(this::extractPointPower)
                        .filter(power -> power.compareTo(BigDecimal.ZERO) > 0)
                        .findFirst()
                        .orElse(BigDecimal.valueOf(2200));

                String specification = String.format("Мощность: %s Вт, Напряжение: 220 В, Ток: %.1f А",
                        nominalPower.stripTrailingZeros().toPlainString(),
                        nominalPower.doubleValue() / 220.0);
                if (symbol.getIpRating() != null) {
                    specification += ", IP: " + symbol.getIpRating();
                }

                equipmentItems.add(EquipmentItemResponse.builder()
                        .category("Розетки")
                        .name(symbol.getName())
                        .specification(specification)
                        .quantity(quantity)
                        .unit("шт")
                        .unitPrice(unitPrice)
                        .totalPrice(totalPrice)
                        .model(symbol.getModel())
                        .ipRating(symbol.getIpRating())
                        .color(symbol.getColor())
                        .build());

                totalEquipmentCost = totalEquipmentCost.add(totalPrice);
                if (group.stream().anyMatch(p -> p.getInstallationScope() == InstallationScope.EXISTING)) {
                    existingEquipmentCost = existingEquipmentCost.add(totalPrice);
                } else {
                    plannedEquipmentCost = plannedEquipmentCost.add(totalPrice);
                }
            }
        }

        // Обрабатываем лампы
        if (pointsBySymbolType.containsKey("light")) {
            List<ElectricalPoint> lights = pointsBySymbolType.get("light");
            Map<String, List<ElectricalPoint>> groupedLights = lights.stream()
                    .collect(Collectors.groupingBy(ep -> {
                        ElectricalSymbol symbol = ep.getElectricalSymbol();
                        return symbol.getName() + "_" + (symbol.getModel() != null ? symbol.getModel() : "default");
                    }));

            for (Map.Entry<String, List<ElectricalPoint>> entry : groupedLights.entrySet()) {
                List<ElectricalPoint> group = entry.getValue();
                ElectricalSymbol symbol = group.get(0).getElectricalSymbol();
                int quantity = group.size();
                BigDecimal unitPrice = symbol.getPrice() != null ? symbol.getPrice() : BigDecimal.ZERO;
                BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(quantity));

                BigDecimal nominalPower = group.stream()
                        .map(this::extractPointPower)
                        .filter(power -> power.compareTo(BigDecimal.ZERO) > 0)
                        .findFirst()
                        .orElse(BigDecimal.valueOf(60));

                String specification = String.format("Мощность: %s Вт, Напряжение: 220 В",
                        nominalPower.stripTrailingZeros().toPlainString());
                if (symbol.getIpRating() != null) {
                    specification += ", IP: " + symbol.getIpRating();
                }
                if (symbol.getColor() != null) {
                    specification += ", Цвет: " + symbol.getColor();
                }

                equipmentItems.add(EquipmentItemResponse.builder()
                        .category("Освещение")
                        .name(symbol.getName())
                        .specification(specification)
                        .quantity(quantity)
                        .unit("шт")
                        .unitPrice(unitPrice)
                        .totalPrice(totalPrice)
                        .model(symbol.getModel())
                        .ipRating(symbol.getIpRating())
                        .color(symbol.getColor())
                        .build());

                totalEquipmentCost = totalEquipmentCost.add(totalPrice);
                if (group.stream().anyMatch(p -> p.getInstallationScope() == InstallationScope.EXISTING)) {
                    existingEquipmentCost = existingEquipmentCost.add(totalPrice);
                } else {
                    plannedEquipmentCost = plannedEquipmentCost.add(totalPrice);
                }
            }
        }

        // Обрабатываем щитки и панели
        if (pointsBySymbolType.containsKey("panel")) {
            List<ElectricalPoint> panels = pointsBySymbolType.get("panel");
            Map<String, List<ElectricalPoint>> groupedPanels = panels.stream()
                    .collect(Collectors.groupingBy(ep -> {
                        ElectricalSymbol symbol = ep.getElectricalSymbol();
                        return symbol.getName() + "_" + (symbol.getModel() != null ? symbol.getModel() : "default");
                    }));

            for (Map.Entry<String, List<ElectricalPoint>> entry : groupedPanels.entrySet()) {
                List<ElectricalPoint> group = entry.getValue();
                ElectricalSymbol symbol = group.get(0).getElectricalSymbol();
                int quantity = group.size();
                BigDecimal unitPrice = symbol.getPrice() != null ? symbol.getPrice() : BigDecimal.ZERO;
                BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(quantity));

                equipmentItems.add(EquipmentItemResponse.builder()
                        .category("Распределительные устройства")
                        .name(symbol.getName())
                        .specification(symbol.getIpRating() != null ? "IP: " + symbol.getIpRating() : "")
                        .quantity(quantity)
                        .unit("шт")
                        .unitPrice(unitPrice)
                        .totalPrice(totalPrice)
                        .model(symbol.getModel())
                        .ipRating(symbol.getIpRating())
                        .build());

                totalEquipmentCost = totalEquipmentCost.add(totalPrice);
                if (group.stream().anyMatch(p -> p.getInstallationScope() == InstallationScope.EXISTING)) {
                    existingEquipmentCost = existingEquipmentCost.add(totalPrice);
                } else {
                    plannedEquipmentCost = plannedEquipmentCost.add(totalPrice);
                }
            }
        }

        // Обрабатываем электроприборы (через ProjectAppliance)
        Map<Long, List<ProjectAppliance>> appliancesByApplianceId = projectAppliances.stream()
                .collect(Collectors.groupingBy(pa -> pa.getAppliance().getId()));

        for (Map.Entry<Long, List<ProjectAppliance>> entry : appliancesByApplianceId.entrySet()) {
            List<ProjectAppliance> projectApplianceGroup = entry.getValue();
            Appliance appliance = projectApplianceGroup.get(0).getAppliance();

            // Подсчитываем количество размещенных приборов через электрические точки
            long placedCount = electricalPoints.stream()
                    .filter(ep -> ep.getApplianceId() != null && ep.getApplianceId().equals(appliance.getId()))
                    .count();

            int totalQuantity = projectApplianceGroup.stream()
                    .mapToInt(pa -> pa.getQuantity() != null ? pa.getQuantity() : 0)
                    .sum();

            // Используем размещенные, если есть, иначе общее количество
            int quantity = placedCount > 0 ? (int) placedCount : totalQuantity;

            BigDecimal unitPrice = appliance.getPrice() != null ? appliance.getPrice() : BigDecimal.ZERO;
            BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(quantity));

            String categoryName = "Электроприборы";
            if (appliance.getCategories() != null && !appliance.getCategories().isEmpty()) {
                categoryName = appliance.getCategories().iterator().next().getName();
            } else if (appliance.getCategory() != null) {
                categoryName = appliance.getCategory();
            }

            StringBuilder specification = new StringBuilder();
            specification.append("Мощность: ").append(appliance.getPowerConsumption()).append(" Вт");
            if (appliance.getVoltage() != null) {
                specification.append(", Напряжение: ").append(appliance.getVoltage()).append(" В");
            }
            if (appliance.getCurrent() != null) {
                specification.append(", Ток: ").append(appliance.getCurrent()).append(" А");
            }
            if (appliance.getIpRating() != null) {
                specification.append(", IP: ").append(appliance.getIpRating());
            }
            if (appliance.getColor() != null) {
                specification.append(", Цвет: ").append(appliance.getColor());
            }

            equipmentItems.add(EquipmentItemResponse.builder()
                    .category(categoryName)
                    .name(appliance.getName())
                    .specification(specification.toString())
                    .quantity(quantity)
                    .unit("шт")
                    .unitPrice(unitPrice)
                    .totalPrice(totalPrice)
                    .model(appliance.getModel())
                    .ipRating(appliance.getIpRating())
                    .color(appliance.getColor())
                    .cableBrand(appliance.getCableBrand())
                    .cableCrossSection(appliance.getCableCrossSection())
                    .notes(projectApplianceGroup.stream()
                            .filter(pa -> pa.getRoom() != null)
                            .map(pa -> pa.getRoom().getName())
                            .distinct()
                            .collect(Collectors.joining(", ")))
                    .build());

            totalEquipmentCost = totalEquipmentCost.add(totalPrice);
            plannedEquipmentCost = plannedEquipmentCost.add(totalPrice);
        }

        List<CableRun> cableRuns = cableRunRepository.findByProjectIdOrderByIdAsc(projectId);
        if (!cableRuns.isEmpty()) {
            for (CableRun cableRun : cableRuns) {
                BigDecimal length = cableRun.getLengthM() != null ? cableRun.getLengthM() : BigDecimal.ZERO;
                CableType cableType = cableRun.getCableType();
                String cableName = cableType != null ? cableType.getName() : "Кабель (без типа)";
                String cableSection = cableType != null
                        ? cableType.getCrossSectionMm2().stripTrailingZeros().toPlainString() + " мм²"
                        : "не указано";
                String cableBrand = cableType != null ? cableType.getManufacturer() : null;
                BigDecimal pricePerMeter = cableType != null && cableType.getPricePerMeter() != null
                        ? cableType.getPricePerMeter() : BigDecimal.valueOf(80);
                BigDecimal totalCablePrice = length.multiply(pricePerMeter);

                equipmentItems.add(EquipmentItemResponse.builder()
                        .category("Кабели и провода")
                        .name(cableName)
                        .specification("Сечение: " + cableSection)
                        .quantity(length.intValue())
                        .unit("м")
                        .unitPrice(pricePerMeter)
                        .totalPrice(totalCablePrice)
                        .cableBrand(cableBrand)
                        .cableCrossSection(cableSection)
                        .cableLength(length)
                        .notes(cableRun.getCircuit() != null ? "Линия: " + cableRun.getCircuit().getName() : null)
                        .build());

                totalEquipmentCost = totalEquipmentCost.add(totalCablePrice);
                if (cableRun.getInstallationScope() == InstallationScope.EXISTING) {
                    existingEquipmentCost = existingEquipmentCost.add(totalCablePrice);
                } else {
                    plannedEquipmentCost = plannedEquipmentCost.add(totalCablePrice);
                }
            }
        } else {
            // Fallback для старых проектов без cable_runs.
            BigDecimal cableLength = calculateCableLength(electricalPoints, floorPlan);
            if (cableLength.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal cablePricePerMeter = BigDecimal.valueOf(80);
                BigDecimal totalCablePrice = cableLength.multiply(cablePricePerMeter);

                equipmentItems.add(EquipmentItemResponse.builder()
                        .category("Кабели и провода")
                        .name("Кабель ВВГ 2.5мм²")
                        .specification("Марка: ВВГ, Сечение: 2.5 мм²")
                        .quantity(cableLength.intValue())
                        .unit("м")
                        .unitPrice(cablePricePerMeter)
                        .totalPrice(totalCablePrice)
                        .cableBrand("ВВГ")
                        .cableCrossSection("2.5 мм²")
                        .cableLength(cableLength)
                        .build());

                totalEquipmentCost = totalEquipmentCost.add(totalCablePrice);
                plannedEquipmentCost = plannedEquipmentCost.add(totalCablePrice);
            }
        }

        // Добавляем автоматические выключатели и УЗО (на основе общей мощности)
        BigDecimal totalPower = electricalPoints.stream()
                .map(this::extractPointPower)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalPower.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal totalCurrent = totalPower.divide(BigDecimal.valueOf(220), 2, RoundingMode.UP);
            // Предполагаем использование автоматических выключателей на 16А
            int breakerCount = totalCurrent.divide(BigDecimal.valueOf(16), 0, RoundingMode.UP).intValue() + 1;

            BigDecimal breakerPrice = BigDecimal.valueOf(500); // Примерная цена автоматического выключателя
            BigDecimal totalBreakerPrice = breakerPrice.multiply(BigDecimal.valueOf(breakerCount));

            equipmentItems.add(EquipmentItemResponse.builder()
                    .category("Защитная аппаратура")
                    .name("Автоматический выключатель 16А")
                    .specification("Номинальный ток: 16 А, Количество полюсов: 1")
                    .quantity(breakerCount)
                    .unit("шт")
                    .unitPrice(breakerPrice)
                    .totalPrice(totalBreakerPrice)
                    .build());

            totalEquipmentCost = totalEquipmentCost.add(totalBreakerPrice);
            plannedEquipmentCost = plannedEquipmentCost.add(totalBreakerPrice);

            // УЗО
            int rcdCount = breakerCount; // По одному УЗО на группу
            BigDecimal rcdPrice = BigDecimal.valueOf(1200); // Примерная цена УЗО
            BigDecimal totalRcdPrice = rcdPrice.multiply(BigDecimal.valueOf(rcdCount));

            equipmentItems.add(EquipmentItemResponse.builder()
                    .category("Защитная аппаратура")
                    .name("УЗО 30мА")
                    .specification("Номинальный ток: 16 А, Ток утечки: 30 мА")
                    .quantity(rcdCount)
                    .unit("шт")
                    .unitPrice(rcdPrice)
                    .totalPrice(totalRcdPrice)
                    .build());

            totalEquipmentCost = totalEquipmentCost.add(totalRcdPrice);
            plannedEquipmentCost = plannedEquipmentCost.add(totalRcdPrice);
        }

        List<CircuitSummaryResponse> circuitSummaries = buildCircuitSummaries(cableRuns, electricalPoints);
        int existingItemsCount = (int) electricalPoints.stream()
                .filter(point -> point.getInstallationScope() == InstallationScope.EXISTING)
                .count();
        int plannedItemsCount = (int) electricalPoints.stream()
                .filter(point -> point.getInstallationScope() != InstallationScope.EXISTING)
                .count();

        // Получаем все комнаты проекта для подсчета розеток и светильников
        List<Room> rooms = roomRepository.findByProject(project);
        String recommendations = generateRecommendations(projectAppliances, electricalPoints, totalPower, rooms);

        return SpecificationResponse.builder()
                .projectId(project.getId())
                .projectName(project.getName())
                .equipmentItems(equipmentItems)
                .circuitSummaries(circuitSummaries)
                .totalEquipmentCost(totalEquipmentCost)
                .existingEquipmentCost(existingEquipmentCost)
                .plannedEquipmentCost(plannedEquipmentCost)
                .existingItemsCount(existingItemsCount)
                .plannedItemsCount(plannedItemsCount)
                .recommendations(recommendations)
                .build();
    }

    private BigDecimal calculateCableLength(List<ElectricalPoint> electricalPoints, FloorPlan floorPlan) {
        if (electricalPoints == null || electricalPoints.isEmpty() || floorPlan == null) {
            return BigDecimal.ZERO;
        }

        // Предполагаем, что распределительный щит находится в начале координат (0,0)
        BigDecimal totalLength = BigDecimal.ZERO;

        for (ElectricalPoint point : electricalPoints) {
            // Расстояние от щита до точки (в метрах, т.к. координаты в см)
            BigDecimal distance = BigDecimal.valueOf(Math.sqrt(
                    point.getPositionX().doubleValue() * point.getPositionX().doubleValue() +
                            point.getPositionY().doubleValue() * point.getPositionY().doubleValue()
            )).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP); // переводим из см в метры

            // Кабель идет туда и обратно (фаза и ноль), плюс запас 10%
            BigDecimal cableLength = distance.multiply(BigDecimal.valueOf(2.1));
            totalLength = totalLength.add(cableLength);
        }

        return totalLength;
    }

    private String generateRecommendations(List<ProjectAppliance> projectAppliances, 
                                          List<ElectricalPoint> electricalPoints, 
                                          BigDecimal totalPower,
                                          List<Room> rooms) {
        List<String> recommendations = new ArrayList<>();

        if (totalPower.compareTo(BigDecimal.ZERO) > 0) {
            recommendations.add(String.format("Общая установленная мощность: %.2f Вт", totalPower));
            recommendations.add(String.format("Общий расчетный ток: %.1f А", 
                    totalPower.divide(BigDecimal.valueOf(220), 2, RoundingMode.UP)));

            if (totalPower.compareTo(BigDecimal.valueOf(5000)) > 0) {
                recommendations.add("Рекомендуется установка трехфазной системы электроснабжения.");
            }
        }

        // Подсчитываем розетки из socketGroupsConfig комнат
        long outletCount = 0;
        if (rooms != null && !rooms.isEmpty()) {
            for (Room room : rooms) {
                if (room.getSocketGroupsConfig() != null && !room.getSocketGroupsConfig().isEmpty()) {
                    try {
                        // Парсим JSON: [{"socketsCount": 2}, {"socketsCount": 3}, ...]
                        List<Map<String, Object>> groups = objectMapper.readValue(
                            room.getSocketGroupsConfig(),
                            new TypeReference<List<Map<String, Object>>>() {}
                        );
                        for (Map<String, Object> group : groups) {
                            Object socketsCountObj = group.get("socketsCount");
                            if (socketsCountObj != null) {
                                if (socketsCountObj instanceof Number) {
                                    outletCount += ((Number) socketsCountObj).intValue();
                                } else if (socketsCountObj instanceof String) {
                                    outletCount += Integer.parseInt((String) socketsCountObj);
                                }
                            }
                        }
                    } catch (Exception e) {
                        // Если не удалось распарсить JSON, используем старый способ
                        if (room.getSocketGroups() != null && room.getSocketsPerGroup() != null) {
                            outletCount += room.getSocketGroups() * room.getSocketsPerGroup();
                        }
                    }
                } else if (room.getSocketGroups() != null && room.getSocketsPerGroup() != null) {
                    // Fallback на старый способ
                    outletCount += room.getSocketGroups() * room.getSocketsPerGroup();
                }
            }
        }
        
        // Если не нашли розетки в комнатах, пробуем из electricalPoints
        if (outletCount == 0 && electricalPoints != null) {
            outletCount = electricalPoints.stream()
                    .filter(ep -> ep.getElectricalSymbol() != null && "outlet".equals(ep.getElectricalSymbol().getType()))
                    .count();
        }

        // Подсчитываем светильники с учетом норм ТКП 339-2022
        // Правило 1: Минимум 1 светильник на комнату, даже если окон нет
        // Правило 2: Учитываем площадь - примерно 1 светильник на каждые 15-20 м²
        // Правило 3: windowCount используется как базовое значение, но не меньше минимума
        long lightCount = 0;
        if (rooms != null && !rooms.isEmpty()) {
            for (Room room : rooms) {
                int roomLights = 0;
                
                // Базовое значение из windowCount
                if (room.getWindowCount() != null && room.getWindowCount() > 0) {
                    roomLights = room.getWindowCount();
                }
                
                // Правило 1: Минимум 1 светильник на комнату (даже без окон)
                if (roomLights == 0) {
                    roomLights = 1;
                }
                
                // Правило 2: Если комната большая, добавляем свет по площади
                // Примерно 1 светильник на каждые 15-20 м²
                if (room.getArea() != null && room.getArea().compareTo(BigDecimal.ZERO) > 0) {
                    double area = room.getArea().doubleValue();
                    // Для больших помещений (более 20 м²) добавляем свет по норме
                    if (area > 20) {
                        int lightsByArea = (int) Math.ceil(area / 20.0);
                        roomLights = Math.max(roomLights, lightsByArea);
                    }
                }
                
                lightCount += roomLights;
            }
        }
        
        // Если не нашли светильники в комнатах, пробуем из electricalPoints
        if (lightCount == 0 && electricalPoints != null) {
            lightCount = electricalPoints.stream()
                    .filter(ep -> ep.getElectricalSymbol() != null && "light".equals(ep.getElectricalSymbol().getType()))
                    .count();
            // Если и там 0, устанавливаем минимум 1 для проекта
            if (lightCount == 0 && rooms != null && !rooms.isEmpty()) {
                lightCount = 1;
            }
        }

        recommendations.add(String.format("Количество розеток: %d шт.", outletCount));
        recommendations.add(String.format("Количество светильников: %d шт.", lightCount));

        recommendations.add("Рекомендации по защите:");
        recommendations.add("- Освещение: отдельная группа с УЗО 30мА");
        recommendations.add("- Розетки: группировать по зонам с УЗО 30мА");
        recommendations.add("- Рекомендуемое сечение кабеля: 1.5 мм² для освещения, 2.5 мм² для розеток");

        return String.join("\n", recommendations);
    }

    private BigDecimal extractPointPower(ElectricalPoint point) {
        if (point.getRatedPowerW() != null && point.getRatedPowerW().compareTo(BigDecimal.ZERO) > 0) {
            return point.getRatedPowerW();
        }
        if (point.getNotes() != null && point.getNotes().contains("Мощность:")) {
            String powerStr = point.getNotes().replaceAll(".*?Мощность:\\s*([\\d.]+)\\s*W.*", "$1");
            try {
                return new BigDecimal(powerStr);
            } catch (NumberFormatException ignored) {
                return BigDecimal.ZERO;
            }
        }
        return BigDecimal.ZERO;
    }

    private List<CircuitSummaryResponse> buildCircuitSummaries(List<CableRun> cableRuns, List<ElectricalPoint> electricalPoints) {
        if ((cableRuns == null || cableRuns.isEmpty()) && (electricalPoints == null || electricalPoints.isEmpty())) {
            return List.of();
        }

        Map<Long, BigDecimal> lengthByCircuit = new HashMap<>();
        Map<Long, BigDecimal> costByCircuit = new HashMap<>();
        Map<Long, String> nameByCircuit = new HashMap<>();
        Map<Long, InstallationScope> scopeByCircuit = new HashMap<>();

        for (CableRun cableRun : cableRuns) {
            if (cableRun.getCircuit() == null) {
                continue;
            }
            Long circuitId = cableRun.getCircuit().getId();
            BigDecimal length = cableRun.getLengthM() != null ? cableRun.getLengthM() : BigDecimal.ZERO;
            BigDecimal pricePerMeter = (cableRun.getCableType() != null && cableRun.getCableType().getPricePerMeter() != null)
                    ? cableRun.getCableType().getPricePerMeter()
                    : BigDecimal.ZERO;
            BigDecimal cost = length.multiply(pricePerMeter);

            lengthByCircuit.merge(circuitId, length, BigDecimal::add);
            costByCircuit.merge(circuitId, cost, BigDecimal::add);
            nameByCircuit.put(circuitId, cableRun.getCircuit().getName());
            scopeByCircuit.put(circuitId, cableRun.getCircuit().getInstallationScope());
        }

        Map<Long, Long> pointsByCircuit = electricalPoints.stream()
                .filter(point -> point.getCircuit() != null)
                .collect(Collectors.groupingBy(point -> point.getCircuit().getId(), Collectors.counting()));

        return pointsByCircuit.keySet().stream()
                .sorted()
                .map(circuitId -> CircuitSummaryResponse.builder()
                        .circuitId(circuitId)
                        .circuitName(nameByCircuit.getOrDefault(circuitId, "Линия #" + circuitId))
                        .installationScope(scopeByCircuit.getOrDefault(circuitId, InstallationScope.PLANNED))
                        .pointsCount(pointsByCircuit.get(circuitId).intValue())
                        .cableLengthM(lengthByCircuit.getOrDefault(circuitId, BigDecimal.ZERO))
                        .cableCost(costByCircuit.getOrDefault(circuitId, BigDecimal.ZERO))
                        .build())
                .collect(Collectors.toList());
    }
}

