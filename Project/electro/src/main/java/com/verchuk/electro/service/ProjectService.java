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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
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
        return getAllProjects(
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty()
        ).getProjects();
    }

    public ProjectQueryResult getAllProjects(Optional<String> search,
                                             Optional<LocalDate> dateFrom,
                                             Optional<LocalDate> dateTo,
                                             Optional<Long> designerId,
                                             Optional<String> sortBy,
                                             Optional<String> sortDir,
                                             Optional<Integer> page,
                                             Optional<Integer> size) {
        Comparator<Project> comparator = buildComparator(sortBy.orElse("id"));
        if ("desc".equalsIgnoreCase(sortDir.orElse("asc"))) {
            comparator = comparator.reversed();
        }

        List<Project> filteredAndSorted = projectRepository.findAll().stream()
                .filter(project -> search.map(q -> matchesSearch(project, q)).orElse(true))
                .filter(project -> designerId.map(id -> project.getDesigner() != null && id.equals(project.getDesigner().getId())).orElse(true))
                .filter(project -> dateFrom.map(from -> project.getCreatedAt() != null && !project.getCreatedAt().isBefore(from.atStartOfDay())).orElse(true))
                .filter(project -> dateTo.map(to -> project.getCreatedAt() != null && !project.getCreatedAt().isAfter(to.atTime(LocalTime.MAX))).orElse(true))
                .sorted(comparator)
                .collect(Collectors.toList());

        long totalItems = filteredAndSorted.size();
        List<Project> paginated = paginateProjects(filteredAndSorted, page, size);

        List<ProjectResponse> result = paginated.stream()
                .map(this::mapToProjectResponse)
                .collect(Collectors.toList());
        return new ProjectQueryResult(result, totalItems);
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
                .totalArea(project.getTotalArea() != null ? project.getTotalArea() :
                        (project.getRooms() != null ? project.getRooms().stream()
                                .map(r -> r.getArea() != null ? r.getArea() : java.math.BigDecimal.ZERO)
                                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add) : null))
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .build();
    }

    private Comparator<Project> buildComparator(String sortBy) {
        return switch (sortBy) {
            case "id" -> Comparator.comparing(Project::getId, nullSafeComparableComparator());
            case "name" -> Comparator.comparing(Project::getName, nullSafeStringComparator());
            case "description" -> Comparator.comparing(Project::getDescription, nullSafeStringComparator());
            case "designerUsername" -> Comparator.comparing(this::designerUsername, nullSafeStringComparator());
            case "roomsCount" -> Comparator.comparing(this::roomsCount, nullSafeComparableComparator());
            case "appliancesCount" -> Comparator.comparing(this::appliancesCount, nullSafeComparableComparator());
            case "createdAt" -> Comparator.comparing(Project::getCreatedAt, nullSafeComparableComparator());
            default -> Comparator.comparing(Project::getId, nullSafeComparableComparator());
        };
    }

    private String designerUsername(Project project) {
        return project.getDesigner() == null ? null : project.getDesigner().getUsername();
    }

    private Integer roomsCount(Project project) {
        return project.getRooms() == null ? 0 : project.getRooms().size();
    }

    private Integer appliancesCount(Project project) {
        return project.getProjectAppliances() == null ? 0 : project.getProjectAppliances().size();
    }

    private boolean matchesSearch(Project project, String queryValue) {
        String query = queryValue == null ? "" : queryValue.trim().toLowerCase();
        if (query.isEmpty()) {
            return true;
        }
        return containsIgnoreCase(project.getName(), query)
                || containsIgnoreCase(project.getDescription(), query)
                || containsIgnoreCase(designerUsername(project), query)
                || String.valueOf(project.getId()).contains(query)
                || (project.getCreatedAt() != null && project.getCreatedAt().toLocalDate().toString().contains(query));
    }

    private boolean containsIgnoreCase(String value, String query) {
        return value != null && value.toLowerCase().contains(query);
    }

    private List<Project> paginateProjects(List<Project> projects, Optional<Integer> page, Optional<Integer> size) {
        if (page.isEmpty() && size.isEmpty()) {
            return projects;
        }
        int safePage = Math.max(0, page.orElse(0));
        int safeSize = size.orElse(20);
        if (safeSize <= 0) {
            safeSize = 20;
        }
        int fromIndex = safePage * safeSize;
        if (fromIndex >= projects.size()) {
            return List.of();
        }
        int toIndex = Math.min(fromIndex + safeSize, projects.size());
        return projects.subList(fromIndex, toIndex);
    }

    private Comparator<String> nullSafeStringComparator() {
        return Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER);
    }

    private <T extends Comparable<? super T>> Comparator<T> nullSafeComparableComparator() {
        return Comparator.nullsLast(Comparator.naturalOrder());
    }

    public static class ProjectQueryResult {
        private final List<ProjectResponse> projects;
        private final long totalItems;

        public ProjectQueryResult(List<ProjectResponse> projects, long totalItems) {
            this.projects = projects;
            this.totalItems = totalItems;
        }

        public List<ProjectResponse> getProjects() {
            return projects;
        }

        public long getTotalItems() {
            return totalItems;
        }
    }
}

