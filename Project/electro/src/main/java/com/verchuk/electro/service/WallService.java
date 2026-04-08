package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.WallRequest;
import com.verchuk.electro.dto.request.WallOpeningRequest;
import com.verchuk.electro.dto.response.WallOpeningResponse;
import com.verchuk.electro.dto.response.WallResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.FloorPlan;
import com.verchuk.electro.model.Room;
import com.verchuk.electro.model.Wall;
import com.verchuk.electro.model.WallOpening;
import com.verchuk.electro.repository.FloorPlanRepository;
import com.verchuk.electro.repository.WallRepository;
import com.verchuk.electro.repository.RoomRepository;
import com.verchuk.electro.repository.RoomTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class WallService {

    @Autowired
    private WallRepository wallRepository;

    @Autowired
    private FloorPlanRepository floorPlanRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomTypeRepository roomTypeRepository;

    @Autowired
    private UserService userService;

    /**
     * Создание одной стены (используется при обычном рисовании)
     */
    @Transactional
    public WallResponse createWall(Long projectId, WallRequest request) {
        FloorPlan floorPlan = getFloorPlanForProject(projectId);

        Room room = null;
        if (request.getRoomId() != null) {
            room = roomRepository.findById(request.getRoomId())
                    .orElseThrow(() -> new ResourceNotFoundException("Room", "id", request.getRoomId()));
            // Проверяем, что комната принадлежит проекту
            if (!room.getProject().getId().equals(projectId)) {
                throw new ResourceNotFoundException("Room", "id", request.getRoomId());
            }
        }

        Wall wall = Wall.builder()
                .floorPlan(floorPlan)
                .room(room)
                .startX(request.getStartX())
                .startY(request.getStartY())
                .endX(request.getEndX())
                .endY(request.getEndY())
                .thickness(request.getThickness() != null ? request.getThickness() : BigDecimal.valueOf(20))
                .wallType(request.getWallType())
                .openings(new ArrayList<>())
                .build();

        if (request.getOpenings() != null && !request.getOpenings().isEmpty()) {
            Wall finalWall = wall;
            List<WallOpening> openings = request.getOpenings().stream()
                    .map(opReq -> WallOpening.builder()
                            .wall(finalWall)
                            .position(opReq.getPosition())
                            .width(opReq.getWidth())
                            .height(opReq.getHeight())
                            .openingType(opReq.getOpeningType())
                            .build())
                    .toList();
            wall.getOpenings().addAll(openings);
        }

        wall = wallRepository.save(wall);
        return mapToResponse(wall);
    }

    /**
     * Обновление существующей стены
     */
    @Transactional
    public WallResponse updateWall(Long projectId, Long wallId, WallRequest request) {
        FloorPlan floorPlan = getFloorPlanForProject(projectId);
        Wall wall = wallRepository.findById(wallId)
                .orElseThrow(() -> new ResourceNotFoundException("Wall", "id", wallId));

        if (!wall.getFloorPlan().getId().equals(floorPlan.getId())) {
            throw new ResourceNotFoundException("Wall", "id", wallId);
        }

        // Обновляем связь с комнатой, если указана
        if (request.getRoomId() != null) {
            Room room = roomRepository.findById(request.getRoomId())
                    .orElseThrow(() -> new ResourceNotFoundException("Room", "id", request.getRoomId()));
            if (!room.getProject().getId().equals(projectId)) {
                throw new ResourceNotFoundException("Room", "id", request.getRoomId());
            }
            wall.setRoom(room);
        } else {
            wall.setRoom(null);
        }

        wall.setStartX(request.getStartX());
        wall.setStartY(request.getStartY());
        wall.setEndX(request.getEndX());
        wall.setEndY(request.getEndY());

        if (request.getThickness() != null) {
            wall.setThickness(request.getThickness());
        }
        wall.setWallType(request.getWallType());

        // Обновление проемов (очистка и замена)
        if (request.getOpenings() != null) {
            wall.getOpenings().clear();
            Wall finalWall = wall;
            List<WallOpening> newOpenings = request.getOpenings().stream()
                    .map(opReq -> WallOpening.builder()
                            .wall(finalWall)
                            .position(opReq.getPosition())
                            .width(opReq.getWidth())
                            .height(opReq.getHeight())
                            .openingType(opReq.getOpeningType())
                            .build())
                    .toList();
            wall.getOpenings().addAll(newOpenings);
        }

        wall = wallRepository.save(wall);
        return mapToResponse(wall);
    }

    /**
     * Пакетное сохранение стен.
     * Используется визуальным редактором для синхронизации всего плана сразу.
     */
    @Transactional
    public List<WallResponse> saveWalls(Long projectId, List<WallRequest> requests) {
        FloorPlan floorPlan = getFloorPlanForProject(projectId);

        // Получаем существующие стены и удаляем их по одной, чтобы избежать конфликтов транзакций
        List<Wall> existingWalls = wallRepository.findByFloorPlanId(floorPlan.getId());
        if (!existingWalls.isEmpty()) {
            // Удаляем проемы сначала
            for (Wall wall : existingWalls) {
                if (wall.getOpenings() != null && !wall.getOpenings().isEmpty()) {
                    wall.getOpenings().clear();
                }
            }
            wallRepository.deleteAll(existingWalls);
            wallRepository.flush(); // Принудительно сбрасываем изменения в БД
        }

        // Создаем новые стены
        List<Wall> walls = new ArrayList<>();
        for (WallRequest request : requests) {
            Room room = null;
            if (request.getRoomId() != null) {
                room = roomRepository.findById(request.getRoomId())
                        .orElse(null);
                if (room != null && !room.getProject().getId().equals(projectId)) {
                    room = null;
                }
            }

            Wall wall = Wall.builder()
                    .floorPlan(floorPlan)
                    .room(room)
                    .startX(request.getStartX())
                    .startY(request.getStartY())
                    .endX(request.getEndX())
                    .endY(request.getEndY())
                    .thickness(request.getThickness() != null ? request.getThickness() : BigDecimal.valueOf(20))
                    .wallType(request.getWallType())
                    .openings(new ArrayList<>())
                    .build();

            if (request.getOpenings() != null && !request.getOpenings().isEmpty()) {
                for (WallOpeningRequest opReq : request.getOpenings()) {
                    WallOpening opening = WallOpening.builder()
                            .wall(wall)
                            .position(opReq.getPosition())
                            .width(opReq.getWidth())
                            .height(opReq.getHeight())
                            .openingType(opReq.getOpeningType())
                            .build();
                    wall.getOpenings().add(opening);
                }
            }
            walls.add(wall);
        }

        List<Wall> savedWalls = wallRepository.saveAll(walls);
        wallRepository.flush(); // Принудительно сохраняем изменения

        return savedWalls.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteWall(Long projectId, Long wallId) {
        FloorPlan floorPlan = getFloorPlanForProject(projectId);
        Wall wall = wallRepository.findById(wallId)
                .orElseThrow(() -> new ResourceNotFoundException("Wall", "id", wallId));

        if (!wall.getFloorPlan().getId().equals(floorPlan.getId())) {
            throw new ResourceNotFoundException("Wall", "id", wallId);
        }

        wallRepository.delete(wall);
    }

    public List<WallResponse> getWallsByFloorPlan(Long floorPlanId) {
        return wallRepository.findByFloorPlanId(floorPlanId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<WallResponse> getWallsByProject(Long projectId) {
        FloorPlan floorPlan = getFloorPlanForProject(projectId);
        return getWallsByFloorPlan(floorPlan.getId());
    }

    /**
     * Получение внутренних стен и перегородок комнаты
     */
    public List<WallResponse> getWallsByRoom(Long projectId, Long roomId) {
        // Проверяем, что комната принадлежит проекту
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", roomId));
        if (!room.getProject().getId().equals(projectId)) {
            throw new ResourceNotFoundException("Room", "id", roomId);
        }
        
        return wallRepository.findByRoomId(roomId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Удаление всех внутренних стен комнаты
     */
    @Transactional
    public void deleteWallsByRoom(Long projectId, Long roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", roomId));
        if (!room.getProject().getId().equals(projectId)) {
            throw new ResourceNotFoundException("Room", "id", roomId);
        }
        wallRepository.deleteByRoomId(roomId);
    }

    public FloorPlan getFloorPlanForProject(Long projectId) {
        return floorPlanRepository.findByProjectId(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("FloorPlan", "projectId", projectId));
    }

    /**
     * Заглушка для логики автоматического распознавания комнат по стенам.
     */
    @Transactional
    public void autoDetectRooms(FloorPlan floorPlan) {
        // Здесь реализуется алгоритм поиска замкнутых циклов в графе стен.
        // На данный момент логика создания комнаты "авто-стенами" реализована на фронтенде
        // для обеспечения моментального отклика UI.
    }

    private WallResponse mapToResponse(Wall wall) {
        List<WallOpeningResponse> openings = wall.getOpenings() != null
                ? wall.getOpenings().stream()
                .map(this::mapOpeningToResponse)
                .collect(Collectors.toList())
                : new ArrayList<>();

        return WallResponse.builder()
                .id(wall.getId())
                .startX(wall.getStartX())
                .startY(wall.getStartY())
                .endX(wall.getEndX())
                .endY(wall.getEndY())
                .thickness(wall.getThickness())
                .wallType(wall.getWallType())
                .roomId(wall.getRoom() != null ? wall.getRoom().getId() : null)
                .openings(openings)
                .build();
    }

    private WallOpeningResponse mapOpeningToResponse(WallOpening opening) {
        return WallOpeningResponse.builder()
                .id(opening.getId())
                .position(opening.getPosition())
                .width(opening.getWidth())
                .height(opening.getHeight())
                .openingType(opening.getOpeningType())
                .build();
    }
}