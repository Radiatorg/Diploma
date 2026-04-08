package com.verchuk.electro.service;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileService {
    private final Path rootLocation;

    public FileService() {
        // Создаем директорию для хранения файлов (используем абсолютный путь)
        try {
            // Пытаемся использовать системную временную директорию или рабочую директорию
            String workingDir = System.getProperty("user.dir");
            System.out.println("FileService: user.dir = " + workingDir);
            
            // Пробуем найти uploads относительно текущего класса или рабочей директории
            Path possibleLocation = Paths.get(workingDir, "uploads").toAbsolutePath().normalize();
            
            // Если uploads не существует в рабочей директории, пробуем найти его в поддиректориях
            if (!Files.exists(possibleLocation)) {
                // Пробуем Project/electro/uploads
                Path electroLocation = Paths.get(workingDir, "Project", "electro", "uploads").toAbsolutePath().normalize();
                if (Files.exists(electroLocation)) {
                    possibleLocation = electroLocation;
                    System.out.println("FileService: Found uploads in Project/electro: " + possibleLocation);
                } else {
                    // Пробуем в родительской директории
                    Path parentLocation = Paths.get(workingDir).getParent().resolve("uploads").toAbsolutePath().normalize();
                    if (Files.exists(parentLocation)) {
                        possibleLocation = parentLocation;
                        System.out.println("FileService: Found uploads in parent directory: " + possibleLocation);
                    }
                }
            }
            
            this.rootLocation = possibleLocation;
            
            Files.createDirectories(rootLocation);
            // Создаем поддиректории
            Files.createDirectories(rootLocation.resolve("profiles"));
            Files.createDirectories(rootLocation.resolve("appliances"));
            Files.createDirectories(rootLocation.resolve("general"));
            Files.createDirectories(rootLocation.resolve("chat"));
            Files.createDirectories(rootLocation.resolve("manufacturers"));
            Files.createDirectories(rootLocation.resolve("manufactures"));
            
            System.out.println("FileService initialized. Root location: " + rootLocation);
            System.out.println("FileService: Chat directory: " + rootLocation.resolve("chat"));
            System.out.println("FileService: Chat directory exists: " + Files.exists(rootLocation.resolve("chat")));
            
            // Проверяем, есть ли файлы в chat директории
            Path chatDir = rootLocation.resolve("chat");
            if (Files.exists(chatDir)) {
                try {
                    long fileCount = Files.list(chatDir).count();
                    System.out.println("FileService: Chat directory contains " + fileCount + " files");
                } catch (IOException e) {
                    System.out.println("FileService: Error listing chat directory: " + e.getMessage());
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize storage", e);
        }
    }

    public String saveFile(MultipartFile file, String type) throws IOException {
        if (file.isEmpty()) {
            throw new RuntimeException("File is empty");
        }

        // Генерируем уникальное имя файла
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String extension = "";
        int lastDotIndex = originalFilename.lastIndexOf('.');
        if (lastDotIndex > 0) {
            extension = originalFilename.substring(lastDotIndex);
        }
        String filename = UUID.randomUUID().toString() + extension;

        // Определяем директорию по типу
        String normalizedType = normalizeStorageType(type);
        Path targetDir = rootLocation.resolve(normalizedType);
        Files.createDirectories(targetDir);

        // Сохраняем файл
        Path targetFile = targetDir.resolve(filename);
        Files.copy(file.getInputStream(), targetFile, StandardCopyOption.REPLACE_EXISTING);

        // Возвращаем только имя файла (URL будет формироваться в контроллере)
        return filename;
    }

    public Resource loadFile(String filename) throws IOException {
        // Ищем файл во всех поддиректориях
        Path[] searchDirs = {
            rootLocation.resolve("profiles"),
            rootLocation.resolve("appliances"),
            rootLocation.resolve("manufacturers"),
            rootLocation.resolve("manufactures"),
            rootLocation.resolve("general"),
            rootLocation.resolve("chat")
        };

        System.out.println("FileService.loadFile: Looking for file: " + filename);
        System.out.println("FileService.loadFile: Root location: " + rootLocation);
        System.out.println("FileService.loadFile: Root location exists: " + Files.exists(rootLocation));
        
        for (Path dir : searchDirs) {
            Path file = dir.resolve(filename).toAbsolutePath().normalize();
            System.out.println("Trying to load file from: " + file);
            System.out.println("Directory exists: " + Files.exists(dir) + ", Directory path: " + dir);
            System.out.println("File exists: " + Files.exists(file) + ", File readable: " + (Files.exists(file) ? Files.isReadable(file) : false));
            
            if (Files.exists(file) && Files.isReadable(file)) {
                // Используем FileSystemResource для более надежной работы с локальными файлами
                try {
                    Resource resource = new FileSystemResource(file.toFile());
                    if (resource.exists() && resource.isReadable()) {
                        System.out.println("File found and readable: " + file);
                        return resource;
                    } else {
                        System.out.println("File exists but resource is not readable: " + file);
                    }
                } catch (Exception e) {
                    System.out.println("Error creating FileSystemResource: " + e.getMessage());
                    // Попробуем UrlResource как fallback
                    try {
                        Resource resource = new UrlResource(file.toUri());
                        if (resource.exists() && resource.isReadable()) {
                            System.out.println("File loaded using UrlResource (fallback)");
                            return resource;
                        }
                    } catch (Exception e2) {
                        System.out.println("UrlResource fallback also failed: " + e2.getMessage());
                    }
                }
            } else {
                System.out.println("File does not exist or is not readable: " + file);
            }
        }

        throw new IOException("File not found: " + filename + ". Searched in: " + 
            rootLocation.resolve("profiles") + ", " + 
            rootLocation.resolve("appliances") + ", " + 
            rootLocation.resolve("manufacturers") + ", " +
            rootLocation.resolve("manufactures") + ", " +
            rootLocation.resolve("general") + ", " +
            rootLocation.resolve("chat"));
    }

    public void deleteFile(String filename) throws IOException {
        Path[] searchDirs = {
            rootLocation.resolve("profiles"),
            rootLocation.resolve("appliances"),
            rootLocation.resolve("manufacturers"),
            rootLocation.resolve("manufactures"),
            rootLocation.resolve("general"),
            rootLocation.resolve("chat")
        };

        for (Path dir : searchDirs) {
            Path file = dir.resolve(filename);
            if (Files.exists(file)) {
                Files.delete(file);
                return;
            }
        }

        throw new IOException("File not found: " + filename);
    }

    public String getContentType(String filename) throws IOException {
        Path[] searchDirs = {
            rootLocation.resolve("profiles"),
            rootLocation.resolve("appliances"),
            rootLocation.resolve("manufacturers"),
            rootLocation.resolve("manufactures"),
            rootLocation.resolve("general"),
            rootLocation.resolve("chat")
        };

        for (Path dir : searchDirs) {
            Path file = dir.resolve(filename);
            if (Files.exists(file)) {
                return Files.probeContentType(file);
            }
        }

        return "application/octet-stream";
    }

    private static String normalizeStorageType(String type) {
        if (type == null || type.isBlank()) {
            return "general";
        }
        String normalized = type.trim().toLowerCase();
        if ("manufactures".equals(normalized)) {
            return "manufacturers";
        }
        return normalized;
    }
}

