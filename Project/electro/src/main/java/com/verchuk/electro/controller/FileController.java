package com.verchuk.electro.controller;

import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.service.FileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/files")
public class FileController {
    @Autowired
    private FileService fileService;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse> uploadFile(@RequestParam("file") MultipartFile file,
                                                  @RequestParam(value = "type", defaultValue = "general") String type) {
        try {
            String filename = fileService.saveFile(file, type);
            String fileUrl = "/api/files/" + filename;
            return ResponseEntity.ok(ApiResponse.success("File uploaded successfully", fileUrl));
        } catch (IOException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to upload file: " + e.getMessage()));
        }
    }

    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> getFile(@PathVariable String filename) {
        try {
            System.out.println("Request to load file: " + filename);
            Resource resource = fileService.loadFile(filename);
            if (resource.exists() && resource.isReadable()) {
                String contentType = "application/octet-stream";
                try {
                    contentType = fileService.getContentType(filename);
                    if (contentType == null || contentType.isEmpty()) {
                        // Определяем по расширению
                        if (filename.toLowerCase().endsWith(".png")) {
                            contentType = "image/png";
                        } else if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")) {
                            contentType = "image/jpeg";
                        } else if (filename.toLowerCase().endsWith(".gif")) {
                            contentType = "image/gif";
                        } else if (filename.toLowerCase().endsWith(".webp")) {
                            contentType = "image/webp";
                        }
                    }
                } catch (IOException e) {
                    System.out.println("Error getting content type: " + e.getMessage());
                    // Используем дефолтный тип
                }

                System.out.println("Returning file with content type: " + contentType);
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                        .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                        .body(resource);
            } else {
                System.out.println("Resource exists: " + resource.exists() + ", readable: " + resource.isReadable());
                return ResponseEntity.notFound().build();
            }
        } catch (IOException e) {
            System.out.println("Error loading file: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{filename:.+}")
    public ResponseEntity<ApiResponse> deleteFile(@PathVariable String filename) {
        try {
            fileService.deleteFile(filename);
            return ResponseEntity.ok(ApiResponse.success("File deleted successfully"));
        } catch (IOException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to delete file: " + e.getMessage()));
        }
    }
}

