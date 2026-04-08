package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.UserUpdateRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.UserResponse;
import com.verchuk.electro.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/user")
public class UserController {
    @Autowired
    private UserService userService;

    @GetMapping("/profile")
    public ResponseEntity<UserResponse> getCurrentUserProfile() {
        return ResponseEntity.ok(userService.getCurrentUserProfile());
    }

    @PutMapping("/profile")
    public ResponseEntity<UserResponse> updateCurrentUserProfile(@Valid @RequestBody UserUpdateRequest request) {
        return ResponseEntity.ok(userService.updateCurrentUserProfile(request));
    }

    @DeleteMapping("/profile")
    public ResponseEntity<ApiResponse> deleteCurrentUser() {
        userService.deleteCurrentUser();
        return ResponseEntity.ok(ApiResponse.success("User deleted successfully"));
    }
}

