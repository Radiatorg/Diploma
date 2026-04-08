package com.verchuk.electro.repository;

import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.SavedSpecification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SavedSpecificationRepository extends JpaRepository<SavedSpecification, Long> {
    List<SavedSpecification> findByProject(Project project);
    List<SavedSpecification> findByProjectId(Long projectId);
    
    @Modifying
    @Query("DELETE FROM SavedSpecification s WHERE s.project.id = :projectId")
    void deleteAllByProjectId(@Param("projectId") Long projectId);
}







