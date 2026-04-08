package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.ProjectApplianceRequest;
import com.verchuk.electro.dto.response.ProjectApplianceResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Appliance;
import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.ProjectAppliance;
import com.verchuk.electro.model.Room;
import com.verchuk.electro.repository.ApplianceRepository;
import com.verchuk.electro.repository.ProjectApplianceRepository;
import com.verchuk.electro.repository.ProjectRepository;
import com.verchuk.electro.repository.RoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProjectApplianceService {
    @Autowired
    private ProjectApplianceRepository projectApplianceRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ApplianceRepository applianceRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private UserService userService;

    public List<ProjectApplianceResponse> getProjectAppliances(Long projectId) {
        Project project = getProjectForCurrentUser(projectId);
        return projectApplianceRepository.findByProject(project).stream()
                .map(this::mapToProjectApplianceResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProjectApplianceResponse addProjectAppliance(Long projectId, ProjectApplianceRequest request) {
        Project project = getProjectForCurrentUser(projectId);
        Appliance appliance = applianceRepository.findById(request.getApplianceId())
                .orElseThrow(() -> new ResourceNotFoundException("Appliance", "id", request.getApplianceId()));

        final Room room;
        if (request.getRoomId() != null) {
            room = roomRepository.findByIdAndProject(request.getRoomId(), project)
                    .orElseThrow(() -> new ResourceNotFoundException("Room", "id", request.getRoomId()));
        } else {
            room = null;
        }

        // Проверяем, есть ли уже такой же прибор в той же комнате
        final Long roomId = room != null ? room.getId() : null;
        ProjectAppliance existingAppliance = projectApplianceRepository.findByProject(project).stream()
                .filter(pa -> pa.getAppliance().getId().equals(appliance.getId()))
                .filter(pa -> {
                    if (roomId == null) {
                        return pa.getRoom() == null;
                    } else {
                        return pa.getRoom() != null && pa.getRoom().getId().equals(roomId);
                    }
                })
                .findFirst()
                .orElse(null);

        if (existingAppliance != null) {
            // Инкрементируем количество существующего прибора
            int newQuantity = existingAppliance.getQuantity() + request.getQuantity();
            existingAppliance.setQuantity(newQuantity);
            existingAppliance.setTotalPower(appliance.getPowerConsumption().multiply(BigDecimal.valueOf(newQuantity)));
            return mapToProjectApplianceResponse(projectApplianceRepository.save(existingAppliance));
        } else {
            // Создаем новый прибор
            BigDecimal totalPower = appliance.getPowerConsumption().multiply(BigDecimal.valueOf(request.getQuantity()));

            ProjectAppliance projectAppliance = ProjectAppliance.builder()
                    .project(project)
                    .appliance(appliance)
                    .room(room)
                    .quantity(request.getQuantity())
                    .totalPower(totalPower)
                    .build();

            return mapToProjectApplianceResponse(projectApplianceRepository.save(projectAppliance));
        }
    }

    @Transactional
    public ProjectApplianceResponse updateProjectAppliance(Long projectId, Long projectApplianceId, ProjectApplianceRequest request) {
        Project project = getProjectForCurrentUser(projectId);
        ProjectAppliance projectAppliance = projectApplianceRepository.findById(projectApplianceId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectAppliance", "id", projectApplianceId));

        if (!projectAppliance.getProject().getId().equals(projectId)) {
            throw new ResourceNotFoundException("ProjectAppliance", "id", projectApplianceId);
        }

        Appliance appliance = applianceRepository.findById(request.getApplianceId())
                .orElseThrow(() -> new ResourceNotFoundException("Appliance", "id", request.getApplianceId()));

        Room room = null;
        if (request.getRoomId() != null) {
            room = roomRepository.findByIdAndProject(request.getRoomId(), project)
                    .orElseThrow(() -> new ResourceNotFoundException("Room", "id", request.getRoomId()));
        }

        projectAppliance.setAppliance(appliance);
        projectAppliance.setRoom(room);
        projectAppliance.setQuantity(request.getQuantity());
        projectAppliance.setTotalPower(appliance.getPowerConsumption().multiply(BigDecimal.valueOf(request.getQuantity())));

        return mapToProjectApplianceResponse(projectApplianceRepository.save(projectAppliance));
    }

    @Transactional
    public void deleteProjectAppliance(Long projectId, Long projectApplianceId) {
        Project project = getProjectForCurrentUser(projectId);
        ProjectAppliance projectAppliance = projectApplianceRepository.findById(projectApplianceId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectAppliance", "id", projectApplianceId));

        if (!projectAppliance.getProject().getId().equals(projectId)) {
            throw new ResourceNotFoundException("ProjectAppliance", "id", projectApplianceId);
        }

        projectApplianceRepository.delete(projectAppliance);
    }

    private Project getProjectForCurrentUser(Long projectId) {
        var currentUser = userService.getCurrentUser();
        // Проверяем, является ли пользователь администратором
        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);
        
        if (isAdmin) {
            // Администратор может получить любой проект
            return projectRepository.findById(projectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
        } else {
            // Дизайнер может получить только свой проект
            return projectRepository.findByIdAndDesigner(projectId, currentUser)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
        }
    }

    private ProjectApplianceResponse mapToProjectApplianceResponse(ProjectAppliance projectAppliance) {
        return ProjectApplianceResponse.builder()
                .id(projectAppliance.getId())
                .applianceId(projectAppliance.getAppliance().getId())
                .applianceName(projectAppliance.getAppliance().getName())
                .roomId(projectAppliance.getRoom() != null ? projectAppliance.getRoom().getId() : null)
                .roomName(projectAppliance.getRoom() != null ? projectAppliance.getRoom().getName() : null)
                .quantity(projectAppliance.getQuantity())
                .totalPower(projectAppliance.getTotalPower())
                .build();
    }
}

