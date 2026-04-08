package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.CircuitRequest;
import com.verchuk.electro.dto.response.CircuitResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Circuit;
import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.Role;
import com.verchuk.electro.repository.CircuitRepository;
import com.verchuk.electro.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CircuitService {
    @Autowired
    private CircuitRepository circuitRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserService userService;

    public List<CircuitResponse> getCircuits(Long projectId) {
        ensureProjectAccess(projectId);
        return circuitRepository.findByProjectIdOrderByIdAsc(projectId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public CircuitResponse createCircuit(Long projectId, CircuitRequest request) {
        Project project = ensureProjectAccess(projectId);

        Circuit circuit = Circuit.builder()
                .project(project)
                .name(request.getName().trim())
                .breakerRatingA(request.getBreakerRatingA())
                .rcdRatingMa(request.getRcdRatingMa())
                .phase(request.getPhase() != null ? request.getPhase().trim() : null)
                .installationScope(request.getInstallationScope())
                .build();

        return mapToResponse(circuitRepository.save(circuit));
    }

    @Transactional
    public CircuitResponse updateCircuit(Long projectId, Long circuitId, CircuitRequest request) {
        ensureProjectAccess(projectId);
        Circuit circuit = circuitRepository.findByIdAndProjectId(circuitId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Circuit", "id", circuitId));

        circuit.setName(request.getName().trim());
        circuit.setBreakerRatingA(request.getBreakerRatingA());
        circuit.setRcdRatingMa(request.getRcdRatingMa());
        circuit.setPhase(request.getPhase() != null ? request.getPhase().trim() : null);
        circuit.setInstallationScope(request.getInstallationScope());

        return mapToResponse(circuitRepository.save(circuit));
    }

    @Transactional
    public void deleteCircuit(Long projectId, Long circuitId) {
        ensureProjectAccess(projectId);
        Circuit circuit = circuitRepository.findByIdAndProjectId(circuitId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Circuit", "id", circuitId));
        circuitRepository.delete(circuit);
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

    private CircuitResponse mapToResponse(Circuit circuit) {
        return CircuitResponse.builder()
                .id(circuit.getId())
                .projectId(circuit.getProject().getId())
                .name(circuit.getName())
                .breakerRatingA(circuit.getBreakerRatingA())
                .rcdRatingMa(circuit.getRcdRatingMa())
                .phase(circuit.getPhase())
                .installationScope(circuit.getInstallationScope())
                .build();
    }
}
