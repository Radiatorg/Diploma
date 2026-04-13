package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.RoomTypeRequest;
import com.verchuk.electro.dto.response.RoomTypeResponse;
import com.verchuk.electro.exception.BadRequestException;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.RoomType;
import com.verchuk.electro.repository.RoomTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class RoomTypeService {
    @Autowired
    private RoomTypeRepository roomTypeRepository;
    
    @Autowired
    private com.verchuk.electro.repository.RoomRepository roomRepository;

    public List<RoomTypeResponse> getAllRoomTypes() {
        return getAllRoomTypes(Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty())
                .getRoomTypes();
    }

    public RoomTypeQueryResult getAllRoomTypes(Optional<String> search,
                                               Optional<String> sortBy,
                                               Optional<String> sortDir,
                                               Optional<Integer> page,
                                               Optional<Integer> size) {
        Comparator<RoomType> comparator = buildComparator(sortBy.orElse("id"));
        if ("desc".equalsIgnoreCase(sortDir.orElse("asc"))) {
            comparator = comparator.reversed();
        }

        List<RoomType> filteredAndSorted = roomTypeRepository.findAll().stream()
                .filter(roomType -> search.map(q -> matchesSearch(roomType, q)).orElse(true))
                .sorted(comparator)
                .collect(Collectors.toList());

        long totalItems = filteredAndSorted.size();
        List<RoomType> paginated = paginateRoomTypes(filteredAndSorted, page, size);

        List<RoomTypeResponse> result = paginated.stream()
                .map(this::mapToRoomTypeResponse)
                .collect(Collectors.toList());
        return new RoomTypeQueryResult(result, totalItems);
    }

    public RoomTypeResponse getRoomTypeById(Long id) {
        RoomType roomType = roomTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", id));
        return mapToRoomTypeResponse(roomType);
    }

    @Transactional
    public RoomTypeResponse createRoomType(RoomTypeRequest request) {
        if (roomTypeRepository.existsByName(request.getName())) {
            throw new BadRequestException("Room type with this name already exists");
        }

        // Валидация коэффициентов
        validateCoefficients(request.getMinCoefficient(), request.getMaxCoefficient());

        RoomType roomType = RoomType.builder()
                .name(request.getName())
                .description(request.getDescription())
                .minCoefficient(request.getMinCoefficient())
                .maxCoefficient(request.getMaxCoefficient())
                .build();

        return mapToRoomTypeResponse(roomTypeRepository.save(roomType));
    }

    @Transactional
    public RoomTypeResponse updateRoomType(Long id, RoomTypeRequest request) {
        RoomType roomType = roomTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", id));

        if (!roomType.getName().equals(request.getName()) && roomTypeRepository.existsByName(request.getName())) {
            throw new BadRequestException("Room type with this name already exists");
        }

        // Валидация коэффициентов
        validateCoefficients(request.getMinCoefficient(), request.getMaxCoefficient());

        roomType.setName(request.getName());
        roomType.setDescription(request.getDescription());
        roomType.setMinCoefficient(request.getMinCoefficient());
        roomType.setMaxCoefficient(request.getMaxCoefficient());

        return mapToRoomTypeResponse(roomTypeRepository.save(roomType));
    }

    /**
     * Валидация коэффициентов мощности помещения.
     * Проверяет, что минимальный коэффициент больше 0,
     * и что максимальный коэффициент (если задан) больше минимального (не может быть равен).
     */
    private void validateCoefficients(java.math.BigDecimal minCoefficient, java.math.BigDecimal maxCoefficient) {
        if (minCoefficient == null || minCoefficient.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Minimum coefficient must be greater than 0");
        }

        if (maxCoefficient != null) {
            if (maxCoefficient.compareTo(java.math.BigDecimal.ZERO) <= 0) {
                throw new BadRequestException("Maximum coefficient must be greater than 0");
            }
            if (maxCoefficient.compareTo(minCoefficient) <= 0) {
                throw new BadRequestException("Maximum coefficient must be greater than minimum coefficient");
            }
        }
    }

    @Transactional
    public void deleteRoomType(Long id) {
        RoomType roomType = roomTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", id));
        
        // Проверяем, используется ли тип комнаты в помещениях
        long usageCount = roomRepository.countByRoomTypeId(id);
        if (usageCount > 0) {
            throw new BadRequestException(
                "Нельзя удалить тип помещения, так как помещения такого типа уже используются пользователями. " +
                "Тип используется в " + usageCount + " помещении(ях)."
            );
        }
        
        roomTypeRepository.delete(roomType);
    }

    private RoomTypeResponse mapToRoomTypeResponse(RoomType roomType) {
        return RoomTypeResponse.builder()
                .id(roomType.getId())
                .name(roomType.getName())
                .description(roomType.getDescription())
                .minCoefficient(roomType.getMinCoefficient())
                .maxCoefficient(roomType.getMaxCoefficient())
                .effectiveCoefficient(roomType.getEffectiveCoefficient())
                .build();
    }

    private Comparator<RoomType> buildComparator(String sortBy) {
        return switch (sortBy) {
            case "id" -> Comparator.comparing(RoomType::getId, nullSafeComparableComparator());
            case "name" -> Comparator.comparing(RoomType::getName, nullSafeStringComparator());
            case "description" -> Comparator.comparing(RoomType::getDescription, nullSafeStringComparator());
            case "minCoefficient" -> Comparator.comparing(RoomType::getMinCoefficient, nullSafeComparableComparator());
            case "maxCoefficient" -> Comparator.comparing(RoomType::getMaxCoefficient, nullSafeComparableComparator());
            case "effectiveCoefficient" -> Comparator.comparing(RoomType::getEffectiveCoefficient, nullSafeComparableComparator());
            default -> Comparator.comparing(RoomType::getId, nullSafeComparableComparator());
        };
    }

    private boolean matchesSearch(RoomType roomType, String queryValue) {
        String query = queryValue == null ? "" : queryValue.trim().toLowerCase();
        if (query.isEmpty()) {
            return true;
        }

        return containsIgnoreCase(roomType.getName(), query)
                || containsIgnoreCase(roomType.getDescription(), query)
                || String.valueOf(roomType.getId()).contains(query)
                || stringValue(roomType.getMinCoefficient()).contains(query)
                || stringValue(roomType.getMaxCoefficient()).contains(query)
                || stringValue(roomType.getEffectiveCoefficient()).contains(query);
    }

    private String stringValue(Object value) {
        return value == null ? "" : value.toString().toLowerCase();
    }

    private boolean containsIgnoreCase(String value, String query) {
        return value != null && value.toLowerCase().contains(query);
    }

    private List<RoomType> paginateRoomTypes(List<RoomType> roomTypes, Optional<Integer> page, Optional<Integer> size) {
        if (page.isEmpty() && size.isEmpty()) {
            return roomTypes;
        }

        int safePage = Math.max(0, page.orElse(0));
        int safeSize = size.orElse(20);
        if (safeSize <= 0) {
            safeSize = 20;
        }

        int fromIndex = safePage * safeSize;
        if (fromIndex >= roomTypes.size()) {
            return List.of();
        }

        int toIndex = Math.min(fromIndex + safeSize, roomTypes.size());
        return roomTypes.subList(fromIndex, toIndex);
    }

    private Comparator<String> nullSafeStringComparator() {
        return Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER);
    }

    private <T extends Comparable<? super T>> Comparator<T> nullSafeComparableComparator() {
        return Comparator.nullsLast(Comparator.naturalOrder());
    }

    public static class RoomTypeQueryResult {
        private final List<RoomTypeResponse> roomTypes;
        private final long totalItems;

        public RoomTypeQueryResult(List<RoomTypeResponse> roomTypes, long totalItems) {
            this.roomTypes = roomTypes;
            this.totalItems = totalItems;
        }

        public List<RoomTypeResponse> getRoomTypes() {
            return roomTypes;
        }

        public long getTotalItems() {
            return totalItems;
        }
    }
}

