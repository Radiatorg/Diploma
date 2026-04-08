package com.verchuk.electro.repository;

import com.verchuk.electro.model.FloorPlan;
import com.verchuk.electro.model.Wall;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WallRepository extends JpaRepository<Wall, Long> {
    List<Wall> findByFloorPlan(FloorPlan floorPlan);
    List<Wall> findByFloorPlanId(Long floorPlanId);
    List<Wall> findByRoomId(Long roomId); // Для получения внутренних стен комнаты
    void deleteByFloorPlanId(Long floorPlanId);
    void deleteByRoomId(Long roomId); // Для удаления внутренних стен при удалении комнаты
}

