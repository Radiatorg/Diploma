package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.ProjectRequest;
import com.verchuk.electro.dto.response.ProjectResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.User;
import com.verchuk.electro.repository.FloorPlanRepository;
import com.verchuk.electro.repository.ProjectRepository;
import com.verchuk.electro.repository.SavedSpecificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProjectService {
    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private FloorPlanRepository floorPlanRepository;

    @Autowired
    private SavedSpecificationRepository savedSpecificationRepository;

    public List<ProjectResponse> getAllProjectsForCurrentUser() {
        User currentUser = userService.getCurrentUser();
        // И дизайнер, и администратор видят только свои проекты
        return projectRepository.findByDesigner(currentUser).stream()
                .map(this::mapToProjectResponse)
                .collect(Collectors.toList());
    }

    public List<ProjectResponse> getAllProjects() {
        return projectRepository.findAll().stream()
                .map(this::mapToProjectResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProjectById(Long id) {
        // Загружаем проект с комнатами
        Project project = projectRepository.findByIdWithRooms(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        // Загружаем электроприборы отдельным запросом
        projectRepository.findByIdWithAppliances(id).ifPresent(p -> {
            project.setProjectAppliances(p.getProjectAppliances());
        });
        return mapToProjectResponse(project);
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProjectByIdForCurrentUser(Long id) {
        User currentUser = userService.getCurrentUser();
        // Проверяем, является ли пользователь администратором
        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);
        
        if (isAdmin) {
            // Администратор может получить любой проект
            return getProjectById(id);
        } else {
            // Дизайнер может получить только свой проект
            projectRepository.findByIdAndDesigner(id, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        // Загружаем проект с комнатами
        Project project = projectRepository.findByIdWithRooms(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        // Загружаем электроприборы отдельным запросом
        projectRepository.findByIdWithAppliances(id).ifPresent(p -> {
            project.setProjectAppliances(p.getProjectAppliances());
        });
        return mapToProjectResponse(project);
        }
    }

    @Transactional
    public ProjectResponse createProject(ProjectRequest request) {
        User designer = userService.getCurrentUser();
        Project project = Project.builder()
                .name(request.getName())
                .description(request.getDescription())
                .designer(designer)
                .groundingSystem(request.getGroundingSystem())
                .inputVoltage(request.getInputVoltage())
                .inputPhaseCount(request.getInputPhaseCount())
                .penConductorSection(request.getPenConductorSection())
                .totalArea(request.getTotalArea())
                .build();
        return mapToProjectResponse(projectRepository.save(project));
    }

    @Transactional
    public ProjectResponse updateProject(Long id, ProjectRequest request) {
        User currentUser = userService.getCurrentUser();
        // Проверяем, является ли пользователь администратором
        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);
        
        Project project;
        if (isAdmin) {
            // Администратор может обновить любой проект
            project = projectRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        } else {
            // Дизайнер может обновить только свой проект
            project = projectRepository.findByIdAndDesigner(id, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        }

        project.setName(request.getName());
        project.setDescription(request.getDescription());
        if (request.getGroundingSystem() != null) {
            project.setGroundingSystem(request.getGroundingSystem());
        }
        if (request.getInputVoltage() != null) {
            project.setInputVoltage(request.getInputVoltage());
        }
        if (request.getInputPhaseCount() != null) {
            project.setInputPhaseCount(request.getInputPhaseCount());
        }
        if (request.getPenConductorSection() != null) {
            project.setPenConductorSection(request.getPenConductorSection());
        }
        if (request.getTotalArea() != null) {
            project.setTotalArea(request.getTotalArea());
        }

        return mapToProjectResponse(projectRepository.save(project));
    }

    @Transactional
    public void deleteProject(Long id) {
        User currentUser = userService.getCurrentUser();
        // Проверяем, является ли пользователь администратором
        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);
        
        Project project;
        if (isAdmin) {
            // Администратор может удалить любой проект
            project = projectRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        } else {
            // Дизайнер может удалить только свой проект
            project = projectRepository.findByIdAndDesigner(id, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
        }
        
        // Удаляем SavedSpecification, если они существуют, так как они ссылаются на Project
        // Используем прямой SQL запрос для надежного удаления
        savedSpecificationRepository.deleteAllByProjectId(id);
        
        // Удаляем FloorPlan, если он существует, так как он ссылается на Project
        floorPlanRepository.findByProject(project).ifPresent(floorPlanRepository::delete);
        
        projectRepository.delete(project);
    }

    private ProjectResponse mapToProjectResponse(Project project) {
        return ProjectResponse.builder()
                .id(project.getId())
                .name(project.getName())
                .description(project.getDescription())
                .designerId(project.getDesigner().getId())
                .designerUsername(project.getDesigner().getUsername())
                .rooms(project.getRooms() != null ? project.getRooms().stream()
                        .map(room -> com.verchuk.electro.dto.response.RoomResponse.builder()
                                .id(room.getId())
                                .name(room.getName())
                                .area(room.getArea())
                                .roomTypeId(room.getRoomType().getId())
                                .roomTypeName(room.getRoomType().getName())
                                .description(room.getDescription())
                                .build())
                        .collect(Collectors.toList()) : List.of())
                .appliances(project.getProjectAppliances() != null ? project.getProjectAppliances().stream()
                        .map(pa -> com.verchuk.electro.dto.response.ProjectApplianceResponse.builder()
                                .id(pa.getId())
                                .applianceId(pa.getAppliance().getId())
                                .applianceName(pa.getAppliance().getName())
                                .roomId(pa.getRoom() != null ? pa.getRoom().getId() : null)
                                .roomName(pa.getRoom() != null ? pa.getRoom().getName() : null)
                                .quantity(pa.getQuantity())
                                .totalPower(pa.getTotalPower())
                                .build())
                        .collect(Collectors.toList()) : List.of())
                .groundingSystem(project.getGroundingSystem())
                .inputVoltage(project.getInputVoltage())
                .inputPhaseCount(project.getInputPhaseCount())
                .penConductorSection(project.getPenConductorSection())
                .totalArea(project.getTotalArea())
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .build();
    }
}

