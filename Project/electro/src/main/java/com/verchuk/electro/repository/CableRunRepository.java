package com.verchuk.electro.repository;

import com.verchuk.electro.model.CableRun;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CableRunRepository extends JpaRepository<CableRun, Long> {
    @EntityGraph(attributePaths = {"cableType", "circuit", "project"})
    List<CableRun> findByProjectIdOrderByIdAsc(Long projectId);
    Optional<CableRun> findByIdAndProjectId(Long id, Long projectId);

    @Modifying
    @Query("DELETE FROM CableRun c WHERE c.project.id = :projectId")
    void deleteByProjectId(@Param("projectId") Long projectId);
}
