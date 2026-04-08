package com.verchuk.electro.repository;

import com.verchuk.electro.model.ElectricalSymbol;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ElectricalSymbolRepository extends JpaRepository<ElectricalSymbol, Long> {
    List<ElectricalSymbol> findByActiveTrue();
    List<ElectricalSymbol> findByType(String type);
    List<ElectricalSymbol> findByTypeAndActiveTrue(String type);
    List<ElectricalSymbol> findByCategory(String category);
    Optional<ElectricalSymbol> findByName(String name);
}

