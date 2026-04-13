package com.verchuk.electro.repository;

import com.verchuk.electro.model.Appliance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApplianceRepository extends JpaRepository<Appliance, Long> {
    List<Appliance> findByActiveTrue();

    List<Appliance> findByManufacturer_IdAndActiveTrueOrderByNameAsc(Long manufacturerId);

    @Query("SELECT COUNT(a) FROM Appliance a WHERE a.manufacturer.id = :mid")
    long countLinkedToManufacturer(@Param("mid") Long manufacturerId);
    
    @Query("SELECT DISTINCT a FROM Appliance a LEFT JOIN FETCH a.categories LEFT JOIN FETCH a.manufacturer WHERE a.active = true ORDER BY a.name")
    List<Appliance> findAllActiveOrderedByName();
    
    @Query("SELECT DISTINCT a FROM Appliance a LEFT JOIN FETCH a.categories LEFT JOIN FETCH a.manufacturer WHERE a.id = :id")
    java.util.Optional<Appliance> findByIdWithCategories(Long id);

    Optional<Appliance> findByModelIgnoreCase(String model);

    boolean existsByModelIgnoreCase(String model);

    boolean existsByModelIgnoreCaseAndIdNot(String model, Long id);
}

