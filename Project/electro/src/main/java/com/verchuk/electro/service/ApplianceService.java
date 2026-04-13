package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.ApplianceRequest;
import com.verchuk.electro.dto.response.ApplianceResponse;
import com.verchuk.electro.dto.response.CategoryResponse;
import com.verchuk.electro.dto.response.ManufacturerSummaryResponse;
import com.verchuk.electro.exception.BadRequestException;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Appliance;
import com.verchuk.electro.model.Category;
import com.verchuk.electro.model.Manufacturer;
import com.verchuk.electro.repository.ApplianceRepository;
import com.verchuk.electro.repository.CategoryRepository;
import com.verchuk.electro.repository.ManufacturerRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ApplianceService {
    @Autowired
    private ApplianceRepository applianceRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ManufacturerRepository manufacturerRepository;

    @Autowired
    private com.verchuk.electro.repository.ProjectApplianceRepository projectApplianceRepository;
    
    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(readOnly = true)
    public List<ApplianceResponse> getAllActiveAppliances() {
        try {
            List<Appliance> appliances = applianceRepository.findAllActiveOrderedByName();
            return appliances.stream()
                    .map(appliance -> {
                        try {
                            return mapToApplianceResponse(appliance);
                        } catch (Exception e) {
                            System.err.println("Ошибка маппинга прибора ID " + appliance.getId() + ": " + e.getMessage());
                            e.printStackTrace();
                            // Возвращаем прибор без категорий в случае ошибки
                            return ApplianceResponse.builder()
                                    .id(appliance.getId())
                                    .name(appliance.getName())
                                    .description(appliance.getDescription())
                                    .powerConsumption(appliance.getPowerConsumption())
                                    .voltage(appliance.getVoltage())
                                    .current(appliance.getCurrent())
                                    .category(appliance.getCategory())
                                    .categories(List.of()) // Пустой список категорий
                                    .imageUrl(appliance.getImageUrl())
                                    .width(appliance.getWidth())
                                    .height(appliance.getHeight())
                                    .price(appliance.getPrice())
                                    .model(appliance.getModel())
                                    .ipRating(appliance.getIpRating())
                                    .color(appliance.getColor())
                                    .cableBrand(appliance.getCableBrand())
                                    .cableCrossSection(appliance.getCableCrossSection())
                                    .active(appliance.getActive())
                                    .manufacturer(mapManufacturerSafe(appliance))
                                    .build();
                        }
                    })
                    .collect(Collectors.toList());
        } catch (Exception e) {
            System.err.println("Критическая ошибка при получении списка приборов: " + e.getMessage());
            e.printStackTrace();
            // Возвращаем пустой список вместо исключения, чтобы страница не ломалась
            return List.of();
        }
    }

    public ApplianceResponse getApplianceById(Long id) {
        Appliance appliance = applianceRepository.findByIdWithCategories(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appliance", "id", id));
        return mapToApplianceResponse(appliance);
    }

    /** Публичный маппинг для других сервисов (например, список приборов производителя) */
    public ApplianceResponse mapToResponse(Appliance appliance) {
        return mapToApplianceResponse(appliance);
    }

    @Transactional
    public ApplianceResponse createAppliance(ApplianceRequest request) {
        String normalizedModel = trimToNull(request.getModel());
        if (normalizedModel != null && applianceRepository.existsByModelIgnoreCase(normalizedModel)) {
            throw new BadRequestException("Прибор с такой моделью уже существует");
        }

        Appliance appliance = Appliance.builder()
                .name(request.getName())
                .description(request.getDescription())
                .powerConsumption(request.getPowerConsumption())
                .voltage(request.getVoltage())
                .current(request.getCurrent())
                .category(request.getCategory()) // Для обратной совместимости
                .imageUrl(request.getImageUrl())
                .width(request.getWidth())
                .height(request.getHeight())
                .price(request.getPrice())
                .model(normalizedModel)
                .ipRating(request.getIpRating())
                .color(request.getColor())
                .cableBrand(request.getCableBrand())
                .cableCrossSection(request.getCableCrossSection())
                .manufacturer(resolveManufacturer(request.getManufacturerId()))
                .active(true)
                .categories(new HashSet<>())
                .build();

        Set<Category> categories = new HashSet<>();
        
        // Добавляем существующие категории по ID
        if (request.getCategoryIds() != null && !request.getCategoryIds().isEmpty()) {
            Set<Category> existingCategories = request.getCategoryIds().stream()
                    .map(categoryId -> categoryRepository.findById(categoryId)
                            .orElseThrow(() -> new ResourceNotFoundException("Category", "id", categoryId)))
                    .collect(Collectors.toSet());
            categories.addAll(existingCategories);
        }
        
        // Создаем новые категории по именам
        if (request.getNewCategoryNames() != null && !request.getNewCategoryNames().isEmpty()) {
            for (String categoryName : request.getNewCategoryNames()) {
                if (categoryName != null && !categoryName.trim().isEmpty()) {
                    String trimmedName = categoryName.trim();
                    Category newCategory = categoryRepository.findByName(trimmedName)
                            .orElseGet(() -> {
                                Category cat = Category.builder()
                                        .name(trimmedName)
                                        .description(null)
                                        .build();
                                return categoryRepository.save(cat);
                            });
                    categories.add(newCategory);
                }
            }
        }
        
        // Для обратной совместимости: если указано старое поле category
        if (categories.isEmpty() && request.getCategory() != null && !request.getCategory().isEmpty()) {
            Category category = categoryRepository.findByName(request.getCategory())
                    .orElseGet(() -> {
                        Category newCategory = Category.builder()
                                .name(request.getCategory())
                                .description(null)
                                .build();
                        return categoryRepository.save(newCategory);
                    });
            categories.add(category);
        }
        
        // Правильно устанавливаем коллекцию категорий для нового прибора
        appliance.getCategories().addAll(categories);

        Appliance savedAppliance = applianceRepository.save(appliance);
        
        return mapToApplianceResponse(savedAppliance);
    }

    @Transactional
    public ApplianceResponse updateAppliance(Long id, ApplianceRequest request) {
        // Загружаем прибор с категориями для правильного обновления
        Appliance appliance = applianceRepository.findByIdWithCategories(id)
                .orElseGet(() -> applianceRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Appliance", "id", id)));

        String normalizedModel = trimToNull(request.getModel());
        String currentModel = trimToNull(appliance.getModel());
        boolean modelChanged = !equalsIgnoreCaseNullable(normalizedModel, currentModel);
        if (modelChanged && normalizedModel != null
                && applianceRepository.existsByModelIgnoreCaseAndIdNot(normalizedModel, id)) {
            throw new BadRequestException("Нельзя установить модель: такая модель уже используется другим прибором");
        }

        appliance.setName(request.getName());
        appliance.setDescription(request.getDescription());
        appliance.setPowerConsumption(request.getPowerConsumption());
        appliance.setVoltage(request.getVoltage());
        appliance.setCurrent(request.getCurrent());
        appliance.setCategory(request.getCategory()); // Для обратной совместимости
        if (request.getImageUrl() != null) {
            appliance.setImageUrl(request.getImageUrl());
        }
        appliance.setWidth(request.getWidth());
        appliance.setHeight(request.getHeight());
        appliance.setPrice(request.getPrice());
        appliance.setModel(normalizedModel);
        appliance.setIpRating(request.getIpRating());
        appliance.setColor(request.getColor());
        appliance.setCableBrand(request.getCableBrand());
        appliance.setCableCrossSection(request.getCableCrossSection());
        appliance.setManufacturer(resolveManufacturer(request.getManufacturerId()));

        // Обновляем категории
        Set<Category> categories = new HashSet<>();
        
        // Добавляем существующие категории по ID
        if (request.getCategoryIds() != null && !request.getCategoryIds().isEmpty()) {
            Set<Category> existingCategories = request.getCategoryIds().stream()
                    .map(categoryId -> categoryRepository.findById(categoryId)
                            .orElseThrow(() -> new ResourceNotFoundException("Category", "id", categoryId)))
                    .collect(Collectors.toSet());
            categories.addAll(existingCategories);
        }
        
        // Создаем новые категории по именам
        if (request.getNewCategoryNames() != null && !request.getNewCategoryNames().isEmpty()) {
            for (String categoryName : request.getNewCategoryNames()) {
                if (categoryName != null && !categoryName.trim().isEmpty()) {
                    String trimmedName = categoryName.trim();
                    Category newCategory = categoryRepository.findByName(trimmedName)
                            .orElseGet(() -> {
                                Category cat = Category.builder()
                                        .name(trimmedName)
                                        .description(null)
                                        .build();
                                return categoryRepository.save(cat);
                            });
                    categories.add(newCategory);
                }
            }
        }
        
        // Для обратной совместимости: если указано старое поле category
        if (categories.isEmpty() && request.getCategory() != null && !request.getCategory().isEmpty()) {
            Category category = categoryRepository.findByName(request.getCategory())
                    .orElseGet(() -> {
                        Category newCategory = Category.builder()
                                .name(request.getCategory())
                                .description(null)
                                .build();
                        return categoryRepository.save(newCategory);
                    });
            categories.add(category);
        }
        
        // Правильно обновляем коллекцию категорий для Hibernate
        // Очищаем существующие связи через SQL, чтобы избежать проблем с PersistentSet
        entityManager.createNativeQuery("DELETE FROM appliance_categories WHERE appliance_id = :applianceId")
                .setParameter("applianceId", appliance.getId())
                .executeUpdate();
        
        // Устанавливаем новые категории через новый HashSet
        appliance.setCategories(new HashSet<>(categories));
        
        // Сохраняем прибор
        Appliance savedAppliance = applianceRepository.save(appliance);
        entityManager.flush(); // Принудительно сохраняем изменения
        
        // Перезагружаем прибор с категориями для ответа
        Appliance reloadedAppliance = applianceRepository.findByIdWithCategories(savedAppliance.getId())
                .orElse(savedAppliance);
        
        return mapToApplianceResponse(reloadedAppliance);
    }

    @Transactional
    public void deleteAppliance(Long id) {
        Appliance appliance = applianceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appliance", "id", id));
        
        // Проверяем, используется ли прибор в проектах
        long usageCount = projectApplianceRepository.countByApplianceId(id);
        if (usageCount > 0) {
            throw new BadRequestException(
                "Нельзя удалить электроприбор, так как он уже используется в проектах пользователей. " +
                "Прибор используется в " + usageCount + " проекте(ах)."
            );
        }
        
        appliance.setActive(false);
        applianceRepository.save(appliance);
    }

    private ApplianceResponse mapToApplianceResponse(Appliance appliance) {
        if (appliance == null) {
            throw new IllegalArgumentException("Appliance cannot be null");
        }
        
        List<CategoryResponse> categories = List.of();
        try {
            // Безопасно получаем категории, избегая инициализации коллекции если она не загружена
            Set<Category> categorySet = appliance.getCategories();
            if (categorySet != null && !categorySet.isEmpty()) {
                // Создаем копию коллекции, чтобы избежать проблем с PersistentSet
                categories = new java.util.ArrayList<>(categorySet).stream()
                        .filter(cat -> cat != null) // Фильтруем null категории
                        .map(cat -> {
                            try {
                                return CategoryResponse.builder()
                                        .id(cat.getId())
                                        .name(cat.getName() != null ? cat.getName() : "")
                                        .description(cat.getDescription())
                                        .build();
                            } catch (Exception e) {
                                System.err.println("Ошибка маппинга категории: " + e.getMessage());
                                return null;
                            }
                        })
                        .filter(cat -> cat != null) // Фильтруем null результаты
                        .collect(Collectors.toList());
            }
        } catch (Exception e) {
            System.err.println("Ошибка при обработке категорий прибора ID " + appliance.getId() + ": " + e.getMessage());
            e.printStackTrace();
            categories = List.of(); // В случае ошибки возвращаем пустой список
        }

        try {
            return ApplianceResponse.builder()
                    .id(appliance.getId())
                    .name(appliance.getName())
                    .description(appliance.getDescription())
                    .powerConsumption(appliance.getPowerConsumption())
                    .voltage(appliance.getVoltage())
                    .current(appliance.getCurrent())
                    .category(appliance.getCategory()) // Для обратной совместимости
                    .categories(categories)
                    .imageUrl(appliance.getImageUrl())
                    .width(appliance.getWidth())
                    .height(appliance.getHeight())
                    .price(appliance.getPrice())
                    .model(appliance.getModel())
                    .ipRating(appliance.getIpRating())
                    .color(appliance.getColor())
                    .cableBrand(appliance.getCableBrand())
                    .cableCrossSection(appliance.getCableCrossSection())
                    .active(appliance.getActive())
                    .manufacturer(mapManufacturerSafe(appliance))
                    .build();
        } catch (Exception e) {
            System.err.println("Ошибка создания ApplianceResponse для прибора ID " + appliance.getId() + ": " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to map appliance to response", e);
        }
    }

    private Manufacturer resolveManufacturer(Long manufacturerId) {
        if (manufacturerId == null) {
            return null;
        }
        return manufacturerRepository.findById(manufacturerId)
                .orElseThrow(() -> new ResourceNotFoundException("Manufacturer", "id", manufacturerId));
    }

    private ManufacturerSummaryResponse mapManufacturerSafe(Appliance appliance) {
        try {
            Manufacturer m = appliance.getManufacturer();
            if (m == null) {
                return null;
            }
            return ManufacturerSummaryResponse.builder()
                    .id(m.getId())
                    .name(m.getName())
                    .logoUrl(m.getLogoUrl())
                    .build();
        } catch (Exception e) {
            return null;
        }
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static boolean equalsIgnoreCaseNullable(String a, String b) {
        if (a == null && b == null) {
            return true;
        }
        if (a == null || b == null) {
            return false;
        }
        return a.equalsIgnoreCase(b);
    }
}

