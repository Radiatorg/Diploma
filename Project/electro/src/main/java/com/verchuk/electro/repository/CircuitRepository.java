package com.verchuk.electro.repository;

import com.verchuk.electro.model.Circuit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CircuitRepository extends JpaRepository<Circuit, Long> {
    List<Circuit> findByProjectIdOrderByIdAsc(Long projectId);
    Optional<Circuit> findByIdAndProjectId(Long id, Long projectId);
}
