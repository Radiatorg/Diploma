package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.ApplianceRequest;
import com.verchuk.electro.dto.request.RegisterRequest;
import com.verchuk.electro.dto.request.RoomTypeRequest;
import com.verchuk.electro.dto.request.UserUpdateRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.ApplianceResponse;
import com.verchuk.electro.dto.response.ApplianceStatisticsResponse;
import com.verchuk.electro.dto.response.ManufacturerStatisticsResponse;
import com.verchuk.electro.dto.response.ProjectResponse;
import com.verchuk.electro.dto.response.RoomTypeResponse;
import com.verchuk.electro.dto.response.UserResponse;
import com.verchuk.electro.service.ApplianceService;
import com.verchuk.electro.service.ProjectService;
import com.verchuk.electro.service.RoomTypeService;
import com.verchuk.electro.service.StatisticsService;
import com.verchuk.electro.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    @Autowired
    private UserService userService;

    @Autowired
    private ApplianceService applianceService;

    @Autowired
    private RoomTypeService roomTypeService;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private StatisticsService statisticsService;

    // User Management
    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody RegisterRequest request,
                                                   @RequestParam(required = false) List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            roles = List.of("DESIGNER");
        }
        return ResponseEntity.ok(userService.createUser(request, roles));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long id,
                                                   @Valid @RequestBody UserUpdateRequest request,
                                                   @RequestParam(required = false) List<String> roles) {
        return ResponseEntity.ok(userService.updateUser(id, request, roles));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.success("User deleted successfully"));
    }

    // Appliance Management
    @PostMapping("/appliances")
    public ResponseEntity<ApplianceResponse> createAppliance(@Valid @RequestBody ApplianceRequest request) {
        return ResponseEntity.ok(applianceService.createAppliance(request));
    }

    @PutMapping("/appliances/{id}")
    public ResponseEntity<ApplianceResponse> updateAppliance(@PathVariable Long id,
                                                              @Valid @RequestBody ApplianceRequest request) {
        return ResponseEntity.ok(applianceService.updateAppliance(id, request));
    }

    @DeleteMapping("/appliances/{id}")
    public ResponseEntity<ApiResponse> deleteAppliance(@PathVariable Long id) {
        applianceService.deleteAppliance(id);
        return ResponseEntity.ok(ApiResponse.success("Appliance deleted successfully"));
    }

    // Room Type Management
    @GetMapping("/room-types")
    public ResponseEntity<List<RoomTypeResponse>> getAllRoomTypes() {
        return ResponseEntity.ok(roomTypeService.getAllRoomTypes());
    }

    @PostMapping("/room-types")
    public ResponseEntity<RoomTypeResponse> createRoomType(@Valid @RequestBody RoomTypeRequest request) {
        return ResponseEntity.ok(roomTypeService.createRoomType(request));
    }

    @PutMapping("/room-types/{id}")
    public ResponseEntity<RoomTypeResponse> updateRoomType(@PathVariable Long id,
                                                           @Valid @RequestBody RoomTypeRequest request) {
        return ResponseEntity.ok(roomTypeService.updateRoomType(id, request));
    }

    @DeleteMapping("/room-types/{id}")
    public ResponseEntity<ApiResponse> deleteRoomType(@PathVariable Long id) {
        roomTypeService.deleteRoomType(id);
        return ResponseEntity.ok(ApiResponse.success("Room type deleted successfully"));
    }

    // Project Viewing
    @GetMapping("/projects")
    public ResponseEntity<List<ProjectResponse>> getAllProjects() {
        return ResponseEntity.ok(projectService.getAllProjects());
    }

    @GetMapping("/projects/{id}")
    public ResponseEntity<ProjectResponse> getProjectById(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getProjectById(id));
    }

    // Statistics
    @GetMapping("/statistics/appliances")
    public ResponseEntity<List<ApplianceStatisticsResponse>> getApplianceStatistics() {
        return ResponseEntity.ok(statisticsService.getApplianceStatistics());
    }

    @GetMapping("/statistics/manufacturers")
    public ResponseEntity<List<ManufacturerStatisticsResponse>> getManufacturerStatistics() {
        return ResponseEntity.ok(statisticsService.getManufacturerStatistics());
    }
}

