package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.CategoryRequest;
import com.verchuk.electro.dto.response.CategoryResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Category;
import com.verchuk.electro.repository.CategoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CategoryService {
    @Autowired
    private CategoryRepository categoryRepository;

    public List<CategoryResponse> getAllCategories() {
        return categoryRepository.findAll().stream()
                .map(this::mapToCategoryResponse)
                .collect(Collectors.toList());
    }

    public CategoryResponse getCategoryById(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        return mapToCategoryResponse(category);
    }

    @Transactional
    public CategoryResponse createCategory(CategoryRequest request) {
        // Проверяем, существует ли категория с таким именем
        Category existingCategory = categoryRepository.findByName(request.getName()).orElse(null);
        if (existingCategory != null) {
            return mapToCategoryResponse(existingCategory);
        }

        Category category = Category.builder()
                .name(request.getName())
                .description(request.getDescription())
                .build();

        Category saved = categoryRepository.save(category);
        return mapToCategoryResponse(saved);
    }

    @Transactional
    public CategoryResponse createOrGetCategory(String name) {
        return categoryRepository.findByName(name)
                .map(this::mapToCategoryResponse)
                .orElseGet(() -> {
                    Category newCategory = Category.builder()
                            .name(name)
                            .description(null)
                            .build();
                    Category saved = categoryRepository.save(newCategory);
                    return mapToCategoryResponse(saved);
                });
    }

    @Transactional
    public void deleteCategory(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));

        // Проверяем, есть ли приборы с этой категорией
        if (category.getAppliances() != null && !category.getAppliances().isEmpty()) {
            throw new RuntimeException("Нельзя удалить категорию, так как существуют приборы с этой категорией");
        }

        categoryRepository.delete(category);
    }

    private CategoryResponse mapToCategoryResponse(Category category) {
        return CategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .description(category.getDescription())
                .build();
    }
}

