package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.CableTypeRequest;
import com.verchuk.electro.dto.response.CableTypeResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.CableType;
import com.verchuk.electro.repository.CableTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CableTypeService {
    @Autowired
    private CableTypeRepository cableTypeRepository;

    public List<CableTypeResponse> getActiveCableTypes() {
        return cableTypeRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<CableTypeResponse> getAllCableTypes() {
        return cableTypeRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public CableTypeResponse createCableType(CableTypeRequest request) {
        CableType cableType = CableType.builder()
                .name(request.getName().trim())
                .material(request.getMaterial().trim())
                .crossSectionMm2(request.getCrossSectionMm2())
                .manufacturer(request.getManufacturer() != null ? request.getManufacturer().trim() : null)
                .pricePerMeter(request.getPricePerMeter())
                .active(request.getActive() != null ? request.getActive() : true)
                .build();
        return mapToResponse(cableTypeRepository.save(cableType));
    }

    @Transactional
    public CableTypeResponse updateCableType(Long id, CableTypeRequest request) {
        CableType cableType = cableTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CableType", "id", id));

        cableType.setName(request.getName().trim());
        cableType.setMaterial(request.getMaterial().trim());
        cableType.setCrossSectionMm2(request.getCrossSectionMm2());
        cableType.setManufacturer(request.getManufacturer() != null ? request.getManufacturer().trim() : null);
        cableType.setPricePerMeter(request.getPricePerMeter());
        if (request.getActive() != null) {
            cableType.setActive(request.getActive());
        }

        return mapToResponse(cableTypeRepository.save(cableType));
    }

    @Transactional
    public void deleteCableType(Long id) {
        CableType cableType = cableTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CableType", "id", id));
        cableTypeRepository.delete(cableType);
    }

    private CableTypeResponse mapToResponse(CableType cableType) {
        return CableTypeResponse.builder()
                .id(cableType.getId())
                .name(cableType.getName())
                .material(cableType.getMaterial())
                .crossSectionMm2(cableType.getCrossSectionMm2())
                .manufacturer(cableType.getManufacturer())
                .pricePerMeter(cableType.getPricePerMeter())
                .active(cableType.getActive())
                .build();
    }
}
