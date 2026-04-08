package com.verchuk.electro.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.verchuk.electro.dto.response.ApplianceSummaryResponse;
import com.verchuk.electro.dto.response.CableTypeTotalLengthResponse;
import com.verchuk.electro.dto.response.CalculationReportResponse;
import com.verchuk.electro.dto.response.FinancialCalculationLineResponse;
import com.verchuk.electro.dto.response.RoomCableTypeLengthResponse;
import com.verchuk.electro.dto.response.RoomCalculationResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.*;
import com.verchuk.electro.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CalculationService {

    private static final BigDecimal HOURLY_RATE_BYN = BigDecimal.valueOf(15);

    private record CableTypeMeta(String name, BigDecimal crossSectionMm2) {}

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
    private TKP339CalculationService tkp339CalculationService;

    @Autowired
    private CalculationNormsProvider calculationNormsProvider;

    @Autowired
    private CableRunRepository cableRunRepository;

    @Autowired
    private WallRepository wallRepository;

    @Autowired
    private ObjectMapper objectMapper;

    public CalculationReportResponse getCalculationReport(Long projectId) {
        var currentUser = userService.getCurrentUser();
        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);

        Project project;
        if (isAdmin) {
            project = projectRepository.findById(projectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
        } else {
            project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
        }

        List<ProjectAppliance> projectAppliances = project.getProjectAppliances();
        if (projectAppliances == null) {
            projectAppliances = List.of();
        }

        FloorPlan floorPlan = floorPlanRepository.findByProjectId(projectId).orElse(null);
        List<ElectricalPoint> electricalPoints;
        if (floorPlan != null) {
            electricalPoints = electricalPointRepository.findByFloorPlanId(floorPlan.getId());
        } else {
            electricalPoints = List.of();
        }

        Map<Long, ElectricalPoint> pointsById = new HashMap<>();
        for (ElectricalPoint p : electricalPoints) {
            pointsById.put(p.getId(), p);
        }

        BigDecimal totalPower = BigDecimal.ZERO;
        for (ElectricalPoint point : electricalPoints) {
            totalPower = totalPower.add(extractPointPower(point));
        }

        BigDecimal appliancesPower = projectAppliances.stream()
                .map(pa -> {
                    BigDecimal appliancePower = pa.getTotalPower() != null ? pa.getTotalPower() : BigDecimal.ZERO;
                    if (pa.getRoom() != null && pa.getRoom().getRoomType() != null) {
                        BigDecimal coefficient = pa.getRoom().getRoomType().getEffectiveCoefficient();
                        return appliancePower.multiply(coefficient);
                    }
                    return appliancePower;
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        totalPower = totalPower.add(appliancesPower);
        BigDecimal installedPower = totalPower;
        BigDecimal demandFactor = calculationNormsProvider.determineDemandFactor(installedPower);
        BigDecimal designPower = installedPower.multiply(demandFactor);
        BigDecimal designCurrent = designPower.divide(BigDecimal.valueOf(221), 2, RoundingMode.UP);
        Integer mainCircuitBreaker = calculationNormsProvider.selectMainCircuitBreaker(designCurrent)
                .orElse(63);
        BigDecimal totalCurrent = designCurrent;

        BigDecimal totalArea = project.getRooms() != null ?
                project.getRooms().stream()
                        .map(room -> room.getArea() != null ? room.getArea() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                : BigDecimal.ZERO;

        Room aggregateRoom = Room.builder()
                .area(totalArea)
                .roomType(null)
                .build();

        BigDecimal pointsPower = electricalPoints.stream()
                .map(this::extractPointPower)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        TKP339CalculationService.TKP339CalculationResult tkp339Result =
                tkp339CalculationService.calculateForRoom(aggregateRoom, projectAppliances, pointsPower);

        String recommendedCableCrossSection = tkp339Result.getRecommendedCableSection();

        String recommendedMeterType;
        double powerValue = totalPower.doubleValue();
        if (powerValue <= 5000) {
            recommendedMeterType = "Однофазный счетчик 5(60)А";
        } else if (powerValue <= 15000) {
            recommendedMeterType = "Однофазный счетчик 10(100)А";
        } else {
            recommendedMeterType = "Трехфазный счетчик 5(60)А";
        }

        BigDecimal cableLength = BigDecimal.ZERO;
        if (floorPlan != null && !electricalPoints.isEmpty()) {
            for (ElectricalPoint point : electricalPoints) {
                BigDecimal distance = BigDecimal.valueOf(Math.sqrt(
                        point.getPositionX().doubleValue() * point.getPositionX().doubleValue() +
                                point.getPositionY().doubleValue() * point.getPositionY().doubleValue()
                )).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                BigDecimal cableLengthForPoint = distance.multiply(BigDecimal.valueOf(2.1));
                cableLength = cableLength.add(cableLengthForPoint);
            }
        }

        List<CableRun> cableRuns = cableRunRepository.findByProjectIdOrderByIdAsc(projectId);
        BigDecimal cableRunsLength = cableRuns.stream()
                .map(run -> run.getLengthM() != null ? run.getLengthM() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (cableRunsLength.compareTo(BigDecimal.ZERO) > 0) {
            cableLength = cableRunsLength.setScale(2, RoundingMode.HALF_UP);
        }

        Map<String, CableTypeMeta> cableMetaByKey = new LinkedHashMap<>();
        Map<String, BigDecimal> projectCableLengthByKey = new HashMap<>();
        Map<Long, Map<String, BigDecimal>> roomCableLengthByKey = new HashMap<>();

        for (CableRun run : cableRuns) {
            BigDecimal len = run.getLengthM() != null ? run.getLengthM() : BigDecimal.ZERO;
            if (len.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            String key = cableRunTypeKey(run);
            ensureCableMeta(cableMetaByKey, key, run);
            projectCableLengthByKey.merge(key, len, BigDecimal::add);

            List<Long> roomTargets = resolveCableRunTargetRoomIds(run.getPathJson(), pointsById);
            if (roomTargets.isEmpty()) {
                continue;
            }
            BigDecimal share = len.divide(BigDecimal.valueOf(roomTargets.size()), 4, RoundingMode.HALF_UP);
            for (Long roomId : roomTargets) {
                roomCableLengthByKey
                        .computeIfAbsent(roomId, k -> new HashMap<>())
                        .merge(key, share, BigDecimal::add);
            }
        }

        List<CableTypeTotalLengthResponse> projectCableByType = projectCableLengthByKey.entrySet().stream()
                .sorted(Comparator.comparing(e -> parseCableTypeId(e.getKey()) == null ? Long.MAX_VALUE : parseCableTypeId(e.getKey())))
                .map(e -> {
                    CableTypeMeta m = cableMetaByKey.get(e.getKey());
                    return CableTypeTotalLengthResponse.builder()
                            .cableTypeId(parseCableTypeId(e.getKey()))
                            .cableName(m != null ? m.name() : e.getKey())
                            .crossSectionMm2(m != null ? m.crossSectionMm2() : null)
                            .totalLengthM(e.getValue().setScale(2, RoundingMode.HALF_UP))
                            .build();
                })
                .collect(Collectors.toList());

        int recommendedBreakerCount = totalCurrent.divide(BigDecimal.valueOf(16), 0, RoundingMode.UP).intValue();
        if (recommendedBreakerCount < 1) {
            recommendedBreakerCount = 1;
        }
        Integer recommendedCircuitBreakerRating = tkp339Result.getRecommendedCircuitBreakerRating();

        BigDecimal equipmentFromSymbols = BigDecimal.ZERO;
        BigDecimal equipmentFromPointAppliances = BigDecimal.ZERO;
        BigDecimal equipmentFromProjectAppliances = BigDecimal.ZERO;

        for (ElectricalPoint point : electricalPoints) {
            if (point.getElectricalSymbol() != null && point.getElectricalSymbol().getPrice() != null) {
                equipmentFromSymbols = equipmentFromSymbols.add(point.getElectricalSymbol().getPrice());
            }
            if (point.getApplianceId() != null) {
                Appliance appliance = applianceRepository.findById(point.getApplianceId()).orElse(null);
                if (appliance != null && appliance.getPrice() != null) {
                    equipmentFromPointAppliances = equipmentFromPointAppliances.add(appliance.getPrice());
                }
            }
        }

        for (ProjectAppliance pa : projectAppliances) {
            if (pa.getAppliance().getPrice() != null && pa.getQuantity() != null) {
                BigDecimal applianceCost = pa.getAppliance().getPrice().multiply(BigDecimal.valueOf(pa.getQuantity()));
                equipmentFromProjectAppliances = equipmentFromProjectAppliances.add(applianceCost);
            }
        }

        BigDecimal totalEquipmentCost = equipmentFromSymbols
                .add(equipmentFromPointAppliances)
                .add(equipmentFromProjectAppliances);

        long outletCount = electricalPoints.stream()
                .filter(ep -> ep.getElectricalSymbol() != null && "outlet".equals(ep.getElectricalSymbol().getType()))
                .count();
        long lightCount = electricalPoints.stream()
                .filter(ep -> ep.getElectricalSymbol() != null && "light".equals(ep.getElectricalSymbol().getType()))
                .count();
        long appliancePointCount = electricalPoints.stream()
                .filter(ep -> ep.getApplianceId() != null)
                .count();

        BigDecimal baseLaborHours = BigDecimal.valueOf(outletCount).multiply(BigDecimal.valueOf(0.5))
                .add(BigDecimal.valueOf(lightCount).multiply(BigDecimal.valueOf(0.75)))
                .add(BigDecimal.valueOf(appliancePointCount).multiply(BigDecimal.valueOf(1.0)))
                .add(BigDecimal.valueOf(projectAppliances.size()).multiply(BigDecimal.valueOf(1.5)));

        BigDecimal finalCableLength = tkp339Result.getEstimatedCableLength() != null ?
                tkp339Result.getEstimatedCableLength() : cableLength;
        BigDecimal cableWiringHours = finalCableLength.multiply(BigDecimal.valueOf(0.05))
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal rcdInstallationHours = BigDecimal.ZERO;
        if (tkp339Result.isRcdRequired() && tkp339Result.getRecommendedRcdRating() != null) {
            rcdInstallationHours = BigDecimal.valueOf(1.5);
        }

        BigDecimal meterInstallationHours = BigDecimal.ZERO;
        if (recommendedMeterType != null && !recommendedMeterType.isEmpty()) {
            meterInstallationHours = BigDecimal.valueOf(2.0);
        }

        BigDecimal laborHours = baseLaborHours
                .add(cableWiringHours)
                .add(rcdInstallationHours)
                .add(meterInstallationHours)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal installationCost = laborHours.multiply(HOURLY_RATE_BYN)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal commissioningCost = totalEquipmentCost.multiply(BigDecimal.valueOf(0.15))
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalProjectCost = totalEquipmentCost.add(installationCost).add(commissioningCost);

        String baseLaborFormula = String.format(Locale.ROOT,
                "%d розеток × 0,5 ч + %d точек освещения × 0,75 ч + %d точек с прибором × 1 ч + %d позиций приборов проекта × 1,5 ч",
                outletCount, lightCount, appliancePointCount, projectAppliances.size());

        List<FinancialCalculationLineResponse> financialLines = new ArrayList<>();
        financialLines.add(FinancialCalculationLineResponse.builder()
                .title("Оборудование: символы на плане")
                .calculationNote("Сумма цен условных обозначений по электрическим точкам")
                .amountByn(equipmentFromSymbols.setScale(2, RoundingMode.HALF_UP))
                .indent(0)
                .build());
        financialLines.add(FinancialCalculationLineResponse.builder()
                .title("Оборудование: приборы в точках плана")
                .calculationNote("Сумма цен каталога по точкам с прибором")
                .amountByn(equipmentFromPointAppliances.setScale(2, RoundingMode.HALF_UP))
                .indent(0)
                .build());
        financialLines.add(FinancialCalculationLineResponse.builder()
                .title("Оборудование: приборы из списка проекта")
                .calculationNote("Цена × количество по каждой позиции, сумма")
                .amountByn(equipmentFromProjectAppliances.setScale(2, RoundingMode.HALF_UP))
                .indent(0)
                .build());
        financialLines.add(FinancialCalculationLineResponse.builder()
                .title("Итого оборудование")
                .calculationNote("Сумма трёх строк выше")
                .amountByn(totalEquipmentCost.setScale(2, RoundingMode.HALF_UP))
                .indent(0)
                .build());
        financialLines.add(FinancialCalculationLineResponse.builder()
                .title("Базовые монтажные работы")
                .calculationNote(baseLaborFormula + " = " + baseLaborHours.setScale(2, RoundingMode.HALF_UP) + " ч")
                .amountHours(baseLaborHours.setScale(2, RoundingMode.HALF_UP))
                .indent(0)
                .build());
        financialLines.add(FinancialCalculationLineResponse.builder()
                .title("Прокладка кабеля")
                .calculationNote(String.format(Locale.ROOT,
                        "%s м × 0,05 ч/м = %s ч",
                        finalCableLength.setScale(2, RoundingMode.HALF_UP),
                        cableWiringHours))
                .amountHours(cableWiringHours)
                .indent(1)
                .build());
        if (rcdInstallationHours.compareTo(BigDecimal.ZERO) > 0) {
            financialLines.add(FinancialCalculationLineResponse.builder()
                    .title("Установка УЗО")
                    .calculationNote("Норма 1,5 ч при необходимости УЗО")
                    .amountHours(rcdInstallationHours)
                    .indent(1)
                    .build());
        }
        if (meterInstallationHours.compareTo(BigDecimal.ZERO) > 0) {
            financialLines.add(FinancialCalculationLineResponse.builder()
                    .title("Установка электросчётчика")
                    .calculationNote("Норма 2 ч")
                    .amountHours(meterInstallationHours)
                    .indent(1)
                    .build());
        }
        financialLines.add(FinancialCalculationLineResponse.builder()
                .title("Всего трудозатраты")
                .calculationNote("Сумма часов по монтажу")
                .amountHours(laborHours)
                .indent(0)
                .build());
        financialLines.add(FinancialCalculationLineResponse.builder()
                .title("Стоимость монтажных работ")
                .calculationNote(String.format(Locale.ROOT,
                        "%s ч × %s BYN/ч",
                        laborHours, HOURLY_RATE_BYN.stripTrailingZeros().toPlainString()))
                .amountByn(installationCost)
                .indent(0)
                .build());
        financialLines.add(FinancialCalculationLineResponse.builder()
                .title("Пусконаладочные работы (ПНР)")
                .calculationNote(String.format(Locale.ROOT,
                        "15%% от оборудования: 0,15 × %s BYN",
                        totalEquipmentCost.setScale(2, RoundingMode.HALF_UP)))
                .amountByn(commissioningCost)
                .indent(0)
                .build());
        financialLines.add(FinancialCalculationLineResponse.builder()
                .title("Общая стоимость проекта")
                .calculationNote("Оборудование + монтаж + ПНР")
                .amountByn(totalProjectCost.setScale(2, RoundingMode.HALF_UP))
                .indent(0)
                .build());

        Map<Long, List<ProjectAppliance>> appliancesByRoom = projectAppliances.stream()
                .filter(pa -> pa.getRoom() != null)
                .collect(Collectors.groupingBy(pa -> pa.getRoom().getId()));

        Map<Long, Room> roomsById = new HashMap<>();
        if (project.getRooms() != null) {
            for (Room r : project.getRooms()) {
                roomsById.put(r.getId(), r);
            }
        }

        Set<Long> allRoomIds = new HashSet<>(appliancesByRoom.keySet());
        for (ElectricalPoint ep : electricalPoints) {
            if (ep.getRoom() != null) {
                allRoomIds.add(ep.getRoom().getId());
            }
        }
        allRoomIds.addAll(roomCableLengthByKey.keySet());

        List<RoomCalculationResponse> roomCalculations = allRoomIds.stream()
                .map(roomId -> buildRoomCalculation(
                        roomId,
                        roomsById,
                        appliancesByRoom,
                        electricalPoints,
                        roomCableLengthByKey,
                        cableMetaByKey,
                        floorPlan))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(RoomCalculationResponse::getRoomName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .collect(Collectors.toList());

        Map<Long, List<ProjectAppliance>> appliancesByAppliance = projectAppliances.stream()
                .collect(Collectors.groupingBy(pa -> pa.getAppliance().getId()));

        List<ApplianceSummaryResponse> applianceSummaries = appliancesByAppliance.entrySet().stream()
                .map(entry -> {
                    var appliance = entry.getValue().get(0).getAppliance();
                    int totalQuantity = entry.getValue().stream()
                            .mapToInt(pa -> pa.getQuantity() != null ? pa.getQuantity() : 0)
                            .sum();
                    BigDecimal totalPowerForAppliance = entry.getValue().stream()
                            .map(pa -> pa.getTotalPower() != null ? pa.getTotalPower() : BigDecimal.ZERO)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    return ApplianceSummaryResponse.builder()
                            .applianceId(appliance.getId())
                            .applianceName(appliance.getName())
                            .totalQuantity(totalQuantity)
                            .totalPower(totalPowerForAppliance)
                            .build();
                })
                .collect(Collectors.toList());

        BigDecimal existingPower = electricalPoints.stream()
                .filter(point -> point.getInstallationScope() == InstallationScope.EXISTING)
                .map(this::extractPointPower)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal plannedPower = electricalPoints.stream()
                .filter(point -> point.getInstallationScope() != InstallationScope.EXISTING)
                .map(this::extractPointPower)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int existingPointsCount = (int) electricalPoints.stream()
                .filter(point -> point.getInstallationScope() == InstallationScope.EXISTING)
                .count();
        int plannedPointsCount = (int) electricalPoints.stream()
                .filter(point -> point.getInstallationScope() != InstallationScope.EXISTING)
                .count();

        int wallsCount = 0;
        int windowsCount = 0;
        int doorsCount = 0;
        if (floorPlan != null) {
            List<Wall> walls = wallRepository.findByFloorPlanId(floorPlan.getId());
            wallsCount = walls.size();
            windowsCount = (int) walls.stream()
                    .filter(wall -> wall.getOpenings() != null)
                    .flatMap(wall -> wall.getOpenings().stream())
                    .filter(opening -> opening.getOpeningType() != null && "window".equalsIgnoreCase(opening.getOpeningType()))
                    .count();
            doorsCount = (int) walls.stream()
                    .filter(wall -> wall.getOpenings() != null)
                    .flatMap(wall -> wall.getOpenings().stream())
                    .filter(opening -> opening.getOpeningType() != null && "door".equalsIgnoreCase(opening.getOpeningType()))
                    .count();
        }

        List<String> inputReadinessWarnings = new ArrayList<>();
        boolean hasFloorPlan = floorPlan != null;
        boolean hasCableRoutes = !cableRuns.isEmpty();
        if (!hasFloorPlan) {
            inputReadinessWarnings.add("Не задан план помещения: расчет длины кабеля и размещения точек будет приблизительным.");
        }
        if (wallsCount == 0) {
            inputReadinessWarnings.add("Не заданы стены: невозможно проверить привязку трасс и корректные расстояния.");
        }
        if (windowsCount == 0) {
            inputReadinessWarnings.add("Не заданы окна: проверки зон и размещения рядом с проемами ограничены.");
        }
        if (!hasCableRoutes) {
            inputReadinessWarnings.add("Не заданы трассы кабеля: длина кабеля рассчитана по эвристике.");
        }
        if (existingPointsCount == 0) {
            inputReadinessWarnings.add("Не отмечены существующие точки: дельта 'что есть / что планируется' может быть неточной.");
        }

        return CalculationReportResponse.builder()
                .projectId(project.getId())
                .projectName(project.getName())
                .totalPowerConsumption(installedPower)
                .totalCurrent(designCurrent)
                .totalAppliances(
                        projectAppliances.stream()
                                .mapToInt(pa -> pa.getQuantity() != null ? pa.getQuantity() : 0)
                                .sum() + electricalPoints.size()
                )
                .roomCalculations(roomCalculations)
                .applianceSummaries(applianceSummaries)
                .projectCableByType(projectCableByType)
                .totalEquipmentCost(totalEquipmentCost)
                .installationCost(installationCost)
                .commissioningCost(commissioningCost)
                .totalProjectCost(totalProjectCost)
                .laborHours(laborHours)
                .cableWiringHours(cableWiringHours)
                .rcdInstallationHours(rcdInstallationHours)
                .meterInstallationHours(meterInstallationHours)
                .totalArea(totalArea)
                .recommendedCableCrossSection(recommendedCableCrossSection)
                .recommendedMeterType(recommendedMeterType)
                .cableLength(tkp339Result.getEstimatedCableLength() != null ?
                        tkp339Result.getEstimatedCableLength() : cableLength)
                .recommendedBreakerCount(recommendedBreakerCount)
                .calculatedLeakageCurrent(tkp339Result.getCalculatedLeakageCurrent())
                .recommendedRcdRating(tkp339Result.getRecommendedRcdRating())
                .recommendedCircuitBreakerRating(recommendedCircuitBreakerRating)
                .rcdRequired(tkp339Result.isRcdRequired())
                .complianceWarnings(tkp339Result.getWarnings())
                .installedPower(installedPower)
                .demandFactor(demandFactor)
                .designPower(designPower)
                .mainCircuitBreaker(mainCircuitBreaker)
                .existingPower(existingPower)
                .plannedPower(plannedPower)
                .existingPointsCount(existingPointsCount)
                .plannedPointsCount(plannedPointsCount)
                .hasFloorPlan(hasFloorPlan)
                .wallsCount(wallsCount)
                .windowsCount(windowsCount)
                .doorsCount(doorsCount)
                .cableRunsCount(cableRuns.size())
                .hasCableRoutes(hasCableRoutes)
                .inputReadinessWarnings(inputReadinessWarnings)
                .financialCalculationLines(financialLines)
                .build();
    }

    private RoomCalculationResponse buildRoomCalculation(
            Long roomId,
            Map<Long, Room> roomsById,
            Map<Long, List<ProjectAppliance>> appliancesByRoom,
            List<ElectricalPoint> electricalPoints,
            Map<Long, Map<String, BigDecimal>> roomCableLengthByKey,
            Map<String, CableTypeMeta> cableMetaByKey,
            FloorPlan floorPlan) {

        Room room = roomsById.get(roomId);
        if (room == null) {
            return null;
        }

        List<ProjectAppliance> pas = appliancesByRoom.getOrDefault(roomId, List.of());
        BigDecimal rawRoomPower = pas.stream()
                .map(pa -> pa.getTotalPower() != null ? pa.getTotalPower() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<ElectricalPoint> roomPoints = electricalPoints.stream()
                .filter(ep -> ep.getRoom() != null && roomId.equals(ep.getRoom().getId()))
                .collect(Collectors.toList());

        BigDecimal roomPointsPower = roomPoints.stream()
                .map(this::extractPointPower)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal roomCoefficient = room.getRoomType() != null
                ? room.getRoomType().getEffectiveCoefficient()
                : BigDecimal.ONE;
        BigDecimal roomPower = rawRoomPower.add(roomPointsPower).multiply(roomCoefficient);

        int applianceCount = pas.stream()
                .mapToInt(pa -> pa.getQuantity() != null ? pa.getQuantity() : 0)
                .sum();
        applianceCount += roomPoints.size();

        Map<String, BigDecimal> lengthsByKey = roomCableLengthByKey.getOrDefault(roomId, Map.of());
        List<RoomCableTypeLengthResponse> cableByType = lengthsByKey.entrySet().stream()
                .sorted(Comparator.comparing(Map.Entry::getKey))
                .map(e -> {
                    CableTypeMeta m = cableMetaByKey.get(e.getKey());
                    return RoomCableTypeLengthResponse.builder()
                            .cableName(m != null ? m.name() : e.getKey())
                            .crossSectionMm2(m != null ? m.crossSectionMm2() : null)
                            .lengthM(e.getValue().setScale(2, RoundingMode.HALF_UP))
                            .build();
                })
                .collect(Collectors.toList());

        BigDecimal totalCableLengthM;
        String cableNote;
        if (!cableByType.isEmpty()) {
            totalCableLengthM = cableByType.stream()
                    .map(RoomCableTypeLengthResponse::getLengthM)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);
            cableNote = "По трассам: длина делится между комнатами начала и конца трассы (разные комнаты — поровну).";
        } else {
            totalCableLengthM = estimateCableLengthForPoints(roomPoints, floorPlan);
            cableNote = "Оценка по точкам: расстояние от условного щита (0, 0) до точки × 2,1 (туда-обратно и запас).";
        }

        return RoomCalculationResponse.builder()
                .roomId(room.getId())
                .roomName(room.getName())
                .totalPower(roomPower)
                .area(room.getArea() != null ? room.getArea() : BigDecimal.ZERO)
                .coefficient(roomCoefficient)
                .applianceCount(applianceCount)
                .totalCableLengthM(totalCableLengthM)
                .cableByType(cableByType.isEmpty() ? List.of() : cableByType)
                .cableLengthSourceNote(cableNote)
                .build();
    }

    private static BigDecimal estimateCableLengthForPoints(List<ElectricalPoint> roomPoints, FloorPlan floorPlan) {
        if (floorPlan == null || roomPoints.isEmpty()) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (ElectricalPoint point : roomPoints) {
            BigDecimal distance = BigDecimal.valueOf(Math.sqrt(
                    point.getPositionX().doubleValue() * point.getPositionX().doubleValue() +
                            point.getPositionY().doubleValue() * point.getPositionY().doubleValue()
            )).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            sum = sum.add(distance.multiply(BigDecimal.valueOf(2.1)));
        }
        return sum.setScale(2, RoundingMode.HALF_UP);
    }

    private static String cableRunTypeKey(CableRun run) {
        if (run.getCableType() != null) {
            return "id:" + run.getCableType().getId();
        }
        return "unknown";
    }

    private static void ensureCableMeta(Map<String, CableTypeMeta> cableMetaByKey, String key, CableRun run) {
        if (cableMetaByKey.containsKey(key)) {
            return;
        }
        if (run.getCableType() != null) {
            CableType ct = run.getCableType();
            cableMetaByKey.put(key, new CableTypeMeta(ct.getName(), ct.getCrossSectionMm2()));
        } else {
            cableMetaByKey.put(key, new CableTypeMeta("Тип кабеля не указан", null));
        }
    }

    private static Long parseCableTypeId(String key) {
        if (key != null && key.startsWith("id:")) {
            try {
                return Long.parseLong(key.substring(3));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private List<Long> resolveCableRunTargetRoomIds(String pathJson, Map<Long, ElectricalPoint> pointsById) {
        if (pathJson == null || pathJson.isBlank()) {
            return List.of();
        }
        try {
            JsonNode root = objectMapper.readTree(pathJson);
            if (!root.isArray() || root.size() == 0) {
                return List.of();
            }
            JsonNode first = root.get(0);
            JsonNode last = root.get(root.size() - 1);
            Long firstRoom = roomIdFromPathNode(first, pointsById);
            Long lastRoom = roomIdFromPathNode(last, pointsById);
            if (firstRoom != null && lastRoom != null) {
                if (firstRoom.equals(lastRoom)) {
                    return List.of(firstRoom);
                }
                return List.of(firstRoom, lastRoom);
            }
            if (lastRoom != null) {
                return List.of(lastRoom);
            }
            if (firstRoom != null) {
                return List.of(firstRoom);
            }
            return List.of();
        } catch (Exception e) {
            return List.of();
        }
    }

    private static Long roomIdFromPathNode(JsonNode node, Map<Long, ElectricalPoint> pointsById) {
        if (node == null) {
            return null;
        }
        JsonNode pointIdNode = node.get("pointId");
        if (pointIdNode == null || !pointIdNode.isNumber()) {
            return null;
        }
        ElectricalPoint ep = pointsById.get(pointIdNode.longValue());
        if (ep == null || ep.getRoom() == null) {
            return null;
        }
        return ep.getRoom().getId();
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
}
