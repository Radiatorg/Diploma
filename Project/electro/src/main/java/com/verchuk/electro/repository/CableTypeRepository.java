package com.verchuk.electro.repository;

import com.verchuk.electro.model.CableType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CableTypeRepository extends JpaRepository<CableType, Long> {
    List<CableType> findByActiveTrueOrderByNameAsc();
}
