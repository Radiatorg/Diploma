package com.verchuk.electro.repository;

import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findByProject(Project project);
    Optional<Room> findByIdAndProject(Long id, Project project);
    
    @Query("SELECT COUNT(r) FROM Room r WHERE r.roomType.id = :roomTypeId")
    long countByRoomTypeId(@Param("roomTypeId") Long roomTypeId);
}

