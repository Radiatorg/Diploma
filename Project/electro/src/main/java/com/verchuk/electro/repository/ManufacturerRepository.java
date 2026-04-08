package com.verchuk.electro.repository;

import com.verchuk.electro.model.Manufacturer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ManufacturerRepository extends JpaRepository<Manufacturer, Long> {
    List<Manufacturer> findByActiveTrueOrderByNameAsc();

    Optional<Manufacturer> findByNameIgnoreCase(String name);
}
