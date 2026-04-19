package com.verchuk.electro.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.verchuk.electro.dto.request.CableRunRequest;
import com.verchuk.electro.dto.request.ElectricalPointRequest;
import com.verchuk.electro.dto.request.SaveSpecificationRequest;
import com.verchuk.electro.dto.request.WallOpeningRequest;
import com.verchuk.electro.dto.request.WallRequest;
import com.verchuk.electro.dto.response.*;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.CableRun;
import com.verchuk.electro.model.CableType;
import com.verchuk.electro.model.Circuit;
import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.Room;
import com.verchuk.electro.model.SavedSpecification;
import com.verchuk.electro.repository.CableRunRepository;
import com.verchuk.electro.repository.CableTypeRepository;
import com.verchuk.electro.repository.CircuitRepository;
import com.verchuk.electro.repository.ProjectRepository;
import com.verchuk.electro.repository.RoomRepository;
import com.verchuk.electro.repository.SavedSpecificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SavedSpecificationService {
    @Autowired
    private SavedSpecificationRepository savedSpecificationRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private SpecificationService specificationService;

    @Autowired
    private CalculationService calculationService;

    @Autowired
    private UserService userService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RoomService roomService;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private WallService wallService;

    @Autowired
    private ElectricalPointService electricalPointService;

    @Autowired
    private CableRunService cableRunService;

    @Autowired
    private CableRunRepository cableRunRepository;

    @Autowired
    private CircuitRepository circuitRepository;

    @Autowired
    private CableTypeRepository cableTypeRepository;

    @Transactional
    public SavedSpecificationResponse saveSpecification(SaveSpecificationRequest request) {
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(request.getProjectId(), currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", request.getProjectId()));

        SpecificationResponse spec = specificationService.getSpecification(request.getProjectId());
        CalculationReportResponse calc = calculationService.getCalculationReport(request.getProjectId());

        List<RoomResponse> rooms = roomService.getRoomsByProject(request.getProjectId());
        List<WallResponse> walls = wallService.getWallsByProject(request.getProjectId());
        List<ElectricalPointResponse> points = electricalPointService.getElectricalPointsByProject(request.getProjectId());
        List<CableRunResponse> routes = cableRunService.getCableRuns(request.getProjectId());

        ProjectSnapshotResponse snapshot = ProjectSnapshotResponse.builder()
                .rooms(rooms)
                .walls(walls)
                .electricalPoints(points)
                .routes(routes)
                .build();

        try {
            String specJson = objectMapper.writeValueAsString(spec);
            String calcJson = objectMapper.writeValueAsString(calc);
            String snapshotJson = objectMapper.writeValueAsString(snapshot);

            SavedSpecification saved = SavedSpecification.builder()
                    .project(project)
                    .name(request.getName())
                    .specificationData(specJson)
                    .calculationData(calcJson)
                    .projectSnapshotData(snapshotJson)
                    .totalCost(calc.getTotalProjectCost())
                    .totalPower(calc.getTotalPowerConsumption())
                    .totalCurrent(calc.getTotalCurrent())
                    .cableSection(calc.getRecommendedCableCrossSection())
                    .rcdRating(calc.getRecommendedRcdRating())
                    .build();

            saved = savedSpecificationRepository.save(saved);
            return mapToResponse(saved);
        } catch (Exception e) {
            throw new RuntimeException("Error saving specification: " + e.getMessage(), e);
        }
    }

    public List<SavedSpecificationResponse> getSavedSpecifications(Long projectId) {
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        return savedSpecificationRepository.findByProject(project).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public SavedSpecificationResponse getSavedSpecification(Long projectId, Long specificationId) {
        return getSavedSpecification(projectId, specificationId, false);
    }

    public SavedSpecificationResponse getSavedSpecification(Long projectId, Long specificationId, boolean includeFullData) {
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        SavedSpecification saved = savedSpecificationRepository.findById(specificationId)
                .orElseThrow(() -> new ResourceNotFoundException("SavedSpecification", "id", specificationId));

        if (!saved.getProject().getId().equals(project.getId())) {
            throw new ResourceNotFoundException("SavedSpecification", "id", specificationId);
        }

        return mapToResponse(saved, includeFullData);
    }

    @Transactional
    public void restoreFromSnapshot(Long projectId, Long specificationId) {
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        SavedSpecification saved = savedSpecificationRepository.findById(specificationId)
                .orElseThrow(() -> new ResourceNotFoundException("SavedSpecification", "id", specificationId));

        if (!saved.getProject().getId().equals(project.getId())) {
            throw new ResourceNotFoundException("SavedSpecification", "id", specificationId);
        }

        if (saved.getProjectSnapshotData() == null) {
            throw new RuntimeException("Snapshot data not available for this saved calculation");
        }

        try {
            ProjectSnapshotResponse snapshot = objectMapper.readValue(
                    saved.getProjectSnapshotData(), ProjectSnapshotResponse.class);

            // 1. Restore room geometry and limits
            if (snapshot.getRooms() != null) {
                for (RoomResponse roomSnap : snapshot.getRooms()) {
                    roomRepository.findById(roomSnap.getId()).ifPresent(room -> {
                        room.setPositionX(roomSnap.getPositionX());
                        room.setPositionY(roomSnap.getPositionY());
                        room.setWidth(roomSnap.getWidth());
                        room.setHeight(roomSnap.getHeight());
                        room.setPolygonPoints(roomSnap.getPolygonPoints());
                        room.setSocketGroupsConfig(roomSnap.getSocketGroupsConfig());
                        room.setMaxOutlets(roomSnap.getMaxOutlets());
                        room.setMaxSwitches(roomSnap.getMaxSwitches());
                        room.setMaxDoors(roomSnap.getMaxDoors());
                        room.setMaxWindows(roomSnap.getMaxWindows());
                        room.setMaxLights(roomSnap.getMaxLights());
                        roomRepository.save(room);
                    });
                }
            }

            // 2. Restore walls (delete all + recreate)
            if (snapshot.getWalls() != null) {
                List<WallRequest> wallRequests = snapshot.getWalls().stream()
                        .map(w -> {
                            WallRequest req = new WallRequest();
                            req.setStartX(w.getStartX());
                            req.setStartY(w.getStartY());
                            req.setEndX(w.getEndX());
                            req.setEndY(w.getEndY());
                            req.setThickness(w.getThickness());
                            req.setWallType(w.getWallType());
                            req.setRoomId(w.getRoomId());
                            if (w.getOpenings() != null) {
                                List<WallOpeningRequest> openings = w.getOpenings().stream()
                                        .map(o -> {
                                            WallOpeningRequest or = new WallOpeningRequest();
                                            or.setPosition(o.getPosition());
                                            or.setWidth(o.getWidth());
                                            or.setHeight(o.getHeight());
                                            or.setOpeningType(o.getOpeningType());
                                            return or;
                                        }).collect(Collectors.toList());
                                req.setOpenings(openings);
                            }
                            return req;
                        }).collect(Collectors.toList());
                wallService.saveWalls(projectId, wallRequests);
            }

            // 3. Restore electrical points (delete all + recreate)
            if (snapshot.getElectricalPoints() != null) {
                List<ElectricalPointRequest> pointRequests = snapshot.getElectricalPoints().stream()
                        .map(p -> {
                            ElectricalPointRequest req = new ElectricalPointRequest();
                            req.setElectricalSymbolId(p.getElectricalSymbol() != null ? p.getElectricalSymbol().getId() : null);
                            req.setApplianceId(p.getApplianceId());
                            req.setRoomId(p.getRoomId());
                            req.setPositionX(p.getPositionX());
                            req.setPositionY(p.getPositionY());
                            req.setRatedPowerW(p.getRatedPowerW());
                            req.setHeightFromFloor(p.getHeightFromFloor());
                            req.setRotation(p.getRotation());
                            req.setCircuitId(p.getCircuitId());
                            req.setCableTypeId(p.getCableTypeId());
                            req.setInstallationScope(p.getInstallationScope());
                            req.setGroup(p.getGroup());
                            req.setNotes(p.getNotes());
                            return req;
                        }).collect(Collectors.toList());
                electricalPointService.saveElectricalPoints(projectId, pointRequests);
            }

            // 4. Restore cable runs (delete all + recreate directly to preserve geometry)
            cableRunRepository.deleteByProjectId(projectId);
            cableRunRepository.flush();

            if (snapshot.getRoutes() != null && !snapshot.getRoutes().isEmpty()) {
                Map<Long, Circuit> circuitMap = circuitRepository.findByProjectIdOrderByIdAsc(projectId)
                        .stream().collect(Collectors.toMap(Circuit::getId, c -> c));
                Map<Long, CableType> cableTypeMap = cableTypeRepository.findAll()
                        .stream().collect(Collectors.toMap(CableType::getId, ct -> ct));

                List<CableRun> runsToSave = new ArrayList<>();
                for (CableRunResponse routeSnap : snapshot.getRoutes()) {
                    String cleanedPath = stripPointIds(routeSnap.getPathJson());
                    CableRun run = CableRun.builder()
                            .project(project)
                            .circuit(routeSnap.getCircuitId() != null ? circuitMap.get(routeSnap.getCircuitId()) : null)
                            .cableType(routeSnap.getCableTypeId() != null ? cableTypeMap.get(routeSnap.getCableTypeId()) : null)
                            .lengthM(routeSnap.getLengthM())
                            .installationScope(routeSnap.getInstallationScope())
                            .pathJson(cleanedPath)
                            .notes(routeSnap.getNotes())
                            .build();
                    runsToSave.add(run);
                }
                cableRunRepository.saveAll(runsToSave);
            }

        } catch (Exception e) {
            throw new RuntimeException("Error restoring from snapshot: " + e.getMessage(), e);
        }
    }

    /** Strip pointId references from pathJson nodes to avoid stale ID issues after restore */
    private String stripPointIds(String pathJson) {
        if (pathJson == null || pathJson.isBlank()) return pathJson;
        try {
            var tree = objectMapper.readTree(pathJson);
            if (tree.isArray()) {
                for (var node : tree) {
                    if (node instanceof ObjectNode on) {
                        on.remove("pointId");
                    }
                }
            }
            return objectMapper.writeValueAsString(tree);
        } catch (Exception e) {
            return pathJson;
        }
    }

    @Transactional
    public void deleteSavedSpecification(Long projectId, Long specificationId) {
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        SavedSpecification saved = savedSpecificationRepository.findById(specificationId)
                .orElseThrow(() -> new ResourceNotFoundException("SavedSpecification", "id", specificationId));

        if (!saved.getProject().getId().equals(project.getId())) {
            throw new ResourceNotFoundException("SavedSpecification", "id", specificationId);
        }

        savedSpecificationRepository.delete(saved);
    }

    private SavedSpecificationResponse mapToResponse(SavedSpecification saved) {
        return mapToResponse(saved, false);
    }

    private SavedSpecificationResponse mapToResponse(SavedSpecification saved, boolean includeFullData) {
        SavedSpecificationResponse.SavedSpecificationResponseBuilder builder = SavedSpecificationResponse.builder()
                .id(saved.getId())
                .projectId(saved.getProject().getId())
                .name(saved.getName())
                .totalCost(saved.getTotalCost())
                .totalPower(saved.getTotalPower())
                .totalCurrent(saved.getTotalCurrent())
                .cableSection(saved.getCableSection())
                .rcdRating(saved.getRcdRating())
                .createdAt(saved.getCreatedAt())
                .updatedAt(saved.getUpdatedAt());

        if (includeFullData) {
            try {
                if (saved.getSpecificationData() != null) {
                    SpecificationResponse spec = objectMapper.readValue(
                            saved.getSpecificationData(), SpecificationResponse.class);
                    builder.specification(spec);
                }
                if (saved.getCalculationData() != null) {
                    CalculationReportResponse calc = objectMapper.readValue(
                            saved.getCalculationData(), CalculationReportResponse.class);
                    builder.calculation(calc);
                }
                if (saved.getProjectSnapshotData() != null) {
                    ProjectSnapshotResponse snapshot = objectMapper.readValue(
                            saved.getProjectSnapshotData(), ProjectSnapshotResponse.class);
                    builder.projectSnapshot(snapshot);
                }
            } catch (Exception e) {
                System.err.println("Error parsing saved specification data: " + e.getMessage());
            }
        }

        return builder.build();
    }
}

