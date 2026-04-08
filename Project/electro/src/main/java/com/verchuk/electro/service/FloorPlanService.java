package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.FloorPlanRequest;
import com.verchuk.electro.dto.response.FloorPlanResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.FloorPlan;
import com.verchuk.electro.model.Project;
import com.verchuk.electro.repository.FloorPlanRepository;
import com.verchuk.electro.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class FloorPlanService {
    @Autowired
    private FloorPlanRepository floorPlanRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private WallService wallService;

    @Autowired
    private ElectricalPointService electricalPointService;

    @Transactional
    public FloorPlanResponse createOrUpdateFloorPlan(Long projectId, FloorPlanRequest request) {
        var designer = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, designer)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        FloorPlan floorPlan = floorPlanRepository.findByProject(project)
                .orElse(FloorPlan.builder()
                        .project(project)
                        .width(request.getWidth() != null ? request.getWidth() : BigDecimal.valueOf(1000))
                        .height(request.getHeight() != null ? request.getHeight() : BigDecimal.valueOf(800))
                        .scale(request.getScale() != null ? request.getScale() : BigDecimal.valueOf(1.0))
                        .build());

        if (request.getWidth() != null) {
            floorPlan.setWidth(request.getWidth());
        }
        if (request.getHeight() != null) {
            floorPlan.setHeight(request.getHeight());
        }
        if (request.getScale() != null) {
            floorPlan.setScale(request.getScale());
        }

        floorPlan = floorPlanRepository.save(floorPlan);
        return mapToResponse(floorPlan);
    }

    public FloorPlanResponse getFloorPlan(Long projectId) {
        var designer = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, designer)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        FloorPlan floorPlan = floorPlanRepository.findByProject(project)
                .orElseThrow(() -> new ResourceNotFoundException("FloorPlan", "projectId", projectId));

        return mapToResponse(floorPlan);
    }

    @Transactional
    public void deleteFloorPlan(Long projectId) {
        var designer = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, designer)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        FloorPlan floorPlan = floorPlanRepository.findByProject(project)
                .orElseThrow(() -> new ResourceNotFoundException("FloorPlan", "projectId", projectId));

        floorPlanRepository.delete(floorPlan);
    }

    private FloorPlanResponse mapToResponse(FloorPlan floorPlan) {
        return FloorPlanResponse.builder()
                .id(floorPlan.getId())
                .projectId(floorPlan.getProject().getId())
                .width(floorPlan.getWidth())
                .height(floorPlan.getHeight())
                .scale(floorPlan.getScale())
                .walls(wallService.getWallsByFloorPlan(floorPlan.getId()))
                .electricalPoints(electricalPointService.getElectricalPointsByFloorPlan(floorPlan.getId()))
                .build();
    }
}

