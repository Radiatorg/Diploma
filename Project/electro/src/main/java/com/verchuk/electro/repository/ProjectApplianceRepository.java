package com.verchuk.electro.repository;

import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.ProjectAppliance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectApplianceRepository extends JpaRepository<ProjectAppliance, Long> {
    List<ProjectAppliance> findByProject(Project project);
    
    @Query("SELECT pa FROM ProjectAppliance pa WHERE pa.project.id = :projectId")
    List<ProjectAppliance> findByProjectId(@Param("projectId") Long projectId);
    
    @Query("SELECT COUNT(pa) FROM ProjectAppliance pa WHERE pa.appliance.id = :applianceId")
    long countByApplianceId(@Param("applianceId") Long applianceId);

    @Query("SELECT pa FROM ProjectAppliance pa JOIN FETCH pa.appliance a JOIN FETCH pa.project p LEFT JOIN FETCH a.manufacturer")
    List<ProjectAppliance> findAllWithApplianceManufacturerAndProject();
}

