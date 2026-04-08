package com.verchuk.electro.repository;

import com.verchuk.electro.model.ElectricalPoint;
import com.verchuk.electro.model.FloorPlan;
import com.verchuk.electro.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ElectricalPointRepository extends JpaRepository<ElectricalPoint, Long> {
    List<ElectricalPoint> findByFloorPlan(FloorPlan floorPlan);
    List<ElectricalPoint> findByFloorPlanId(Long floorPlanId);
    List<ElectricalPoint> findByRoom(Room room);
    void deleteByFloorPlanId(Long floorPlanId);
}

