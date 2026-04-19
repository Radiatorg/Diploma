package com.verchuk.electro.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.verchuk.electro.dto.request.RoomRequest;
import com.verchuk.electro.dto.response.RoomResponse;
import com.verchuk.electro.dto.response.WallResponse;
import com.verchuk.electro.exception.BadRequestException;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.Room;
import com.verchuk.electro.model.RoomType;
import com.verchuk.electro.model.Wall;
import com.verchuk.electro.repository.ElectricalPointRepository;
import com.verchuk.electro.repository.ProjectRepository;
import com.verchuk.electro.repository.RoomRepository;
import com.verchuk.electro.repository.RoomTypeRepository;
import com.verchuk.electro.repository.WallRepository;
import com.verchuk.electro.service.WallService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

// Внутренний класс для конфигурации групп розеток
class SocketGroupConfig {
    private Integer socketsCount;
    
    public SocketGroupConfig() {}
    
    public SocketGroupConfig(Integer socketsCount) {
        this.socketsCount = socketsCount;
    }
    
    public Integer getSocketsCount() {
        return socketsCount;
    }
    
    public void setSocketsCount(Integer socketsCount) {
        this.socketsCount = socketsCount;
    }
}

@Service
public class RoomService {
    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private RoomTypeRepository roomTypeRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private WallService wallService;

    @Autowired
    private WallRepository wallRepository;

    @Autowired
    private ElectricalPointRepository electricalPointRepository;

    @Autowired
    private ObjectMapper objectMapper;

    public List<RoomResponse> getRoomsByProject(Long projectId) {
        Project project = getProjectForCurrentUser(projectId);
        return roomRepository.findByProject(project).stream()
                .map(this::mapToRoomResponse)
                .collect(Collectors.toList());
    }

    public RoomResponse getRoomById(Long projectId, Long roomId) {
        Project project = getProjectForCurrentUser(projectId);
        Room room = roomRepository.findByIdAndProject(roomId, project)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", roomId));
        return mapToRoomResponse(room);
    }

    @Transactional
    public RoomResponse createRoom(Long projectId, RoomRequest request) {
        Project project = getProjectForCurrentUser(projectId);
        RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", request.getRoomTypeId()));

        Room room = Room.builder()
                .name(request.getName())
                .area(request.getArea())
                .roomType(roomType)
                .project(project)
                .description(request.getDescription())
                .positionX(request.getPositionX())
                .positionY(request.getPositionY())
                .width(request.getWidth())
                .height(request.getHeight())
                .polygonPoints(request.getPolygonPoints())
                .windowCount(request.getWindowCount())
                .socketGroups(request.getSocketGroups() != null ? request.getSocketGroups() : 1)
                .socketsPerGroup(request.getSocketsPerGroup() != null ? request.getSocketsPerGroup() : 2)
                .socketGroupsConfig(request.getSocketGroupsConfig())
                .maxOutlets(request.getMaxOutlets())
                .maxSwitches(request.getMaxSwitches())
                .maxDoors(request.getMaxDoors())
                .maxWindows(request.getMaxWindows())
                .maxLights(request.getMaxLights())
                .build();

        return mapToRoomResponse(roomRepository.save(room));
    }

    @Transactional
    public RoomResponse updateRoom(Long projectId, Long roomId, RoomRequest request) {
        Project project = getProjectForCurrentUser(projectId);
        Room room = roomRepository.findByIdAndProject(roomId, project)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", roomId));

        room.setName(request.getName());
        room.setArea(request.getArea());
        room.setDescription(request.getDescription());
        room.setPositionX(request.getPositionX());
        room.setPositionY(request.getPositionY());
        room.setWidth(request.getWidth());
        room.setHeight(request.getHeight());
        room.setPolygonPoints(request.getPolygonPoints());
        room.setWindowCount(request.getWindowCount());
        if (request.getSocketGroups() != null) {
            room.setSocketGroups(request.getSocketGroups());
        }
        if (request.getSocketsPerGroup() != null) {
            room.setSocketsPerGroup(request.getSocketsPerGroup());
        }
        if (request.getSocketGroupsConfig() != null) {
            room.setSocketGroupsConfig(request.getSocketGroupsConfig());
            // Обновляем также старые поля для обратной совместимости
            try {
                List<SocketGroupConfig> groups = objectMapper.readValue(
                    request.getSocketGroupsConfig(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, SocketGroupConfig.class)
                );
                if (!groups.isEmpty()) {
                    room.setSocketGroups(groups.size());
                    int totalSockets = groups.stream().mapToInt(g -> g.getSocketsCount()).sum();
                    room.setSocketsPerGroup(totalSockets / groups.size());
                }
            } catch (Exception e) {
                // Если не удалось распарсить JSON, используем старые поля
            }
        }

        if (request.getRoomTypeId() != null && !request.getRoomTypeId().equals(room.getRoomType().getId())) {
            RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                    .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", request.getRoomTypeId()));
            room.setRoomType(roomType);
        }

        // Validate that new limits are not less than existing placed counts
        if (request.getMaxSwitches() != null || request.getMaxDoors() != null
                || request.getMaxWindows() != null || request.getMaxLights() != null) {
            long switchCount = electricalPointRepository.countByRoomAndSymbolType(room, "switch");
            long lightCount = electricalPointRepository.countByRoomAndSymbolType(room, "light");
            List<Wall> roomWalls = wallRepository.findByRoomId(room.getId());
            long doorCount = roomWalls.stream()
                    .flatMap(w -> w.getOpenings() != null ? w.getOpenings().stream() : java.util.stream.Stream.empty())
                    .filter(o -> "door".equals(o.getOpeningType()))
                    .count();
            long windowCount2 = roomWalls.stream()
                    .flatMap(w -> w.getOpenings() != null ? w.getOpenings().stream() : java.util.stream.Stream.empty())
                    .filter(o -> "window".equals(o.getOpeningType()))
                    .count();

            if (request.getMaxSwitches() != null && request.getMaxSwitches() < switchCount) {
                throw new BadRequestException(
                    "Нельзя установить лимит выключателей (" + request.getMaxSwitches() + ") меньше текущего количества (" + switchCount + " шт.)");
            }
            if (request.getMaxDoors() != null && request.getMaxDoors() < doorCount) {
                throw new BadRequestException(
                    "Нельзя установить лимит дверей (" + request.getMaxDoors() + ") меньше текущего количества (" + doorCount + " шт.)");
            }
            if (request.getMaxWindows() != null && request.getMaxWindows() < windowCount2) {
                throw new BadRequestException(
                    "Нельзя установить лимит окон (" + request.getMaxWindows() + ") меньше текущего количества (" + windowCount2 + " шт.)");
            }
            if (request.getMaxLights() != null && request.getMaxLights() < lightCount) {
                throw new BadRequestException(
                    "Нельзя установить лимит световых точек (" + request.getMaxLights() + ") меньше текущего количества (" + lightCount + " шт.)");
            }
        }

        room.setMaxOutlets(request.getMaxOutlets());
        room.setMaxSwitches(request.getMaxSwitches());
        room.setMaxDoors(request.getMaxDoors());
        room.setMaxWindows(request.getMaxWindows());
        room.setMaxLights(request.getMaxLights());

        return mapToRoomResponse(roomRepository.save(room));
    }

    @Transactional
    public void deleteRoom(Long projectId, Long roomId) {
        Project project = getProjectForCurrentUser(projectId);
        Room room = roomRepository.findByIdAndProject(roomId, project)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", roomId));
        // Удаляем внутренние стены комнаты перед удалением комнаты
        wallService.deleteWallsByRoom(projectId, roomId);
        roomRepository.delete(room);
    }

    /**
     * Получение внутренних стен и перегородок комнаты
     */
    public List<WallResponse> getRoomWalls(Long projectId, Long roomId) {
        Project project = getProjectForCurrentUser(projectId);
        Room room = roomRepository.findByIdAndProject(roomId, project)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", roomId));
        return wallService.getWallsByRoom(projectId, roomId);
    }

    private Project getProjectForCurrentUser(Long projectId) {
        var designer = userService.getCurrentUser();
        return projectRepository.findByIdAndDesigner(projectId, designer)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
    }

    private RoomResponse mapToRoomResponse(Room room) {
        return RoomResponse.builder()
                .id(room.getId())
                .name(room.getName())
                .area(room.getArea())
                .roomTypeId(room.getRoomType().getId())
                .roomTypeName(room.getRoomType().getName())
                .description(room.getDescription())
                .positionX(room.getPositionX())
                .positionY(room.getPositionY())
                .width(room.getWidth())
                .height(room.getHeight())
                .polygonPoints(room.getPolygonPoints())
                .windowCount(room.getWindowCount())
                .socketGroups(room.getSocketGroups())
                .socketsPerGroup(room.getSocketsPerGroup())
                .socketGroupsConfig(room.getSocketGroupsConfig())
                .maxOutlets(room.getMaxOutlets())
                .maxSwitches(room.getMaxSwitches())
                .maxDoors(room.getMaxDoors())
                .maxWindows(room.getMaxWindows())
                .maxLights(room.getMaxLights())
                .build();
    }
}

