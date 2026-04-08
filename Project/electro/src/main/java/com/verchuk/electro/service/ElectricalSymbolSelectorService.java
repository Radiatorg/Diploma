package com.verchuk.electro.service;

import com.verchuk.electro.model.ElectricalSymbol;
import com.verchuk.electro.model.Room;
import com.verchuk.electro.model.RoomType;
import com.verchuk.electro.repository.ElectricalSymbolRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Сервис для автоматического выбора электрических символов
 * на основе требований ТКП 339-2022
 */
@Service
public class ElectricalSymbolSelectorService {
    
    @Autowired
    private ElectricalSymbolRepository electricalSymbolRepository;
    
    /**
     * Автоматический выбор электрического символа на основе требований ТКП 339
     * @param symbolType Тип символа: "outlet", "switch", "light"
     * @param room Комната, в которой размещается символ
     * @param powerConsumption Потребляемая мощность в Вт (для розеток и светильников)
     * @param distanceFromBath Расстояние от ванны в см (для ванных комнат)
     * @return Выбранный символ или null
     */
    public ElectricalSymbol selectBestSymbol(String symbolType, Room room, 
                                             BigDecimal powerConsumption, 
                                             BigDecimal distanceFromBath) {
        if (symbolType == null || symbolType.isEmpty()) {
            throw new IllegalArgumentException("Тип символа не может быть пустым");
        }
        
        // Получаем все активные символы нужного типа
        List<ElectricalSymbol> availableSymbols = electricalSymbolRepository.findByTypeAndActiveTrue(symbolType);
        if (availableSymbols.isEmpty()) {
            throw new com.verchuk.electro.exception.ResourceNotFoundException(
                "ElectricalSymbol", 
                "type", 
                symbolType + " (в базе данных нет активных символов этого типа. Обратитесь к администратору.)"
            );
        }
        
        String roomTypeName = "";
        if (room != null && room.getRoomType() != null) {
            roomTypeName = room.getRoomType().getName() != null 
                ? room.getRoomType().getName().toLowerCase() 
                : "";
        }
        
        // Определяем требования ТКП 339
        String requiredIPRating = getRequiredIPRating(symbolType, roomTypeName, distanceFromBath);
        Integer requiredRating = null;
        
        if ("outlet".equals(symbolType) && powerConsumption != null) {
            requiredRating = selectOutletRating(powerConsumption);
        }
        
        // Если IP-рейтинг не требуется (запрещено), возвращаем null
        if (requiredIPRating == null && (roomTypeName.contains("ванн") || roomTypeName.contains("душ"))) {
            return null;
        }
        
        // Создаем final копии для использования в лямбда-выражении
        final String finalSymbolType = symbolType;
        final String finalRequiredIPRating = requiredIPRating;
        final Integer finalRequiredRating = requiredRating;
        
        // Сортируем символы по приоритету
        List<ScoredSymbol> scoredSymbols = availableSymbols.stream()
            .map(symbol -> {
                int score = 0;
                
                // Проверка IP-рейтинга
                if (symbol.getIpRating() != null && finalRequiredIPRating != null) {
                    IPRating symbolIP = parseIPRating(symbol.getIpRating());
                    IPRating requiredIP = parseIPRating(finalRequiredIPRating);
                    
                    if (symbolIP.first >= requiredIP.first && symbolIP.second >= requiredIP.second) {
                        score += 100; // Полное соответствие
                        if (symbolIP.first == requiredIP.first && symbolIP.second == requiredIP.second) {
                            score += 50; // Точное совпадение
                        }
                    } else {
                        score -= 1000; // Не соответствует требованиям
                    }
                } else if (finalRequiredIPRating == null) {
                    score += 10; // IP не требуется
                }
                
                // Для розеток проверяем номинал
                if ("outlet".equals(finalSymbolType) && finalRequiredRating != null) {
                    Integer symbolRating = extractRatingFromName(symbol.getName());
                    if (symbolRating != null) {
                        if (symbolRating >= finalRequiredRating) {
                            score += 50;
                            if (symbolRating.equals(finalRequiredRating)) {
                                score += 25; // Точное совпадение
                            }
                        } else {
                            score -= 500; // Номинал меньше требуемого
                        }
                    }
                }
                
                // Бонус за наличие цены (важно для сметы)
                if (symbol.getPrice() != null && symbol.getPrice().compareTo(BigDecimal.ZERO) > 0) {
                    score += 10;
                }
                
                // Бонус за наличие модели
                if (symbol.getModel() != null && !symbol.getModel().isEmpty()) {
                    score += 5;
                }
                
                return new ScoredSymbol(symbol, score);
            })
            .filter(item -> item.score > 0) // Убираем несоответствующие
            .sorted((a, b) -> Integer.compare(b.score, a.score)) // Сортируем по убыванию score
            .collect(Collectors.toList());
        
        // Возвращаем символ с наивысшим score
        if (!scoredSymbols.isEmpty()) {
            return scoredSymbols.get(0).symbol;
        }
        
        // Если ничего не подошло по требованиям, но есть символы - возвращаем первый
        // Это может быть, если требования слишком строгие, но лучше что-то выбрать, чем ничего
        if (!availableSymbols.isEmpty()) {
            return availableSymbols.get(0);
        }
        
        // Если вообще нет символов - выбрасываем исключение
        String roomInfo = room != null && room.getRoomType() != null 
            ? " для помещения типа '" + room.getRoomType().getName() + "'"
            : "";
        throw new com.verchuk.electro.exception.ResourceNotFoundException(
            "ElectricalSymbol",
            "requirements",
            String.format("Не найдено символов типа '%s'%s, соответствующих требованиям ТКП 339. " +
                        "Требуется IP-рейтинг: %s. Обратитесь к администратору для добавления подходящих символов.",
                        symbolType, roomInfo, requiredIPRating != null ? requiredIPRating : "не определен")
        );
    }
    
    /**
     * Определение требуемого IP-рейтинга для розеток (п. 8.5.5, 8.5.6)
     */
    private String getRequiredIPRating(String symbolType, String roomTypeName, BigDecimal distanceFromBath) {
        if (roomTypeName == null || roomTypeName.isEmpty()) {
            return "IP20"; // По умолчанию для сухих помещений
        }
        
        boolean isBathroom = roomTypeName.contains("ванн") || roomTypeName.contains("душ");
        
        if ("outlet".equals(symbolType)) {
            if (isBathroom) {
                if (distanceFromBath != null) {
                    double distance = distanceFromBath.doubleValue();
                    if (distance <= 60) {
                        return null; // Розетки запрещены в зонах 0, 1, 2
                    } else if (distance <= 240) {
                        return "IP44"; // Зона 3
                    }
                }
                return "IP44"; // По умолчанию для ванных (зона 3)
            }
            
            if (roomTypeName.contains("балкон") || roomTypeName.contains("лоджия")) {
                return "IP54"; // Наружные установки
            }
            
            if (roomTypeName.contains("кухн")) {
                return "IP44"; // Рекомендуется для кухонь
            }
            
            return "IP20"; // Сухие помещения
        }
        
        if ("switch".equals(symbolType)) {
            if (isBathroom) {
                if (distanceFromBath != null && distanceFromBath.doubleValue() <= 60) {
                    return null; // Запрещены в зонах 0, 1, 2
                }
                return "IP44"; // Для зоны 3
            }
            
            if (roomTypeName.contains("балкон") || roomTypeName.contains("лоджия")) {
                return "IP54";
            }
            
            return "IP20";
        }
        
        if ("light".equals(symbolType)) {
            if (isBathroom) {
                if (distanceFromBath != null && distanceFromBath.doubleValue() <= 60) {
                    return "IP44"; // Зона 2 - светильники класса защиты 2
                }
                return "IP44";
            }
            
            if (roomTypeName.contains("кухн")) {
                return "IP44"; // Защита от брызг (п. 8.5.4)
            }
            
            if (roomTypeName.contains("балкон") || roomTypeName.contains("лоджия")) {
                return "IP54";
            }
            
            return "IP20";
        }
        
        return "IP20";
    }
    
    /**
     * Выбор номинала розетки на основе нагрузки (п. 8.5.8)
     */
    private Integer selectOutletRating(BigDecimal powerConsumption) {
        if (powerConsumption == null || powerConsumption.compareTo(BigDecimal.ZERO) <= 0) {
            return 16; // Стандарт для розеток
        }
        
        // Напряжение 230В
        BigDecimal voltage = BigDecimal.valueOf(230);
        BigDecimal current = powerConsumption.divide(voltage, 2, java.math.RoundingMode.UP);
        double currentValue = current.doubleValue();
        
        // Стандартные номиналы розеток
        if (currentValue <= 10) {
            return 10; // Минимум по п. 8.5.8
        } else if (currentValue <= 16) {
            return 16; // Стандарт для бытовых розеток
        } else if (currentValue <= 20) {
            return 20; // Для более мощных приборов
        } else {
            return 25; // Для специальных случаев
        }
    }
    
    /**
     * Парсинг IP-рейтинга (например, "IP44" -> { first: 4, second: 4 })
     */
    private IPRating parseIPRating(String ipRating) {
        if (ipRating == null || ipRating.isEmpty()) {
            return new IPRating(0, 0);
        }
        
        String upper = ipRating.toUpperCase();
        if (!upper.startsWith("IP")) {
            return new IPRating(0, 0);
        }
        
        String digits = upper.substring(2);
        if (digits.length() < 2) {
            return new IPRating(0, 0);
        }
        
        try {
            int first = digits.charAt(0) == 'X' ? 0 : Character.getNumericValue(digits.charAt(0));
            int second = digits.charAt(1) == 'X' ? 0 : Character.getNumericValue(digits.charAt(1));
            return new IPRating(first, second);
        } catch (Exception e) {
            return new IPRating(0, 0);
        }
    }
    
    /**
     * Извлечение номинала из названия (например, "Розетка 16А" -> 16)
     */
    private Integer extractRatingFromName(String name) {
        if (name == null || name.isEmpty()) {
            return null;
        }
        
        // Ищем паттерн типа "16А", "16 A", "16A"
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("(\\d+)\\s*[АA]");
        java.util.regex.Matcher matcher = pattern.matcher(name);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        
        return null;
    }
    
    /**
     * Вспомогательный класс для хранения IP-рейтинга
     */
    private static class IPRating {
        int first;
        int second;
        
        IPRating(int first, int second) {
            this.first = first;
            this.second = second;
        }
    }
    
    /**
     * Вспомогательный класс для хранения символа с оценкой
     */
    private static class ScoredSymbol {
        ElectricalSymbol symbol;
        int score;
        
        ScoredSymbol(ElectricalSymbol symbol, int score) {
            this.symbol = symbol;
            this.score = score;
        }
    }
}

