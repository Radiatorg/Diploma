package com.verchuk.electro.repository;

import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByDesigner(User designer);
    Optional<Project> findByIdAndDesigner(Long id, User designer);
    
    @Query("SELECT DISTINCT p FROM Project p LEFT JOIN FETCH p.rooms WHERE p.id = :id")
    Optional<Project> findByIdWithRooms(@Param("id") Long id);
    
    @Query("SELECT DISTINCT p FROM Project p LEFT JOIN FETCH p.projectAppliances WHERE p.id = :id")
    Optional<Project> findByIdWithAppliances(@Param("id") Long id);
    
    @Query("SELECT COUNT(p) FROM Project p WHERE p.designer.id = :userId")
    long countByDesignerId(Long userId);
}

