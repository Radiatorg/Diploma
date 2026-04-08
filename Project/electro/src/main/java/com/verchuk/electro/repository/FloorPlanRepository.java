package com.verchuk.electro.repository;

import com.verchuk.electro.model.FloorPlan;
import com.verchuk.electro.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FloorPlanRepository extends JpaRepository<FloorPlan, Long> {
    Optional<FloorPlan> findByProject(Project project);
    Optional<FloorPlan> findByProjectId(Long projectId);
}

