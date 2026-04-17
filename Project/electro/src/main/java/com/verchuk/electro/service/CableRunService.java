package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.CableRunRequest;
import com.verchuk.electro.dto.response.CableRunResponse;
import com.verchuk.electro.exception.BadRequestException;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.CableRun;
import com.verchuk.electro.model.CableType;
import com.verchuk.electro.model.Circuit;
import com.verchuk.electro.model.ElectricalPoint;
import com.verchuk.electro.model.FloorPlan;
import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.Role;
import com.verchuk.electro.model.Wall;
import com.verchuk.electro.model.WallOpening;
import com.verchuk.electro.repository.CableRunRepository;
import com.verchuk.electro.repository.CableTypeRepository;
import com.verchuk.electro.repository.CircuitRepository;
import com.verchuk.electro.repository.FloorPlanRepository;
import com.verchuk.electro.repository.ProjectRepository;
import com.verchuk.electro.repository.ElectricalPointRepository;
import com.verchuk.electro.repository.WallRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CableRunService {
    @Autowired
    private CableRunRepository cableRunRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private CircuitRepository circuitRepository;

    @Autowired
    private CableTypeRepository cableTypeRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private FloorPlanRepository floorPlanRepository;

    @Autowired
    private ElectricalPointRepository electricalPointRepository;

    @Autowired
    private WallRepository wallRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final BigDecimal MIN_SEGMENT_CM = BigDecimal.valueOf(5);
    private static final BigDecimal ORTHOGONAL_TOLERANCE_CM = BigDecimal.ONE;
    private static final BigDecimal ENDPOINT_SNAP_TOLERANCE_CM = BigDecimal.valueOf(35);
    private static final BigDecimal OPENING_LINE_TOLERANCE_CM = BigDecimal.valueOf(2);

    @Transactional(readOnly = true)
    public List<CableRunResponse> getCableRuns(Long projectId) {
        ensureProjectAccess(projectId);
        return cableRunRepository.findByProjectIdOrderByIdAsc(projectId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public CableRunResponse createCableRun(Long projectId, CableRunRequest request) {
        Project project = ensureProjectAccess(projectId);
        Circuit circuit = resolveCircuit(projectId, request.getCircuitId());
        CableType cableType = resolveCableType(request.getCableTypeId());
        RouteValidationResult routeValidation = validateAndNormalizePath(projectId, request.getPathJson(), request.getLengthM(), circuit);
        syncEndpointCircuits(routeValidation.nodes(), projectId, circuit);

        CableRun cableRun = CableRun.builder()
                .project(project)
                .circuit(circuit)
                .cableType(cableType)
                .lengthM(routeValidation.validatedLengthM())
                .installationScope(request.getInstallationScope())
                .pathJson(routeValidation.normalizedPathJson())
                .notes(request.getNotes())
                .build();

        return mapToResponse(cableRunRepository.save(cableRun));
    }

    @Transactional
    public CableRunResponse updateCableRun(Long projectId, Long cableRunId, CableRunRequest request) {
        ensureProjectAccess(projectId);
        CableRun cableRun = cableRunRepository.findByIdAndProjectId(cableRunId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("CableRun", "id", cableRunId));
        Circuit circuit = resolveCircuit(projectId, request.getCircuitId());
        RouteValidationResult routeValidation = validateAndNormalizePath(projectId, request.getPathJson(), request.getLengthM(), circuit);
        syncEndpointCircuits(routeValidation.nodes(), projectId, circuit);

        cableRun.setCircuit(circuit);
        cableRun.setCableType(resolveCableType(request.getCableTypeId()));
        cableRun.setLengthM(routeValidation.validatedLengthM());
        cableRun.setInstallationScope(request.getInstallationScope());
        cableRun.setPathJson(routeValidation.normalizedPathJson());
        cableRun.setNotes(request.getNotes());

        return mapToResponse(cableRunRepository.save(cableRun));
    }

    @Transactional
    public void deleteCableRun(Long projectId, Long cableRunId) {
        ensureProjectAccess(projectId);
        CableRun cableRun = cableRunRepository.findByIdAndProjectId(cableRunId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("CableRun", "id", cableRunId));
        cableRunRepository.delete(cableRun);
    }

    private Project ensureProjectAccess(Long projectId) {
        var currentUser = userService.getCurrentUser();
        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == Role.RoleName.ADMIN);

        if (isAdmin) {
            return projectRepository.findById(projectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
        }

        return projectRepository.findByIdAndDesigner(projectId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
    }

    private Circuit resolveCircuit(Long projectId, Long circuitId) {
        if (circuitId == null) {
            return null;
        }
        return circuitRepository.findByIdAndProjectId(circuitId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Circuit", "id", circuitId));
    }

    private CableType resolveCableType(Long cableTypeId) {
        if (cableTypeId == null) {
            return null;
        }
        return cableTypeRepository.findById(cableTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("CableType", "id", cableTypeId));
    }

    private RouteValidationResult validateAndNormalizePath(Long projectId, String pathJson, BigDecimal requestedLengthM, Circuit selectedCircuit) {
        if (pathJson == null || pathJson.isBlank()) {
            throw new BadRequestException("Трасса кабеля обязательна: pathJson пустой.");
        }

        FloorPlan floorPlan = floorPlanRepository.findByProjectId(projectId)
                .orElseThrow(() -> new BadRequestException("Для трассы нужен план проекта."));

        JsonNode root;
        try {
            root = objectMapper.readTree(pathJson);
        } catch (Exception ex) {
            throw new BadRequestException("Некорректный формат pathJson.");
        }
        if (!root.isArray() || root.size() < 2) {
            throw new BadRequestException("Трасса должна содержать минимум две точки.");
        }

        List<ElectricalPoint> points = electricalPointRepository.findByFloorPlanId(floorPlan.getId());
        Map<Long, ElectricalPoint> pointsById = new HashMap<>();
        for (ElectricalPoint point : points) {
            pointsById.put(point.getId(), point);
        }

        BigDecimal effectiveMaxX = floorPlan.getWidth().multiply(BigDecimal.valueOf(1.5));
        BigDecimal effectiveMaxY = floorPlan.getHeight().multiply(BigDecimal.valueOf(1.5));
        List<PointCm> nodes = new ArrayList<>();
        for (JsonNode node : root) {
            JsonNode xNode = node.get("x");
            JsonNode yNode = node.get("y");
            if (xNode == null || yNode == null || !xNode.isNumber() || !yNode.isNumber()) {
                throw new BadRequestException("Каждая точка трассы должна содержать числовые x и y.");
            }
            BigDecimal x = xNode.decimalValue().setScale(2, RoundingMode.HALF_UP);
            BigDecimal y = yNode.decimalValue().setScale(2, RoundingMode.HALF_UP);
            BigDecimal z = BigDecimal.ZERO;
            Long pointId = null;
            JsonNode zNode = node.get("z");
            if (zNode != null) {
                if (!zNode.isNumber()) {
                    throw new BadRequestException("Координата z должна быть числом.");
                }
                z = zNode.decimalValue().setScale(2, RoundingMode.HALF_UP);
                if (z.compareTo(BigDecimal.ZERO) < 0 || z.compareTo(BigDecimal.valueOf(1000)) > 0) {
                    throw new BadRequestException("Координата z должна быть в диапазоне 0..1000 см.");
                }
            }
            JsonNode pointIdNode = node.get("pointId");
            if (pointIdNode != null && !pointIdNode.isNull()) {
                if (!pointIdNode.isNumber()) {
                    throw new BadRequestException("pointId должен быть числом.");
                }
                pointId = pointIdNode.longValue();
                if (!pointsById.containsKey(pointId)) {
                    throw new BadRequestException("pointId не найден в текущем плане проекта.");
                }
            }
            if (x.compareTo(BigDecimal.ZERO) < 0 || y.compareTo(BigDecimal.ZERO) < 0
                    || x.compareTo(effectiveMaxX) > 0 || y.compareTo(effectiveMaxY) > 0) {
                throw new BadRequestException("Точка трассы выходит за допустимые границы плана.");
            }
            nodes.add(new PointCm(x, y, z, pointId));
        }

        BigDecimal totalLengthCm = BigDecimal.ZERO;
        for (int i = 1; i < nodes.size(); i++) {
            PointCm prev = nodes.get(i - 1);
            PointCm current = nodes.get(i);
            BigDecimal dx = current.x().subtract(prev.x()).abs();
            BigDecimal dy = current.y().subtract(prev.y()).abs();
            BigDecimal dz = current.z().subtract(prev.z()).abs();

            int changedAxes = 0;
            if (dx.compareTo(ORTHOGONAL_TOLERANCE_CM) > 0) changedAxes++;
            if (dy.compareTo(ORTHOGONAL_TOLERANCE_CM) > 0) changedAxes++;
            if (dz.compareTo(ORTHOGONAL_TOLERANCE_CM) > 0) changedAxes++;
            if (changedAxes != 1) {
                throw new BadRequestException("Каждый сегмент трассы должен менять только одну координату (X, Y или Z).");
            }

            BigDecimal segmentLengthCm = dx.max(dy).max(dz).setScale(2, RoundingMode.HALF_UP);
            if (segmentLengthCm.compareTo(MIN_SEGMENT_CM) < 0) {
                throw new BadRequestException("Сегмент трассы слишком короткий. Минимум 5 см.");
            }
            totalLengthCm = totalLengthCm.add(segmentLengthCm);
        }

        validateRouteEndpointsNearElectricalPoints(floorPlan, nodes);
        validateEndpointPointTypes(nodes, pointsById);
        validateCircuitCompatibility(nodes, pointsById, selectedCircuit);
        validateRouteDoesNotCrossOpenings(floorPlan, nodes);

        BigDecimal validatedLengthM = totalLengthCm
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        if (requestedLengthM != null) {
            BigDecimal delta = validatedLengthM.subtract(requestedLengthM).abs();
            if (delta.compareTo(BigDecimal.valueOf(0.20)) > 0) {
                throw new BadRequestException(String.format(
                        Locale.ROOT,
                        "Длина трассы не совпадает с маршрутом: передано %.2f м, расчетно %.2f м.",
                        requestedLengthM,
                        validatedLengthM));
            }
        }

        try {
            return new RouteValidationResult(validatedLengthM, objectMapper.writeValueAsString(nodes), nodes);
        } catch (Exception ex) {
            throw new BadRequestException("Не удалось нормализовать pathJson.");
        }
    }

    private void validateRouteEndpointsNearElectricalPoints(FloorPlan floorPlan, List<PointCm> nodes) {
        List<ElectricalPoint> points = electricalPointRepository.findByFloorPlanId(floorPlan.getId());
        if (points.isEmpty()) {
            throw new BadRequestException("Нельзя сохранить трассу: на плане нет электрических точек. Сначала расставьте розетки, выключатели или точки старта.");
        }
        PointCm start = nodes.get(0);
        PointCm end = nodes.get(nodes.size() - 1);
        BigDecimal minStart = minDistanceToAnyPoint(start, points);
        BigDecimal minEnd = minDistanceToAnyPoint(end, points);
        if (minStart.compareTo(ENDPOINT_SNAP_TOLERANCE_CM) > 0) {
            throw new BadRequestException(String.format(
                    "Начало трассы слишком далеко от ближайшей электрической точки (%.0f см). Переместите первый узел ближе к розетке, выключателю или точке старта (не далее %d см).",
                    minStart.doubleValue(), ENDPOINT_SNAP_TOLERANCE_CM.intValue()));
        }
        if (minEnd.compareTo(ENDPOINT_SNAP_TOLERANCE_CM) > 0) {
            throw new BadRequestException(String.format(
                    "Конец трассы слишком далеко от ближайшей электрической точки (%.0f см). Переместите последний узел ближе к розетке, выключателю или точке старта (не далее %d см).",
                    minEnd.doubleValue(), ENDPOINT_SNAP_TOLERANCE_CM.intValue()));
        }
    }

    private BigDecimal minDistanceToAnyPoint(PointCm node, List<ElectricalPoint> points) {
        BigDecimal min = null;
        for (ElectricalPoint point : points) {
            BigDecimal dx = node.x().subtract(point.getPositionX()).abs();
            BigDecimal dy = node.y().subtract(point.getPositionY()).abs();
            BigDecimal distance = BigDecimal.valueOf(Math.hypot(dx.doubleValue(), dy.doubleValue()))
                    .setScale(2, RoundingMode.HALF_UP);
            if (min == null || distance.compareTo(min) < 0) {
                min = distance;
            }
        }
        return min == null ? BigDecimal.valueOf(999999) : min;
    }

    private void validateEndpointPointTypes(List<PointCm> nodes, Map<Long, ElectricalPoint> pointsById) {
        PointCm start = nodes.get(0);
        PointCm end = nodes.get(nodes.size() - 1);
        if (start.pointId() == null || end.pointId() == null) {
            return;
        }
        ElectricalPoint startPoint = pointsById.get(start.pointId());
        ElectricalPoint endPoint = pointsById.get(end.pointId());
        if (startPoint == null || endPoint == null
                || startPoint.getElectricalSymbol() == null || endPoint.getElectricalSymbol() == null) {
            return;
        }

        String startType = startPoint.getElectricalSymbol().getType() != null
                ? startPoint.getElectricalSymbol().getType().toLowerCase(Locale.ROOT)
                : "";
        String endType = endPoint.getElectricalSymbol().getType() != null
                ? endPoint.getElectricalSymbol().getType().toLowerCase(Locale.ROOT)
                : "";

        if ("switch".equals(startType) && "outlet".equals(endType)
                || "outlet".equals(startType) && "switch".equals(endType)) {
            throw new BadRequestException("Прямая трасса между выключателем и розеткой запрещена. Добавьте промежуточную точку/линию.");
        }
        if ("switch".equals(startType) && "switch".equals(endType)) {
            throw new BadRequestException("Трасса не может начинаться и заканчиваться на выключателях.");
        }
    }

    private void validateCircuitCompatibility(List<PointCm> nodes, Map<Long, ElectricalPoint> pointsById, Circuit selectedCircuit) {
        PointCm start = nodes.get(0);
        PointCm end = nodes.get(nodes.size() - 1);
        ElectricalPoint startPoint = start.pointId() != null ? pointsById.get(start.pointId()) : null;
        ElectricalPoint endPoint = end.pointId() != null ? pointsById.get(end.pointId()) : null;

        Circuit startCircuit = startPoint != null ? startPoint.getCircuit() : null;
        Circuit endCircuit = endPoint != null ? endPoint.getCircuit() : null;

        if (startCircuit != null && endCircuit != null && !startCircuit.getId().equals(endCircuit.getId())) {
            throw new BadRequestException("Точки начала и конца принадлежат разным цепям. Маршрут должен быть в пределах одной цепи.");
        }

        if (selectedCircuit == null) {
            if (startCircuit != null && endCircuit != null && startCircuit.getId().equals(endCircuit.getId())) {
                throw new BadRequestException(
                        "Оба конца трассы принадлежат цепи «" + startCircuit.getName() + "». " +
                        "Выберите эту цепь в поле «Электрическая цепь» перед сохранением.");
            }
            return;
        }

        if (startCircuit != null && !startCircuit.getId().equals(selectedCircuit.getId())) {
            throw new BadRequestException("Начальная точка не принадлежит выбранной цепи.");
        }
        if (endCircuit != null && !endCircuit.getId().equals(selectedCircuit.getId())) {
            throw new BadRequestException("Конечная точка не принадлежит выбранной цепи.");
        }

        validateCircuitProtectionForEndpointTypes(startPoint, endPoint, selectedCircuit);
    }

    private void validateCircuitProtectionForEndpointTypes(ElectricalPoint startPoint, ElectricalPoint endPoint, Circuit selectedCircuit) {
        if (selectedCircuit == null) {
            return;
        }
        int breaker = selectedCircuit.getBreakerRatingA() != null ? selectedCircuit.getBreakerRatingA() : 0;
        int rcd = selectedCircuit.getRcdRatingMa() != null ? selectedCircuit.getRcdRatingMa() : 0;

        boolean hasOutlet = isType(startPoint, "outlet") || isType(endPoint, "outlet");
        boolean hasLight = isType(startPoint, "light") || isType(endPoint, "light");

        if (hasOutlet && breaker > 25) {
            throw new BadRequestException("Для розеточных линий автомат цепи не должен превышать 25А.");
        }
        if (hasLight && breaker > 16) {
            throw new BadRequestException("Для осветительных линий автомат цепи не должен превышать 16А.");
        }
        if ((hasOutlet || hasLight) && rcd > 0 && rcd > 30) {
            throw new BadRequestException("Для бытовых линий (свет/розетки) УЗО цепи должно быть не более 30 мА.");
        }
    }

    private boolean isType(ElectricalPoint point, String type) {
        return point != null
                && point.getElectricalSymbol() != null
                && point.getElectricalSymbol().getType() != null
                && type.equalsIgnoreCase(point.getElectricalSymbol().getType());
    }

    private void syncEndpointCircuits(List<PointCm> nodes, Long projectId, Circuit selectedCircuit) {
        if (selectedCircuit == null || nodes == null || nodes.size() < 2) {
            return;
        }
        PointCm start = nodes.get(0);
        PointCm end = nodes.get(nodes.size() - 1);
        syncPointCircuit(start.pointId(), projectId, selectedCircuit);
        syncPointCircuit(end.pointId(), projectId, selectedCircuit);
    }

    private void syncPointCircuit(Long pointId, Long projectId, Circuit selectedCircuit) {
        if (pointId == null) {
            return;
        }
        ElectricalPoint point = electricalPointRepository.findById(pointId)
                .orElseThrow(() -> new ResourceNotFoundException("ElectricalPoint", "id", pointId));
        if (!point.getFloorPlan().getProject().getId().equals(projectId)) {
            throw new BadRequestException("Электрическая точка не принадлежит проекту трассы.");
        }
        if (point.getCircuit() == null) {
            point.setCircuit(selectedCircuit);
            electricalPointRepository.save(point);
            return;
        }
        if (!point.getCircuit().getId().equals(selectedCircuit.getId())) {
            throw new BadRequestException("Нельзя автоматически привязать точку к цепи: точка уже принадлежит другой цепи.");
        }
    }

    private void validateRouteDoesNotCrossOpenings(FloorPlan floorPlan, List<PointCm> nodes) {
        List<Wall> walls = wallRepository.findByFloorPlanId(floorPlan.getId());
        if (walls.isEmpty()) {
            return;
        }

        for (int i = 1; i < nodes.size(); i++) {
            PointCm a = nodes.get(i - 1);
            PointCm b = nodes.get(i);
            BigDecimal dx = b.x().subtract(a.x()).abs();
            BigDecimal dy = b.y().subtract(a.y()).abs();
            if (dx.compareTo(ORTHOGONAL_TOLERANCE_CM) <= 0 && dy.compareTo(ORTHOGONAL_TOLERANCE_CM) <= 0) {
                continue;
            }
            BigDecimal segmentHeightCm = a.z().min(b.z());

            for (Wall wall : walls) {
                if (wall.getOpenings() == null || wall.getOpenings().isEmpty()) {
                    continue;
                }
                if (!segmentBelongsToWallLine(a, b, wall)) {
                    continue;
                }
                BigDecimal segStart = projectionDistanceFromWallStart(a, wall);
                BigDecimal segEnd = projectionDistanceFromWallStart(b, wall);
                BigDecimal from = segStart.min(segEnd);
                BigDecimal to = segStart.max(segEnd);

                for (WallOpening opening : wall.getOpenings()) {
                    BigDecimal openingFrom = opening.getPosition();
                    BigDecimal openingTo = opening.getPosition().add(opening.getWidth());
                    boolean overlaps =
                            openingTo.compareTo(from) > 0 &&
                            to.compareTo(openingFrom) > 0;
                    if (!overlaps) {
                        continue;
                    }
                    BigDecimal openingHeight = opening.getHeight() != null
                            ? opening.getHeight()
                            : BigDecimal.valueOf(220);
                    if (segmentHeightCm.compareTo(openingHeight) < 0) {
                        throw new BadRequestException("Трасса проходит через оконный/дверной проем. Измените маршрут или высоту прокладки.");
                    }
                }
            }
        }
    }

    private boolean segmentBelongsToWallLine(PointCm a, PointCm b, Wall wall) {
        BigDecimal wx1 = wall.getStartX();
        BigDecimal wy1 = wall.getStartY();
        BigDecimal wx2 = wall.getEndX();
        BigDecimal wy2 = wall.getEndY();
        BigDecimal lineLen = BigDecimal.valueOf(Math.hypot(
                wx2.subtract(wx1).doubleValue(),
                wy2.subtract(wy1).doubleValue()));
        if (lineLen.compareTo(BigDecimal.valueOf(0.001)) < 0) {
            return false;
        }

        BigDecimal da = distancePointToLine(a.x(), a.y(), wx1, wy1, wx2, wy2);
        BigDecimal db = distancePointToLine(b.x(), b.y(), wx1, wy1, wx2, wy2);
        return da.compareTo(OPENING_LINE_TOLERANCE_CM) <= 0 && db.compareTo(OPENING_LINE_TOLERANCE_CM) <= 0;
    }

    private BigDecimal distancePointToLine(
            BigDecimal px, BigDecimal py,
            BigDecimal x1, BigDecimal y1,
            BigDecimal x2, BigDecimal y2
    ) {
        double numerator = Math.abs(
                (y2.doubleValue() - y1.doubleValue()) * px.doubleValue()
                        - (x2.doubleValue() - x1.doubleValue()) * py.doubleValue()
                        + x2.doubleValue() * y1.doubleValue()
                        - y2.doubleValue() * x1.doubleValue()
        );
        double denominator = Math.hypot(
                y2.doubleValue() - y1.doubleValue(),
                x2.doubleValue() - x1.doubleValue()
        );
        if (denominator == 0.0) {
            return BigDecimal.valueOf(999999);
        }
        return BigDecimal.valueOf(numerator / denominator).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal projectionDistanceFromWallStart(PointCm p, Wall wall) {
        double wx1 = wall.getStartX().doubleValue();
        double wy1 = wall.getStartY().doubleValue();
        double wx2 = wall.getEndX().doubleValue();
        double wy2 = wall.getEndY().doubleValue();
        double vx = wx2 - wx1;
        double vy = wy2 - wy1;
        double len2 = vx * vx + vy * vy;
        if (len2 == 0.0) {
            return BigDecimal.ZERO;
        }
        double t = ((p.x().doubleValue() - wx1) * vx + (p.y().doubleValue() - wy1) * vy) / len2;
        double wallLength = Math.sqrt(len2);
        return BigDecimal.valueOf(t * wallLength).setScale(2, RoundingMode.HALF_UP);
    }

    private record PointCm(BigDecimal x, BigDecimal y, BigDecimal z, Long pointId) {}

    private record RouteValidationResult(BigDecimal validatedLengthM, String normalizedPathJson, List<PointCm> nodes) {}

    private CableRunResponse mapToResponse(CableRun cableRun) {
        return CableRunResponse.builder()
                .id(cableRun.getId())
                .projectId(cableRun.getProject().getId())
                .circuitId(cableRun.getCircuit() != null ? cableRun.getCircuit().getId() : null)
                .circuitName(cableRun.getCircuit() != null ? cableRun.getCircuit().getName() : null)
                .cableTypeId(cableRun.getCableType() != null ? cableRun.getCableType().getId() : null)
                .cableTypeName(cableRun.getCableType() != null ? cableRun.getCableType().getName() : null)
                .lengthM(cableRun.getLengthM())
                .installationScope(cableRun.getInstallationScope())
                .pathJson(cableRun.getPathJson())
                .notes(cableRun.getNotes())
                .build();
    }
}
