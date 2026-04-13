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

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
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
        return getAllActiveAppliances(
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty()
        ).getAppliances();
    }

    @Transactional(readOnly = true)
    public ApplianceQueryResult getAllActiveAppliances(Optional<String> search,
                                                       Optional<String> category,
                                                       Optional<String> sortBy,
                                                       Optional<String> sortDir,
                                                       Optional<BigDecimal> priceFrom,
                                                       Optional<BigDecimal> priceTo,
                                                       Optional<Integer> page,
                                                       Optional<Integer> size) {
        try {
            List<Appliance> appliances = applianceRepository.findAllActiveOrderedByName();
            Comparator<Appliance> comparator = buildComparator(sortBy.orElse("name"));
            if ("desc".equalsIgnoreCase(sortDir.orElse("asc"))) {
                comparator = comparator.reversed();
            }

            List<Appliance> filteredAndSorted = appliances.stream()
                    .filter(appliance -> search.map(q -> matchesSearch(appliance, q)).orElse(true))
                    .filter(appliance -> category.map(cat -> matchesCategory(appliance, cat)).orElse(true))
                    .filter(appliance -> priceFrom.map(min -> appliancePrice(appliance).compareTo(min) >= 0).orElse(true))
                    .filter(appliance -> priceTo.map(max -> appliancePrice(appliance).compareTo(max) <= 0).orElse(true))
                    .sorted(comparator)
                    .collect(Collectors.toList());

            long totalItems = filteredAndSorted.size();
            List<Appliance> paginated = paginateAppliances(filteredAndSorted, page, size);
            List<ApplianceResponse> responses = paginated.stream()
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

            return new ApplianceQueryResult(responses, totalItems);
        } catch (Exception e) {
            System.err.println("Критическая ошибка при получении списка приборов: " + e.getMessage());
            e.printStackTrace();
            // Возвращаем пустой список вместо исключения, чтобы страница не ломалась
            return new ApplianceQueryResult(List.of(), 0);
        }
    }

    private Comparator<Appliance> buildComparator(String sortBy) {
        return switch (sortBy) {
            case "id" -> Comparator.comparing(Appliance::getId, nullSafeComparableComparator());
            case "name" -> Comparator.comparing(Appliance::getName, nullSafeStringComparator());
            case "powerConsumption" -> Comparator.comparing(Appliance::getPowerConsumption, nullSafeComparableComparator());
            case "voltage" -> Comparator.comparing(Appliance::getVoltage, nullSafeComparableComparator());
            case "current" -> Comparator.comparing(Appliance::getCurrent, nullSafeComparableComparator());
            case "price" -> Comparator.comparing(Appliance::getPrice, nullSafeComparableComparator());
            case "model" -> Comparator.comparing(Appliance::getModel, nullSafeStringComparator());
            case "ipRating" -> Comparator.comparing(Appliance::getIpRating, nullSafeStringComparator());
            case "categories" -> Comparator.comparing(this::categoriesAsSortedString, nullSafeStringComparator());
            case "manufacturer" -> Comparator.comparing(this::manufacturerName, nullSafeStringComparator());
            default -> Comparator.comparing(Appliance::getName, nullSafeStringComparator());
        };
    }

    private String categoriesAsSortedString(Appliance appliance) {
        if (appliance.getCategories() == null || appliance.getCategories().isEmpty()) {
            return null;
        }
        return appliance.getCategories().stream()
                .map(Category::getName)
                .filter(name -> name != null && !name.isBlank())
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .collect(Collectors.joining(","));
    }

    private String manufacturerName(Appliance appliance) {
        if (appliance.getManufacturer() == null) {
            return null;
        }
        return appliance.getManufacturer().getName();
    }

    private boolean matchesCategory(Appliance appliance, String category) {
        String normalizedCategory = category == null ? "" : category.trim();
        if (normalizedCategory.isEmpty()) {
            return true;
        }
        return appliance.getCategories() != null && appliance.getCategories().stream()
                .anyMatch(cat -> cat != null
                        && cat.getName() != null
                        && cat.getName().equalsIgnoreCase(normalizedCategory));
    }

    private boolean matchesSearch(Appliance appliance, String query) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
        if (normalizedQuery.isEmpty()) {
            return true;
        }

        return containsIgnoreCase(appliance.getName(), normalizedQuery)
                || containsIgnoreCase(appliance.getModel(), normalizedQuery)
                || containsIgnoreCase(appliance.getDescription(), normalizedQuery)
                || containsIgnoreCase(appliance.getIpRating(), normalizedQuery)
                || stringValue(appliance.getId()).contains(normalizedQuery)
                || stringValue(appliance.getPowerConsumption()).contains(normalizedQuery)
                || stringValue(appliance.getVoltage()).contains(normalizedQuery)
                || stringValue(appliance.getCurrent()).contains(normalizedQuery)
                || stringValue(appliance.getPrice()).contains(normalizedQuery)
                || categoriesAsSortedString(appliance) != null
                && categoriesAsSortedString(appliance).toLowerCase().contains(normalizedQuery)
                || manufacturerName(appliance) != null
                && manufacturerName(appliance).toLowerCase().contains(normalizedQuery);
    }

    private String stringValue(Object value) {
        return value == null ? "" : value.toString().toLowerCase();
    }

    private boolean containsIgnoreCase(String value, String query) {
        return value != null && value.toLowerCase().contains(query);
    }

    private BigDecimal appliancePrice(Appliance appliance) {
        return appliance.getPrice() == null ? BigDecimal.ZERO : appliance.getPrice();
    }

    private List<Appliance> paginateAppliances(List<Appliance> appliances, Optional<Integer> page, Optional<Integer> size) {
        if (page.isEmpty() && size.isEmpty()) {
            return appliances;
        }

        int safePage = Math.max(0, page.orElse(0));
        int safeSize = size.orElse(20);
        if (safeSize <= 0) {
            safeSize = 20;
        }

        int fromIndex = safePage * safeSize;
        if (fromIndex >= appliances.size()) {
            return List.of();
        }

        int toIndex = Math.min(fromIndex + safeSize, appliances.size());
        return appliances.subList(fromIndex, toIndex);
    }

    private Comparator<String> nullSafeStringComparator() {
        return Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER);
    }

    private <T extends Comparable<? super T>> Comparator<T> nullSafeComparableComparator() {
        return Comparator.nullsLast(Comparator.naturalOrder());
    }

    public static class ApplianceQueryResult {
        private final List<ApplianceResponse> appliances;
        private final long totalItems;

        public ApplianceQueryResult(List<ApplianceResponse> appliances, long totalItems) {
            this.appliances = appliances;
            this.totalItems = totalItems;
        }

        public List<ApplianceResponse> getAppliances() {
            return appliances;
        }

        public long getTotalItems() {
            return totalItems;
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

