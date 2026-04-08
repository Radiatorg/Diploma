package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.RoomRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.RoomResponse;
import com.verchuk.electro.service.RoomService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}/rooms")
public class RoomController {
    @Autowired
    private RoomService roomService;

    @GetMapping
    public ResponseEntity<List<RoomResponse>> getRoomsByProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(roomService.getRoomsByProject(projectId));
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<RoomResponse> getRoomById(@PathVariable Long projectId, @PathVariable Long roomId) {
        return ResponseEntity.ok(roomService.getRoomById(projectId, roomId));
    }

    @PostMapping
    public ResponseEntity<RoomResponse> createRoom(@PathVariable Long projectId, @Valid @RequestBody RoomRequest request) {
        return ResponseEntity.ok(roomService.createRoom(projectId, request));
    }

    @PutMapping("/{roomId}")
    public ResponseEntity<RoomResponse> updateRoom(@PathVariable Long projectId, @PathVariable Long roomId,
                                                    @Valid @RequestBody RoomRequest request) {
        return ResponseEntity.ok(roomService.updateRoom(projectId, roomId, request));
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<ApiResponse> deleteRoom(@PathVariable Long projectId, @PathVariable Long roomId) {
        roomService.deleteRoom(projectId, roomId);
        return ResponseEntity.ok(ApiResponse.success("Room deleted successfully"));
    }

    @GetMapping("/{roomId}/walls")
    public ResponseEntity<List<com.verchuk.electro.dto.response.WallResponse>> getRoomWalls(
            @PathVariable Long projectId, 
            @PathVariable Long roomId) {
        return ResponseEntity.ok(roomService.getRoomWalls(projectId, roomId));
    }
}

