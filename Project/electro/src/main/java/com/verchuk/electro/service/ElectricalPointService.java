package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.ElectricalPointRequest;
import com.verchuk.electro.dto.response.ElectricalPointResponse;
import com.verchuk.electro.dto.response.ElectricalSymbolResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.CableType;
import com.verchuk.electro.model.Circuit;
import com.verchuk.electro.model.ElectricalPoint;
import com.verchuk.electro.model.ElectricalSymbol;
import com.verchuk.electro.model.FloorPlan;
import com.verchuk.electro.model.InstallationScope;
import com.verchuk.electro.model.Room;
import com.verchuk.electro.repository.ElectricalPointRepository;
import com.verchuk.electro.repository.ElectricalSymbolRepository;
import com.verchuk.electro.repository.FloorPlanRepository;
import com.verchuk.electro.repository.RoomRepository;
import com.verchuk.electro.repository.CircuitRepository;
import com.verchuk.electro.repository.CableTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ElectricalPointService {
    @Autowired
    private ElectricalPointRepository electricalPointRepository;

    @Autowired
    private FloorPlanRepository floorPlanRepository;

    @Autowired
    private ElectricalSymbolRepository electricalSymbolRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private CircuitRepository circuitRepository;

    @Autowired
    private CableTypeRepository cableTypeRepository;

    @Autowired
    private UserService userService;
    
    @Autowired
    private ElectricalSymbolSelectorService symbolSelectorService;

    @Transactional
    public ElectricalPointResponse createElectricalPoint(Long projectId, ElectricalPointRequest request) {
        FloorPlan floorPlan = getFloorPlanForProject(projectId);
        
        // Загружаем комнату один раз, если указана
        Room room = null;
        if (request.getRoomId() != null) {
            room = roomRepository.findById(request.getRoomId())
                    .orElseThrow(() -> new ResourceNotFoundException("Room", "id", request.getRoomId()));
            if (!room.getProject().getId().equals(projectId)) {
                throw new ResourceNotFoundException("Room", "id", request.getRoomId());
            }
        }

        Circuit circuit = resolveCircuit(projectId, request.getCircuitId());
        CableType cableType = resolveCableType(request.getCableTypeId());
        
        // Автоматический выбор символа, если не указан
        ElectricalSymbol symbol;
        if (request.getElectricalSymbolId() != null) {
            symbol = electricalSymbolRepository.findById(request.getElectricalSymbolId())
                    .orElseThrow(() -> new ResourceNotFoundException("ElectricalSymbol", "id", request.getElectricalSymbolId()));
        } else {
            // Автоматический выбор на основе ТКП 339
            if (request.getSymbolType() == null || request.getSymbolType().isEmpty()) {
                throw new IllegalArgumentException("Тип символа обязателен, если не указан ID символа");
            }
            
            symbol = symbolSelectorService.selectBestSymbol(
                request.getSymbolType(),
                room, // Используем уже загруженную комнату
                request.getPowerConsumption(),
                request.getDistanceFromBath()
            );
            
            if (symbol == null) {
                String roomInfo = room != null && room.getRoomType() != null 
                    ? " для помещения типа '" + room.getRoomType().getName() + "'"
                    : "";
                throw new ResourceNotFoundException(
                    "ElectricalSymbol", 
                    "type", 
                    request.getSymbolType() + roomInfo + " (не найдено подходящих символов в базе данных. Обратитесь к администратору.)"
                );
            }
        }

        ElectricalPoint point = ElectricalPoint.builder()
                .floorPlan(floorPlan)
                .room(room)
                .electricalSymbol(symbol)
                .applianceId(request.getApplianceId())
                .positionX(request.getPositionX())
                .positionY(request.getPositionY())
                .ratedPowerW(request.getRatedPowerW())
                .heightFromFloor(request.getHeightFromFloor())
                .rotation(request.getRotation() != null ? request.getRotation() : BigDecimal.ZERO)
                .circuit(circuit)
                .cableType(cableType)
                .installationScope(request.getInstallationScope() != null ? request.getInstallationScope() : InstallationScope.PLANNED)
                .group(request.getGroup())
                .notes(request.getNotes())
                .build();

        point = electricalPointRepository.save(point);
        return mapToResponse(point);
    }

    @Transactional
    public ElectricalPointResponse updateElectricalPoint(Long projectId, Long pointId, ElectricalPointRequest request) {
        FloorPlan floorPlan = getFloorPlanForProject(projectId);
        ElectricalPoint point = electricalPointRepository.findById(pointId)
                .orElseThrow(() -> new ResourceNotFoundException("ElectricalPoint", "id", pointId));

        if (!point.getFloorPlan().getId().equals(floorPlan.getId())) {
            throw new ResourceNotFoundException("ElectricalPoint", "id", pointId);
        }

        if (request.getElectricalSymbolId() != null) {
            ElectricalSymbol symbol = electricalSymbolRepository.findById(request.getElectricalSymbolId())
                    .orElseThrow(() -> new ResourceNotFoundException("ElectricalSymbol", "id", request.getElectricalSymbolId()));
            point.setElectricalSymbol(symbol);
        }

        if (request.getRoomId() != null) {
            Room room = roomRepository.findById(request.getRoomId())
                    .orElseThrow(() -> new ResourceNotFoundException("Room", "id", request.getRoomId()));
            if (!room.getProject().getId().equals(projectId)) {
                throw new ResourceNotFoundException("Room", "id", request.getRoomId());
            }
            point.setRoom(room);
        } else {
            point.setRoom(null);
        }

        if (request.getPositionX() != null) {
            point.setPositionX(request.getPositionX());
        }
        if (request.getPositionY() != null) {
            point.setPositionY(request.getPositionY());
        }
        if (request.getHeightFromFloor() != null) {
            point.setHeightFromFloor(request.getHeightFromFloor());
        }
        if (request.getRatedPowerW() != null) {
            point.setRatedPowerW(request.getRatedPowerW());
        }
        if (request.getRotation() != null) {
            point.setRotation(request.getRotation());
        }
        if (request.getCircuitId() != null) {
            point.setCircuit(resolveCircuit(projectId, request.getCircuitId()));
        }
        if (request.getCableTypeId() != null) {
            point.setCableType(resolveCableType(request.getCableTypeId()));
        }
        if (request.getInstallationScope() != null) {
            point.setInstallationScope(request.getInstallationScope());
        }
        if (request.getGroup() != null) {
            point.setGroup(request.getGroup());
        }
        if (request.getNotes() != null) {
            point.setNotes(request.getNotes());
        }

        // Обновляем applianceId если он указан
        if (request.getApplianceId() != null) {
            point.setApplianceId(request.getApplianceId());
        }

        point = electricalPointRepository.save(point);
        return mapToResponse(point);
    }

    @Transactional
    public void deleteElectricalPoint(Long projectId, Long pointId) {
        FloorPlan floorPlan = getFloorPlanForProject(projectId);
        ElectricalPoint point = electricalPointRepository.findById(pointId)
                .orElseThrow(() -> new ResourceNotFoundException("ElectricalPoint", "id", pointId));

        if (!point.getFloorPlan().getId().equals(floorPlan.getId())) {
            throw new ResourceNotFoundException("ElectricalPoint", "id", pointId);
        }

        electricalPointRepository.delete(point);
    }

    public List<ElectricalPointResponse> getElectricalPointsByFloorPlan(Long floorPlanId) {
        List<ElectricalPoint> points = electricalPointRepository.findByFloorPlanId(floorPlanId);
        return points.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<ElectricalPointResponse> getElectricalPointsByProject(Long projectId) {
        FloorPlan floorPlan = getFloorPlanForProject(projectId);
        return getElectricalPointsByFloorPlan(floorPlan.getId());
    }

    @Transactional
    public List<ElectricalPointResponse> saveElectricalPoints(Long projectId, List<ElectricalPointRequest> requests) {
        FloorPlan floorPlan = getFloorPlanForProject(projectId);
        
        // Удаляем старые точки
        electricalPointRepository.deleteByFloorPlanId(floorPlan.getId());

        // Создаем новые точки
        List<ElectricalPoint> points = requests.stream()
                .map(request -> {
                    // Автоматический выбор символа, если не указан
                    ElectricalSymbol symbol;
                    if (request.getElectricalSymbolId() != null) {
                        symbol = electricalSymbolRepository.findById(request.getElectricalSymbolId())
                                .orElseThrow(() -> new ResourceNotFoundException("ElectricalSymbol", "id", request.getElectricalSymbolId()));
                    } else {
                        // Автоматический выбор на основе ТКП 339
                        Room roomForSelection = null;
                        if (request.getRoomId() != null) {
                            roomForSelection = roomRepository.findById(request.getRoomId())
                                    .orElse(null);
                        }
                        
                        if (request.getSymbolType() == null || request.getSymbolType().isEmpty()) {
                            throw new IllegalArgumentException("Тип символа обязателен, если не указан ID символа");
                        }
                        
                        symbol = symbolSelectorService.selectBestSymbol(
                            request.getSymbolType(),
                            roomForSelection,
                            request.getPowerConsumption(),
                            request.getDistanceFromBath()
                        );
                        
                        if (symbol == null) {
                            String roomInfo = roomForSelection != null && roomForSelection.getRoomType() != null 
                                ? " для помещения типа '" + roomForSelection.getRoomType().getName() + "'"
                                : "";
                            throw new ResourceNotFoundException(
                                "ElectricalSymbol", 
                                "type", 
                                request.getSymbolType() + roomInfo + " (не найдено подходящих символов в базе данных. Обратитесь к администратору.)"
                            );
                        }
                    }

                    Room room = null;
                    if (request.getRoomId() != null) {
                        room = roomRepository.findById(request.getRoomId())
                                .orElse(null);
                        if (room != null && !room.getProject().getId().equals(projectId)) {
                            room = null;
                        }
                    }

                    return ElectricalPoint.builder()
                            .floorPlan(floorPlan)
                            .room(room)
                            .electricalSymbol(symbol)
                            .applianceId(request.getApplianceId())
                            .positionX(request.getPositionX())
                            .positionY(request.getPositionY())
                            .ratedPowerW(request.getRatedPowerW())
                            .heightFromFloor(request.getHeightFromFloor())
                            .rotation(request.getRotation() != null ? request.getRotation() : BigDecimal.ZERO)
                            .circuit(resolveCircuit(projectId, request.getCircuitId()))
                            .cableType(resolveCableType(request.getCableTypeId()))
                            .installationScope(request.getInstallationScope() != null ? request.getInstallationScope() : InstallationScope.PLANNED)
                            .group(request.getGroup())
                            .notes(request.getNotes())
                            .build();
                })
                .collect(Collectors.toList());

        points = electricalPointRepository.saveAll(points);
        return points.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public FloorPlan getFloorPlanForProject(Long projectId) {
        return floorPlanRepository.findByProjectId(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("FloorPlan", "projectId", projectId));
    }

    private ElectricalPointResponse mapToResponse(ElectricalPoint point) {
        ElectricalSymbolResponse symbolResponse = ElectricalSymbolResponse.builder()
                .id(point.getElectricalSymbol().getId())
                .name(point.getElectricalSymbol().getName())
                .svgPath(point.getElectricalSymbol().getSvgPath())
                .type(point.getElectricalSymbol().getType())
                .category(point.getElectricalSymbol().getCategory())
                .defaultWidth(point.getElectricalSymbol().getDefaultWidth())
                .defaultHeight(point.getElectricalSymbol().getDefaultHeight())
                .price(point.getElectricalSymbol().getPrice())
                .model(point.getElectricalSymbol().getModel())
                .ipRating(point.getElectricalSymbol().getIpRating())
                .color(point.getElectricalSymbol().getColor())
                .active(point.getElectricalSymbol().getActive())
                .build();

        return ElectricalPointResponse.builder()
                .id(point.getId())
                .applianceId(point.getApplianceId())
                .roomId(point.getRoom() != null ? point.getRoom().getId() : null)
                .roomName(point.getRoom() != null ? point.getRoom().getName() : null)
                .electricalSymbol(symbolResponse)
                .positionX(point.getPositionX())
                .positionY(point.getPositionY())
                .ratedPowerW(point.getRatedPowerW())
                .heightFromFloor(point.getHeightFromFloor())
                .rotation(point.getRotation())
                .circuitId(point.getCircuit() != null ? point.getCircuit().getId() : null)
                .circuitName(point.getCircuit() != null ? point.getCircuit().getName() : null)
                .cableTypeId(point.getCableType() != null ? point.getCableType().getId() : null)
                .cableTypeName(point.getCableType() != null ? point.getCableType().getName() : null)
                .installationScope(point.getInstallationScope())
                .group(point.getGroup())
                .notes(point.getNotes())
                .build();
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
}

