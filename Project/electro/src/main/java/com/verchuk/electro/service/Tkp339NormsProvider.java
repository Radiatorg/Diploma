package com.verchuk.electro.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.OptionalInt;

@Service
public class Tkp339NormsProvider implements CalculationNormsProvider {
    private static final int[] MAIN_BREAKER_RATINGS = {25, 32, 40, 50, 63};

    @Override
    public BigDecimal determineDemandFactor(BigDecimal installedPowerW) {
        BigDecimal threshold = BigDecimal.valueOf(14000); // 14 кВт
        if (installedPowerW == null) {
            return BigDecimal.valueOf(0.8);
        }
        return installedPowerW.compareTo(threshold) < 0
                ? BigDecimal.valueOf(0.8)
                : BigDecimal.valueOf(0.6);
    }

    @Override
    public OptionalInt selectMainCircuitBreaker(BigDecimal designCurrentA) {
        if (designCurrentA == null) {
            return OptionalInt.empty();
        }
        double current = designCurrentA.doubleValue();
        for (int rating : MAIN_BREAKER_RATINGS) {
            if (rating >= current) {
                return OptionalInt.of(rating);
            }
        }
        return OptionalInt.of(MAIN_BREAKER_RATINGS[MAIN_BREAKER_RATINGS.length - 1]);
    }
}
