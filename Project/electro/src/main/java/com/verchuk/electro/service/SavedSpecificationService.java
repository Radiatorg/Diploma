package com.verchuk.electro.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.verchuk.electro.dto.request.SaveSpecificationRequest;
import com.verchuk.electro.dto.response.CalculationReportResponse;
import com.verchuk.electro.dto.response.SavedSpecificationResponse;
import com.verchuk.electro.dto.response.SpecificationResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.SavedSpecification;
import com.verchuk.electro.repository.ProjectRepository;
import com.verchuk.electro.repository.SavedSpecificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class SavedSpecificationService {
    @Autowired
    private SavedSpecificationRepository savedSpecificationRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private SpecificationService specificationService;

    @Autowired
    private CalculationService calculationService;

    @Autowired
    private UserService userService;

    @Autowired
    private ObjectMapper objectMapper;

    @Transactional
    public SavedSpecificationResponse saveSpecification(SaveSpecificationRequest request) {
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(request.getProjectId(), currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", request.getProjectId()));

        // Получаем текущие данные спецификации и расчетов
        SpecificationResponse spec = specificationService.getSpecification(request.getProjectId());
        CalculationReportResponse calc = calculationService.getCalculationReport(request.getProjectId());

        System.out.println("SAVED_SPEC_SERVICE: Сохранение сметы. Позиций оборудования: " + (spec.getEquipmentItems() != null ? spec.getEquipmentItems().size() : 0));
        System.out.println("SAVED_SPEC_SERVICE: Расчетов по помещениям: " + (calc.getRoomCalculations() != null ? calc.getRoomCalculations().size() : 0));

        try {
            String specJson = objectMapper.writeValueAsString(spec);
            String calcJson = objectMapper.writeValueAsString(calc);
            
            System.out.println("SAVED_SPEC_SERVICE: Размер JSON спецификации: " + specJson.length() + " символов");
            System.out.println("SAVED_SPEC_SERVICE: Размер JSON расчетов: " + calcJson.length() + " символов");

            SavedSpecification saved = SavedSpecification.builder()
                    .project(project)
                    .name(request.getName())
                    .specificationData(specJson)
                    .calculationData(calcJson)
                    .totalCost(calc.getTotalProjectCost())
                    .totalPower(calc.getTotalPowerConsumption())
                    .totalCurrent(calc.getTotalCurrent())
                    .cableSection(calc.getRecommendedCableCrossSection())
                    .rcdRating(calc.getRecommendedRcdRating())
                    .build();

            saved = savedSpecificationRepository.save(saved);
            
            // Проверяем, что данные сохранились
            savedSpecificationRepository.flush(); // Принудительно сохраняем изменения в БД
            SavedSpecification savedCheck = savedSpecificationRepository.findById(saved.getId()).orElse(null);
            if (savedCheck != null) {
                System.out.println("SAVED_SPEC_SERVICE: После сохранения - specificationData is null: " + (savedCheck.getSpecificationData() == null));
                System.out.println("SAVED_SPEC_SERVICE: После сохранения - calculationData is null: " + (savedCheck.getCalculationData() == null));
                if (savedCheck.getSpecificationData() != null) {
                    System.out.println("SAVED_SPEC_SERVICE: После сохранения - размер specificationData: " + savedCheck.getSpecificationData().length());
                }
                if (savedCheck.getCalculationData() != null) {
                    System.out.println("SAVED_SPEC_SERVICE: После сохранения - размер calculationData: " + savedCheck.getCalculationData().length());
                }
            } else {
                System.out.println("SAVED_SPEC_SERVICE: ОШИБКА! Сохраненная смета не найдена после сохранения!");
            }
            
            return mapToResponse(saved);
        } catch (Exception e) {
            throw new RuntimeException("Error saving specification: " + e.getMessage(), e);
        }
    }

    public List<SavedSpecificationResponse> getSavedSpecifications(Long projectId) {
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        return savedSpecificationRepository.findByProject(project).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public SavedSpecificationResponse getSavedSpecification(Long projectId, Long specificationId) {
        return getSavedSpecification(projectId, specificationId, false);
    }
    
    public SavedSpecificationResponse getSavedSpecification(Long projectId, Long specificationId, boolean includeFullData) {
        System.out.println("SAVED_SPEC_SERVICE: getSavedSpecification вызван с includeFullData=" + includeFullData);
        
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        SavedSpecification saved = savedSpecificationRepository.findById(specificationId)
                .orElseThrow(() -> new ResourceNotFoundException("SavedSpecification", "id", specificationId));

        if (!saved.getProject().getId().equals(project.getId())) {
            throw new ResourceNotFoundException("SavedSpecification", "id", specificationId);
        }

        System.out.println("SAVED_SPEC_SERVICE: Найдена смета ID=" + saved.getId() + ", name=" + saved.getName());
        System.out.println("SAVED_SPEC_SERVICE: specificationData is null: " + (saved.getSpecificationData() == null));
        System.out.println("SAVED_SPEC_SERVICE: calculationData is null: " + (saved.getCalculationData() == null));
        
        if (saved.getSpecificationData() != null) {
            System.out.println("SAVED_SPEC_SERVICE: Размер specificationData: " + saved.getSpecificationData().length() + " символов");
        }
        if (saved.getCalculationData() != null) {
            System.out.println("SAVED_SPEC_SERVICE: Размер calculationData: " + saved.getCalculationData().length() + " символов");
        }

        SavedSpecificationResponse response = mapToResponse(saved, includeFullData);
        
        System.out.println("SAVED_SPEC_SERVICE: Ответ сформирован. specification в ответе: " + (response.getSpecification() != null));
        System.out.println("SAVED_SPEC_SERVICE: Ответ сформирован. calculation в ответе: " + (response.getCalculation() != null));
        
        return response;
    }

    @Transactional
    public void deleteSavedSpecification(Long projectId, Long specificationId) {
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        SavedSpecification saved = savedSpecificationRepository.findById(specificationId)
                .orElseThrow(() -> new ResourceNotFoundException("SavedSpecification", "id", specificationId));

        if (!saved.getProject().getId().equals(project.getId())) {
            throw new ResourceNotFoundException("SavedSpecification", "id", specificationId);
        }

        savedSpecificationRepository.delete(saved);
    }

    private SavedSpecificationResponse mapToResponse(SavedSpecification saved) {
        return mapToResponse(saved, false);
    }
    
    private SavedSpecificationResponse mapToResponse(SavedSpecification saved, boolean includeFullData) {
        SavedSpecificationResponse.SavedSpecificationResponseBuilder builder = SavedSpecificationResponse.builder()
                .id(saved.getId())
                .projectId(saved.getProject().getId())
                .name(saved.getName())
                .totalCost(saved.getTotalCost())
                .totalPower(saved.getTotalPower())
                .totalCurrent(saved.getTotalCurrent())
                .cableSection(saved.getCableSection())
                .rcdRating(saved.getRcdRating())
                .createdAt(saved.getCreatedAt())
                .updatedAt(saved.getUpdatedAt());
        
        // Если нужно включить полные данные, парсим JSON
        if (includeFullData) {
            System.out.println("SAVED_SPEC_SERVICE: Запрошены полные данные для сметы ID: " + saved.getId());
            try {
                if (saved.getSpecificationData() != null) {
                    System.out.println("SAVED_SPEC_SERVICE: Размер specificationData: " + saved.getSpecificationData().length() + " символов");
                    SpecificationResponse spec = objectMapper.readValue(
                            saved.getSpecificationData(), 
                            SpecificationResponse.class);
                    builder.specification(spec);
                    System.out.println("SAVED_SPEC_SERVICE: Спецификация успешно распарсена. Позиций: " + (spec.getEquipmentItems() != null ? spec.getEquipmentItems().size() : 0));
                } else {
                    System.out.println("SAVED_SPEC_SERVICE: specificationData is null");
                }
                if (saved.getCalculationData() != null) {
                    System.out.println("SAVED_SPEC_SERVICE: Размер calculationData: " + saved.getCalculationData().length() + " символов");
                    CalculationReportResponse calc = objectMapper.readValue(
                            saved.getCalculationData(), 
                            CalculationReportResponse.class);
                    builder.calculation(calc);
                    System.out.println("SAVED_SPEC_SERVICE: Расчеты успешно распарсены");
                } else {
                    System.out.println("SAVED_SPEC_SERVICE: calculationData is null");
                }
            } catch (Exception e) {
                // Если не удалось распарсить, просто не включаем полные данные
                // Логируем ошибку, но не прерываем выполнение
                System.err.println("SAVED_SPEC_SERVICE: Ошибка парсинга сохраненных данных: " + e.getMessage());
                e.printStackTrace();
            }
        }
        
        return builder.build();
    }
}

