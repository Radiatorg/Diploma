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

import java.util.List;
import java.util.stream.Collectors;

@Service
public class RoomTypeService {
    @Autowired
    private RoomTypeRepository roomTypeRepository;
    
    @Autowired
    private com.verchuk.electro.repository.RoomRepository roomRepository;

    public List<RoomTypeResponse> getAllRoomTypes() {
        return roomTypeRepository.findAll().stream()
                .map(this::mapToRoomTypeResponse)
                .collect(Collectors.toList());
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
}

