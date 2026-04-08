package com.verchuk.electro.service;

import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import com.itextpdf.html2pdf.resolver.font.DefaultFontProvider;
import com.itextpdf.layout.font.FontProvider;
import com.verchuk.electro.dto.response.CalculationReportResponse;
import com.verchuk.electro.dto.response.FinancialCalculationLineResponse;
import com.verchuk.electro.dto.response.RoomCableTypeLengthResponse;
import com.verchuk.electro.dto.response.RoomCalculationResponse;
import com.verchuk.electro.dto.response.EquipmentItemResponse;
import com.verchuk.electro.dto.response.SpecificationResponse;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Project;
import com.verchuk.electro.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PdfExportService {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private SpecificationService specificationService;

    @Autowired
    private CalculationService calculationService;

    private final NumberFormat numberFormat = NumberFormat.getNumberInstance(new Locale("ru", "RU"));

    public byte[] generateSpecificationPdf(Long projectId) {
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        SpecificationResponse spec = specificationService.getSpecification(projectId);
        CalculationReportResponse calc = calculationService.getCalculationReport(projectId);

        String html = generateSpecificationHtml(project, spec, calc);
        return convertHtmlToPdf(html);
    }

    public byte[] generateCalculationPdf(Long projectId) {
        var currentUser = userService.getCurrentUser();
        Project project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        CalculationReportResponse calc = calculationService.getCalculationReport(projectId);

        String html = generateCalculationHtml(project, calc);
        return convertHtmlToPdf(html);
    }

    private String generateSpecificationHtml(Project project, SpecificationResponse spec, CalculationReportResponse calc) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head>");
        html.append("<meta charset='UTF-8'>");
        html.append("<style>");
        html.append("body { font-family: Arial, sans-serif; margin: 20px; color: #333; }");
        html.append("h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }");
        html.append("h2 { color: #34495e; margin-top: 30px; }");
        html.append("table { width: 100%; border-collapse: collapse; margin: 20px 0; }");
        html.append("th { background: #3498db; color: white; padding: 12px; text-align: left; }");
        html.append("td { padding: 10px; border: 1px solid #ddd; }");
        html.append("tr:nth-child(even) { background: #f8f9fa; }");
        html.append(".summary { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }");
        html.append(".total { font-size: 18px; font-weight: bold; color: #27ae60; }");
        html.append(".header-info { margin: 20px 0; }");
        html.append(".footer { margin-top: 40px; font-size: 12px; color: #7f8c8d; text-align: center; }");
        html.append("</style></head><body>");

        html.append("<h1>Смета электротехнического оборудования</h1>");
        html.append("<div class='header-info'>");
        html.append("<p><strong>Проект:</strong> ").append(escapeHtml(project.getName())).append("</p>");
        html.append("<p><strong>Дата формирования:</strong> ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"))).append("</p>");
        html.append("</div>");

        // Группировка по категориям
        Map<String, java.util.List<EquipmentItemResponse>> grouped = spec.getEquipmentItems().stream()
                .collect(Collectors.groupingBy(item -> item.getCategory() != null ? item.getCategory() : "Другое"));

        for (Map.Entry<String, java.util.List<EquipmentItemResponse>> entry : grouped.entrySet()) {
            html.append("<h2>").append(escapeHtml(entry.getKey())).append("</h2>");
            html.append("<table>");
            html.append("<thead><tr>");
            html.append("<th>Наименование</th>");
            html.append("<th>Характеристики</th>");
            html.append("<th>Количество</th>");
            html.append("<th>Ед. изм.</th>");
            html.append("<th>Цена за ед., BYN</th>");
            html.append("<th>Сумма, BYN</th>");
            html.append("</tr></thead><tbody>");

            BigDecimal categoryTotal = BigDecimal.ZERO;
            for (EquipmentItemResponse item : entry.getValue()) {
                html.append("<tr>");
                html.append("<td>").append(escapeHtml(item.getName())).append("</td>");
                html.append("<td>").append(escapeHtml(item.getSpecification() != null ? item.getSpecification() : "-")).append("</td>");
                html.append("<td>").append(item.getQuantity()).append("</td>");
                html.append("<td>").append(escapeHtml(item.getUnit())).append("</td>");
                html.append("<td>").append(formatPrice(item.getUnitPrice())).append("</td>");
                html.append("<td>").append(formatPrice(item.getTotalPrice())).append("</td>");
                html.append("</tr>");
                if (item.getTotalPrice() != null) {
                    categoryTotal = categoryTotal.add(item.getTotalPrice());
                }
            }

            html.append("<tr style='background: #e8f5e9; font-weight: bold;'>");
            html.append("<td colspan='5' style='text-align: right;'>Итого по категории:</td>");
            html.append("<td>").append(formatPrice(categoryTotal)).append(" BYN</td>");
            html.append("</tr>");
            html.append("</tbody></table>");
        }

        html.append("<div class='summary'>");
        html.append("<h2>Итоговая стоимость</h2>");
        html.append("<p class='total'>Общая стоимость оборудования: ").append(formatPrice(spec.getTotalEquipmentCost())).append(" BYN</p>");
        if (spec.getExistingEquipmentCost() != null) {
            html.append("<p><strong>Существующее оборудование:</strong> ").append(formatPrice(spec.getExistingEquipmentCost())).append(" BYN</p>");
        }
        if (spec.getPlannedEquipmentCost() != null) {
            html.append("<p><strong>Планируемое оборудование:</strong> ").append(formatPrice(spec.getPlannedEquipmentCost())).append(" BYN</p>");
        }
        if (spec.getExistingItemsCount() != null || spec.getPlannedItemsCount() != null) {
            html.append("<p><strong>Точки (существующие/планируемые):</strong> ")
                    .append(spec.getExistingItemsCount() != null ? spec.getExistingItemsCount() : 0)
                    .append(" / ")
                    .append(spec.getPlannedItemsCount() != null ? spec.getPlannedItemsCount() : 0)
                    .append("</p>");
        }
        if (calc.getTotalProjectCost() != null) {
            html.append("<p><strong>Общая стоимость проекта:</strong> ").append(formatPrice(calc.getTotalProjectCost())).append(" BYN</p>");
        }
        html.append("</div>");

        if (spec.getCircuitSummaries() != null && !spec.getCircuitSummaries().isEmpty()) {
            html.append("<h2>Сводка по линиям</h2>");
            html.append("<table>");
            html.append("<thead><tr>");
            html.append("<th>Линия</th><th>Область</th><th>Точек</th><th>Длина кабеля, м</th><th>Стоимость кабеля, BYN</th>");
            html.append("</tr></thead><tbody>");
            for (var summary : spec.getCircuitSummaries()) {
                html.append("<tr>");
                html.append("<td>").append(escapeHtml(summary.getCircuitName())).append("</td>");
                html.append("<td>").append(summary.getInstallationScope() != null && summary.getInstallationScope().name().equals("EXISTING") ? "Существующее" : "Планируемое").append("</td>");
                html.append("<td>").append(summary.getPointsCount() != null ? summary.getPointsCount() : 0).append("</td>");
                html.append("<td>").append(summary.getCableLengthM() != null ? summary.getCableLengthM().setScale(2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO).append("</td>");
                html.append("<td>").append(formatPrice(summary.getCableCost())).append("</td>");
                html.append("</tr>");
            }
            html.append("</tbody></table>");
        }

        if (spec.getRecommendations() != null && !spec.getRecommendations().isEmpty()) {
            html.append("<h2>Рекомендации</h2>");
            html.append("<div style='background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107;'>");
            html.append("<pre style='white-space: pre-wrap; font-family: Arial;'>").append(escapeHtml(spec.getRecommendations())).append("</pre>");
            html.append("</div>");
        }

        html.append("<div class='footer'>");
        html.append("<p>Документ сформирован автоматически системой планирования электросети</p>");
        html.append("</div>");

        html.append("</body></html>");
        return html.toString();
    }

    private String generateCalculationHtml(Project project, CalculationReportResponse calc) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head>");
        html.append("<meta charset='UTF-8'>");
        html.append("<style>");
        html.append("body { font-family: Arial, sans-serif; margin: 20px; color: #333; }");
        html.append("h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }");
        html.append("h2 { color: #34495e; margin-top: 30px; }");
        html.append("table { width: 100%; border-collapse: collapse; margin: 20px 0; }");
        html.append("th { background: #3498db; color: white; padding: 12px; text-align: left; }");
        html.append("td { padding: 10px; border: 1px solid #ddd; }");
        html.append("tr:nth-child(even) { background: #f8f9fa; }");
        html.append(".summary-card { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }");
        html.append(".highlight { background: #e3f2fd !important; font-weight: bold; }");
        html.append(".header-info { margin: 20px 0; }");
        html.append(".footer { margin-top: 40px; font-size: 12px; color: #7f8c8d; text-align: center; }");
        html.append("</style></head><body>");

        html.append("<h1>Расчетная ведомость нагрузки</h1>");
        html.append("<div class='header-info'>");
        html.append("<p><strong>Проект:</strong> ").append(escapeHtml(project.getName())).append("</p>");
        html.append("<p><strong>Дата формирования:</strong> ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"))).append("</p>");
        html.append("</div>");

        html.append("<div class='summary-card'>");
        html.append("<h2>Основные параметры</h2>");
        html.append("<table>");
        html.append("<tr><td><strong>Установленная мощность</strong></td><td>").append(formatPower(calc.getTotalPowerConsumption())).append("</td></tr>");
        if (calc.getExistingPower() != null) {
            html.append("<tr><td><strong>Существующая мощность</strong></td><td>").append(formatPower(calc.getExistingPower())).append("</td></tr>");
        }
        if (calc.getPlannedPower() != null) {
            html.append("<tr><td><strong>Планируемая мощность</strong></td><td>").append(formatPower(calc.getPlannedPower())).append("</td></tr>");
        }
        if (calc.getInstalledPower() != null) {
            html.append("<tr><td><strong>Установленная мощность (с коэффициентами)</strong></td><td>").append(formatPower(calc.getInstalledPower())).append("</td></tr>");
        }
        if (calc.getDemandFactor() != null) {
            html.append("<tr><td><strong>Коэффициент спроса (Kc)</strong></td><td>").append(calc.getDemandFactor().multiply(BigDecimal.valueOf(100)).setScale(0, java.math.RoundingMode.HALF_UP)).append("%</td></tr>");
        }
        if (calc.getDesignPower() != null) {
            html.append("<tr><td><strong>Расчетная мощность</strong></td><td>").append(formatPower(calc.getDesignPower())).append("</td></tr>");
        }
        html.append("<tr><td><strong>Расчетный ток</strong></td><td>").append(formatCurrent(calc.getTotalCurrent())).append("</td></tr>");
        if (calc.getExistingPointsCount() != null || calc.getPlannedPointsCount() != null) {
            html.append("<tr><td><strong>Точки (существующие/планируемые)</strong></td><td>")
                    .append(calc.getExistingPointsCount() != null ? calc.getExistingPointsCount() : 0)
                    .append(" / ")
                    .append(calc.getPlannedPointsCount() != null ? calc.getPlannedPointsCount() : 0)
                    .append("</td></tr>");
        }
        html.append("<tr class='highlight'><td><strong>Главный автоматический выключатель</strong></td><td>");
        if (calc.getMainCircuitBreaker() != null) {
            html.append(calc.getMainCircuitBreaker()).append(" А");
        } else if (calc.getRecommendedCircuitBreakerRating() != null) {
            html.append(calc.getRecommendedCircuitBreakerRating()).append(" А");
        } else {
            html.append("-");
        }
        html.append("</td></tr>");
        html.append("</table>");
        html.append("</div>");

        if (calc.getRecommendedCableCrossSection() != null) {
            html.append("<div class='summary-card'>");
            html.append("<h2>Рекомендации по кабелю</h2>");
            html.append("<p><strong>Сечение кабеля:</strong> ").append(escapeHtml(calc.getRecommendedCableCrossSection())).append("</p>");
            if (calc.getRecommendedRcdRating() != null) {
                html.append("<p><strong>Номинал УЗО:</strong> ").append(calc.getRecommendedRcdRating()).append(" мА</p>");
            }
            html.append("</div>");
        }

        if (calc.getProjectCableByType() != null && !calc.getProjectCableByType().isEmpty()) {
            html.append("<div class='summary-card'>");
            html.append("<h2>Кабель по проекту (по трассам)</h2>");
            html.append("<table><thead><tr><th>Тип кабеля</th><th>Сечение, мм²</th><th>Длина, м</th></tr></thead><tbody>");
            calc.getProjectCableByType().forEach(row -> {
                html.append("<tr><td>").append(escapeHtml(row.getCableName())).append("</td><td>");
                if (row.getCrossSectionMm2() != null) {
                    html.append(row.getCrossSectionMm2().stripTrailingZeros().toPlainString());
                } else {
                    html.append("—");
                }
                html.append("</td><td>").append(row.getTotalLengthM() != null ? row.getTotalLengthM().toPlainString() : "0")
                        .append("</td></tr>");
            });
            html.append("</tbody></table></div>");
        }

        if (calc.getRoomCalculations() != null && !calc.getRoomCalculations().isEmpty()) {
            html.append("<div class='summary-card'>");
            html.append("<h2>Расчёты по помещениям</h2>");
            html.append("<table><thead><tr><th>Помещение</th><th>Точек/приборов</th><th>Мощность, Вт</th><th>Кабель, м</th><th>По маркам и сечениям</th></tr></thead><tbody>");
            for (RoomCalculationResponse room : calc.getRoomCalculations()) {
                html.append("<tr><td>").append(escapeHtml(room.getRoomName())).append("</td><td>")
                        .append(room.getApplianceCount() != null ? room.getApplianceCount() : 0).append("</td><td>")
                        .append(room.getTotalPower() != null ? room.getTotalPower().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString() : "0")
                        .append("</td><td>")
                        .append(room.getTotalCableLengthM() != null ? room.getTotalCableLengthM().toPlainString() : "0")
                        .append("</td><td style='font-size:11px'>");
                if (room.getCableByType() != null && !room.getCableByType().isEmpty()) {
                    for (RoomCableTypeLengthResponse c : room.getCableByType()) {
                        html.append(escapeHtml(c.getCableName()));
                        if (c.getCrossSectionMm2() != null) {
                            html.append(" (").append(c.getCrossSectionMm2().stripTrailingZeros().toPlainString()).append(" мм²)");
                        }
                        html.append(": ").append(c.getLengthM() != null ? c.getLengthM().toPlainString() : "0").append(" м<br/>");
                    }
                } else {
                    html.append("—");
                }
                html.append("</td></tr>");
                if (room.getCableLengthSourceNote() != null) {
                    html.append("<tr><td colspan='5' style='font-size:10px;color:#555;padding-top:0'>")
                            .append(escapeHtml(room.getCableLengthSourceNote()))
                            .append("</td></tr>");
                }
            }
            html.append("</tbody></table></div>");
        }

        if (calc.getTotalProjectCost() != null) {
            html.append("<div class='summary-card'>");
            html.append("<h2>Финансовые расчёты (детализация)</h2>");
            html.append("<table><thead><tr><th>Статья</th><th>Как считается</th><th>Сумма / часы</th></tr></thead><tbody>");
            List<FinancialCalculationLineResponse> lines = calc.getFinancialCalculationLines();
            if (lines != null && !lines.isEmpty()) {
                for (FinancialCalculationLineResponse line : lines) {
                    int pad = line.getIndent() * 16;
                    html.append("<tr>");
                    html.append("<td style='padding-left:").append(pad).append("px'>").append(escapeHtml(line.getTitle())).append("</td>");
                    html.append("<td style='font-size:11px;color:#444'>").append(escapeHtml(
                            line.getCalculationNote() != null ? line.getCalculationNote() : "")).append("</td>");
                    html.append("<td>");
                    if (line.getAmountByn() != null) {
                        html.append(formatPrice(line.getAmountByn())).append(" BYN");
                    }
                    if (line.getAmountHours() != null) {
                        if (line.getAmountByn() != null) {
                            html.append("<br/>");
                        }
                        html.append(String.format(Locale.ROOT, "%.2f", line.getAmountHours())).append(" ч");
                    }
                    html.append("</td></tr>");
                }
            } else {
                if (calc.getTotalEquipmentCost() != null) {
                    html.append("<tr><td>Оборудование</td><td></td><td>").append(formatPrice(calc.getTotalEquipmentCost())).append(" BYN</td></tr>");
                }
                if (calc.getInstallationCost() != null) {
                    html.append("<tr><td>Монтаж</td><td></td><td>").append(formatPrice(calc.getInstallationCost())).append(" BYN</td></tr>");
                }
                if (calc.getCommissioningCost() != null) {
                    html.append("<tr><td>ПНР</td><td></td><td>").append(formatPrice(calc.getCommissioningCost())).append(" BYN</td></tr>");
                }
                html.append("<tr class='highlight'><td colspan='2'><strong>Итого проект</strong></td><td><strong>")
                        .append(formatPrice(calc.getTotalProjectCost())).append(" BYN</strong></td></tr>");
            }
            html.append("</table></div>");
        }

        html.append("<div class='footer'>");
        html.append("<p>Документ сформирован автоматически системой планирования электросети</p>");
        html.append("</div>");

        html.append("</body></html>");
        return html.toString();
    }

    private byte[] convertHtmlToPdf(String html) {
        try {
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            ConverterProperties converterProperties = new ConverterProperties();
            FontProvider fontProvider = new DefaultFontProvider(true, true, true);
            converterProperties.setFontProvider(fontProvider);
            HtmlConverter.convertToPdf(html, outputStream, converterProperties);
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Ошибка генерации PDF: " + e.getMessage(), e);
        }
    }

    private String formatPrice(BigDecimal price) {
        if (price == null) return "0.00";
        return numberFormat.format(price.setScale(2, java.math.RoundingMode.HALF_UP));
    }

    private String formatPower(BigDecimal power) {
        if (power == null) return "0 Вт";
        if (power.compareTo(BigDecimal.valueOf(1000)) >= 0) {
            return numberFormat.format(power.divide(BigDecimal.valueOf(1000), 2, java.math.RoundingMode.HALF_UP)) + " кВт";
        }
        return numberFormat.format(power.setScale(0, java.math.RoundingMode.HALF_UP)) + " Вт";
    }

    private String formatCurrent(BigDecimal current) {
        if (current == null) return "0 А";
        return numberFormat.format(current.setScale(2, java.math.RoundingMode.HALF_UP)) + " А";
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}

