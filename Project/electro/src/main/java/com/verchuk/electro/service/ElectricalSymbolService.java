package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.ElectricalSymbolRequest;
import com.verchuk.electro.dto.response.ElectricalSymbolResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.ElectricalSymbol;
import com.verchuk.electro.repository.ElectricalSymbolRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ElectricalSymbolService {
    @Autowired
    private ElectricalSymbolRepository electricalSymbolRepository;

    public List<ElectricalSymbolResponse> getAllSymbols() {
        List<ElectricalSymbol> symbols = electricalSymbolRepository.findByActiveTrue();
        return symbols.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<ElectricalSymbolResponse> getSymbolsByType(String type) {
        List<ElectricalSymbol> symbols = electricalSymbolRepository.findByType(type);
        return symbols.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<ElectricalSymbolResponse> getSymbolsByCategory(String category) {
        List<ElectricalSymbol> symbols = electricalSymbolRepository.findByCategory(category);
        return symbols.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public ElectricalSymbolResponse getSymbolById(Long id) {
        ElectricalSymbol symbol = electricalSymbolRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ElectricalSymbol", "id", id));
        return mapToResponse(symbol);
    }

    @Transactional
    public ElectricalSymbolResponse createSymbol(ElectricalSymbolRequest request) {
        ElectricalSymbol symbol = ElectricalSymbol.builder()
                .name(request.getName())
                .svgPath(request.getSvgPath())
                .type(request.getType())
                .category(request.getCategory())
                .defaultWidth(request.getDefaultWidth() != null ? request.getDefaultWidth() : 20.0)
                .defaultHeight(request.getDefaultHeight() != null ? request.getDefaultHeight() : 20.0)
                .price(request.getPrice())
                .model(request.getModel())
                .ipRating(request.getIpRating())
                .color(request.getColor())
                .active(request.getActive() != null ? request.getActive() : true)
                .build();

        symbol = electricalSymbolRepository.save(symbol);
        return mapToResponse(symbol);
    }

    @Transactional
    public ElectricalSymbolResponse updateSymbol(Long id, ElectricalSymbolRequest request) {
        ElectricalSymbol symbol = electricalSymbolRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ElectricalSymbol", "id", id));

        if (request.getName() != null) {
            symbol.setName(request.getName());
        }
        if (request.getSvgPath() != null) {
            symbol.setSvgPath(request.getSvgPath());
        }
        if (request.getType() != null) {
            symbol.setType(request.getType());
        }
        if (request.getCategory() != null) {
            symbol.setCategory(request.getCategory());
        }
        if (request.getDefaultWidth() != null) {
            symbol.setDefaultWidth(request.getDefaultWidth());
        }
        if (request.getDefaultHeight() != null) {
            symbol.setDefaultHeight(request.getDefaultHeight());
        }
        if (request.getPrice() != null) {
            symbol.setPrice(request.getPrice());
        }
        if (request.getModel() != null) {
            symbol.setModel(request.getModel());
        }
        if (request.getIpRating() != null) {
            symbol.setIpRating(request.getIpRating());
        }
        if (request.getColor() != null) {
            symbol.setColor(request.getColor());
        }
        if (request.getActive() != null) {
            symbol.setActive(request.getActive());
        }

        symbol = electricalSymbolRepository.save(symbol);
        return mapToResponse(symbol);
    }

    @Transactional
    public void deleteSymbol(Long id) {
        ElectricalSymbol symbol = electricalSymbolRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ElectricalSymbol", "id", id));
        electricalSymbolRepository.delete(symbol);
    }

    private ElectricalSymbolResponse mapToResponse(ElectricalSymbol symbol) {
        return ElectricalSymbolResponse.builder()
                .id(symbol.getId())
                .name(symbol.getName())
                .svgPath(symbol.getSvgPath())
                .type(symbol.getType())
                .category(symbol.getCategory())
                .defaultWidth(symbol.getDefaultWidth())
                .defaultHeight(symbol.getDefaultHeight())
                .price(symbol.getPrice())
                .model(symbol.getModel())
                .ipRating(symbol.getIpRating())
                .color(symbol.getColor())
                .active(symbol.getActive())
                .build();
    }
}

