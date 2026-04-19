package com.verchuk.electro.repository;

import com.verchuk.electro.model.ElectricalPoint;
import com.verchuk.electro.model.FloorPlan;
import com.verchuk.electro.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ElectricalPointRepository extends JpaRepository<ElectricalPoint, Long> {
    List<ElectricalPoint> findByFloorPlan(FloorPlan floorPlan);
    List<ElectricalPoint> findByFloorPlanId(Long floorPlanId);
    List<ElectricalPoint> findByRoom(Room room);
    void deleteByFloorPlanId(Long floorPlanId);

    @Query("SELECT COUNT(ep) FROM ElectricalPoint ep JOIN ep.electricalSymbol es WHERE ep.room = :room AND es.type = :symbolType")
    long countByRoomAndSymbolType(@Param("room") Room room, @Param("symbolType") String symbolType);
}

