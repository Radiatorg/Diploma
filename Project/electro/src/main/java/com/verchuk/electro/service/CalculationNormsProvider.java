package com.verchuk.electro.service;

import java.math.BigDecimal;
import java.util.OptionalInt;

public interface CalculationNormsProvider {
    BigDecimal determineDemandFactor(BigDecimal installedPowerW);
    OptionalInt selectMainCircuitBreaker(BigDecimal designCurrentA);
}
