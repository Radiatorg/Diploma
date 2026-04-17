package com.verchuk.electro.repository;

import com.verchuk.electro.model.CableRun;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CableRunRepository extends JpaRepository<CableRun, Long> {
    @EntityGraph(attributePaths = {"cableType", "circuit", "project"})
    List<CableRun> findByProjectIdOrderByIdAsc(Long projectId);
    Optional<CableRun> findByIdAndProjectId(Long id, Long projectId);
}
