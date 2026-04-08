package com.verchuk.electro.repository;

import com.verchuk.electro.model.PlacementRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlacementRuleRepository extends JpaRepository<PlacementRule, Long> {
    List<PlacementRule> findByActiveTrue();
    Optional<PlacementRule> findByType(String type);
    List<PlacementRule> findByTypeAndActiveTrue(String type);
}

