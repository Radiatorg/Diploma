package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.ApplianceRequest;
import com.verchuk.electro.dto.request.ManufacturerRequest;
import com.verchuk.electro.dto.response.ExcelImportResultResponse;
import com.verchuk.electro.dto.response.ExcelImportResultResponse.ExcelImportError;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Appliance;
import com.verchuk.electro.model.Category;
import com.verchuk.electro.model.Manufacturer;
import com.verchuk.electro.repository.ApplianceRepository;
import com.verchuk.electro.repository.CategoryRepository;
import com.verchuk.electro.repository.ManufacturerRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Импорт/экспорт каталога приборов и производителей в Excel (.xlsx).
 * Первая строка — заголовки (фиксированные имена колонок).
 */
@Service
public class ExcelDataExchangeService {

    private static final String[] APPLIANCE_HEADERS = {
            "id", "name", "description", "powerConsumption", "voltage", "current", "price", "model",
            "ipRating", "color", "cableBrand", "cableCrossSection", "width", "height", "imageUrl", "active",
            "categoryNames", "manufacturerId", "manufacturerName"
    };

    private static final String[] MANUFACTURER_HEADERS = {
            "id", "name", "legalName", "description", "email", "websiteUrl", "socialVk", "socialTelegram",
            "socialYoutube", "socialInstagram", "logoUrl", "active"
    };

    @Autowired
    private ApplianceRepository applianceRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ManufacturerRepository manufacturerRepository;

    @Autowired
    private ApplianceService applianceService;

    @Autowired
    private ManufacturerService manufacturerService;

    @Transactional(readOnly = true)
    public byte[] exportAppliancesExcel() throws IOException {
        List<Appliance> list = applianceRepository.findAll().stream()
                .sorted(Comparator.comparing(Appliance::getName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("appliances");
            Row h = sheet.createRow(0);
            for (int i = 0; i < APPLIANCE_HEADERS.length; i++) {
                h.createCell(i).setCellValue(APPLIANCE_HEADERS[i]);
            }
            int r = 1;
            for (Appliance a : list) {
                Row row = sheet.createRow(r++);
                int c = 0;
                row.createCell(c++).setCellValue(a.getId() != null ? a.getId() : 0);
                row.createCell(c++).setCellValue(nullToEmpty(a.getName()));
                row.createCell(c++).setCellValue(nullToEmpty(a.getDescription()));
                row.createCell(c++).setCellValue(a.getPowerConsumption() != null ? a.getPowerConsumption().doubleValue() : 0);
                row.createCell(c++).setCellValue(a.getVoltage() != null ? a.getVoltage().doubleValue() : 0);
                row.createCell(c++).setCellValue(a.getCurrent() != null ? a.getCurrent().doubleValue() : 0);
                row.createCell(c++).setCellValue(a.getPrice() != null ? a.getPrice().doubleValue() : 0);
                row.createCell(c++).setCellValue(nullToEmpty(a.getModel()));
                row.createCell(c++).setCellValue(nullToEmpty(a.getIpRating()));
                row.createCell(c++).setCellValue(nullToEmpty(a.getColor()));
                row.createCell(c++).setCellValue(nullToEmpty(a.getCableBrand()));
                row.createCell(c++).setCellValue(nullToEmpty(a.getCableCrossSection()));
                row.createCell(c++).setCellValue(a.getWidth() != null ? a.getWidth().doubleValue() : 0);
                row.createCell(c++).setCellValue(a.getHeight() != null ? a.getHeight().doubleValue() : 0);
                row.createCell(c++).setCellValue(nullToEmpty(a.getImageUrl()));
                row.createCell(c++).setCellValue(Boolean.TRUE.equals(a.getActive()));
                String cats = "";
                if (a.getCategories() != null && !a.getCategories().isEmpty()) {
                    cats = a.getCategories().stream().map(Category::getName).filter(Objects::nonNull).collect(Collectors.joining(";"));
                }
                row.createCell(c++).setCellValue(cats);
                row.createCell(c++).setCellValue(a.getManufacturer() != null && a.getManufacturer().getId() != null ? a.getManufacturer().getId() : 0);
                row.createCell(c++).setCellValue(a.getManufacturer() != null ? nullToEmpty(a.getManufacturer().getName()) : "");
            }
            for (int i = 0; i < APPLIANCE_HEADERS.length; i++) {
                sheet.autoSizeColumn(i);
            }
            wb.write(out);
            return out.toByteArray();
        }
    }

    @Transactional
    public ExcelImportResultResponse importAppliancesExcel(MultipartFile file) {
        List<ExcelImportError> errors = new ArrayList<>();
        int created = 0;
        int updated = 0;
        int skipped = 0;

        if (file == null || file.isEmpty()) {
            errors.add(ExcelImportError.builder().rowNumber(0).message("Файл пустой").build());
            return ExcelImportResultResponse.builder().errors(errors).build();
        }
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            errors.add(ExcelImportError.builder().rowNumber(0).message("Ожидается файл .xlsx").build());
            return ExcelImportResultResponse.builder().errors(errors).build();
        }

        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            if (sheet.getPhysicalNumberOfRows() < 2) {
                errors.add(ExcelImportError.builder().rowNumber(1).message("Нет строк данных").build());
                return ExcelImportResultResponse.builder().errors(errors).build();
            }
            Row header = sheet.getRow(0);
            Map<String, Integer> col = mapHeader(header, APPLIANCE_HEADERS);
            if (!col.keySet().containsAll(Set.of("name", "powerConsumption"))) {
                errors.add(ExcelImportError.builder().rowNumber(1).message("Обязательные колонки: name, powerConsumption").build());
                return ExcelImportResultResponse.builder().errors(errors).build();
            }

            int last = sheet.getLastRowNum();
            for (int i = 1; i <= last; i++) {
                Row row = sheet.getRow(i);
                if (row == null || isEmptyRow(row)) {
                    skipped++;
                    continue;
                }
                int rowNum = i + 1;
                try {
                    Long id = parseLong(getCell(row, col, "id"));
                    String nm = trim(getCell(row, col, "name"));
                    if (nm == null || nm.isEmpty()) {
                        errors.add(ExcelImportError.builder().rowNumber(rowNum).message("Пустое name").build());
                        skipped++;
                        continue;
                    }
                    BigDecimal power = parseBigDecimalRequired(getCell(row, col, "powerConsumption"), "powerConsumption");
                    ApplianceRequest req = new ApplianceRequest();
                    req.setName(nm);
                    req.setDescription(trimOrNull(getCell(row, col, "description")));
                    req.setPowerConsumption(power);
                    req.setVoltage(parseBigDecimalOpt(getCell(row, col, "voltage")));
                    req.setCurrent(parseBigDecimalOpt(getCell(row, col, "current")));
                    req.setPrice(parseBigDecimalOpt(getCell(row, col, "price")));
                    req.setModel(trimOrNull(getCell(row, col, "model")));
                    req.setIpRating(trimOrNull(getCell(row, col, "ipRating")));
                    req.setColor(trimOrNull(getCell(row, col, "color")));
                    req.setCableBrand(trimOrNull(getCell(row, col, "cableBrand")));
                    req.setCableCrossSection(trimOrNull(getCell(row, col, "cableCrossSection")));
                    req.setWidth(parseBigDecimalOpt(getCell(row, col, "width")));
                    req.setHeight(parseBigDecimalOpt(getCell(row, col, "height")));
                    req.setImageUrl(trimOrNull(getCell(row, col, "imageUrl")));

                    String activeStr = getCell(row, col, "active");
                    boolean active = activeStr == null || activeStr.isEmpty() || parseBoolean(activeStr, true);

                    String catNames = trimOrNull(getCell(row, col, "categoryNames"));
                    if (catNames != null && !catNames.isEmpty()) {
                        List<Long> catIds = new ArrayList<>();
                        for (String piece : catNames.split(";")) {
                            String cn = piece.trim();
                            if (cn.isEmpty()) {
                                continue;
                            }
                            Category cat = categoryRepository.findByName(cn)
                                    .orElseGet(() -> categoryRepository.save(Category.builder().name(cn).description(null).build()));
                            catIds.add(cat.getId());
                        }
                        req.setCategoryIds(catIds);
                    }

                    Long mId = parseLong(getCell(row, col, "manufacturerId"));
                    String mName = trimOrNull(getCell(row, col, "manufacturerName"));
                    if (mId != null && mId > 0) {
                        if (!manufacturerRepository.existsById(mId)) {
                            throw new IllegalArgumentException("manufacturerId=" + mId + " не найден");
                        }
                        req.setManufacturerId(mId);
                    } else if (mName != null) {
                        Manufacturer mf = manufacturerRepository.findByNameIgnoreCase(mName)
                                .orElseThrow(() -> new ResourceNotFoundException("Manufacturer", "name", mName));
                        req.setManufacturerId(mf.getId());
                    } else {
                        req.setManufacturerId(null);
                    }

                    if (id != null && id > 0) {
                        if (!applianceRepository.existsById(id)) {
                            errors.add(ExcelImportError.builder().rowNumber(rowNum).message("Прибор id=" + id + " не найден").build());
                            skipped++;
                            continue;
                        }
                        applianceService.updateAppliance(id, req);
                        if (!active) {
                            Appliance a = applianceRepository.findById(id).orElseThrow();
                            a.setActive(false);
                            applianceRepository.save(a);
                        }
                        updated++;
                    } else {
                        var createdResp = applianceService.createAppliance(req);
                        if (!active) {
                            Appliance a = applianceRepository.findById(createdResp.getId()).orElseThrow();
                            a.setActive(false);
                            applianceRepository.save(a);
                        }
                        created++;
                    }
                } catch (Exception ex) {
                    errors.add(ExcelImportError.builder().rowNumber(rowNum).message(ex.getMessage() != null ? ex.getMessage() : ex.toString()).build());
                    skipped++;
                }
            }
        } catch (IOException e) {
            errors.add(ExcelImportError.builder().rowNumber(0).message("Ошибка чтения Excel: " + e.getMessage()).build());
        }

        return ExcelImportResultResponse.builder()
                .created(created)
                .updated(updated)
                .skipped(skipped)
                .errors(errors)
                .build();
    }

    @Transactional(readOnly = true)
    public byte[] exportManufacturersExcel() throws IOException {
        List<Manufacturer> list = manufacturerRepository.findAll().stream()
                .sorted(Comparator.comparing(Manufacturer::getName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("manufacturers");
            Row h = sheet.createRow(0);
            for (int i = 0; i < MANUFACTURER_HEADERS.length; i++) {
                h.createCell(i).setCellValue(MANUFACTURER_HEADERS[i]);
            }
            int r = 1;
            for (Manufacturer m : list) {
                Row row = sheet.createRow(r++);
                int c = 0;
                row.createCell(c++).setCellValue(m.getId() != null ? m.getId() : 0);
                row.createCell(c++).setCellValue(nullToEmpty(m.getName()));
                row.createCell(c++).setCellValue(nullToEmpty(m.getLegalName()));
                row.createCell(c++).setCellValue(nullToEmpty(m.getDescription()));
                row.createCell(c++).setCellValue(nullToEmpty(m.getEmail()));
                row.createCell(c++).setCellValue(nullToEmpty(m.getWebsiteUrl()));
                row.createCell(c++).setCellValue(nullToEmpty(m.getSocialVk()));
                row.createCell(c++).setCellValue(nullToEmpty(m.getSocialTelegram()));
                row.createCell(c++).setCellValue(nullToEmpty(m.getSocialYoutube()));
                row.createCell(c++).setCellValue(nullToEmpty(m.getSocialInstagram()));
                row.createCell(c++).setCellValue(nullToEmpty(m.getLogoUrl()));
                row.createCell(c++).setCellValue(Boolean.TRUE.equals(m.getActive()));
            }
            for (int i = 0; i < MANUFACTURER_HEADERS.length; i++) {
                sheet.autoSizeColumn(i);
            }
            wb.write(out);
            return out.toByteArray();
        }
    }

    @Transactional
    public ExcelImportResultResponse importManufacturersExcel(MultipartFile file) {
        List<ExcelImportError> errors = new ArrayList<>();
        int created = 0;
        int updated = 0;
        int skipped = 0;

        if (file == null || file.isEmpty()) {
            errors.add(ExcelImportError.builder().rowNumber(0).message("Файл пустой").build());
            return ExcelImportResultResponse.builder().errors(errors).build();
        }
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            errors.add(ExcelImportError.builder().rowNumber(0).message("Ожидается файл .xlsx").build());
            return ExcelImportResultResponse.builder().errors(errors).build();
        }

        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            if (sheet.getPhysicalNumberOfRows() < 2) {
                errors.add(ExcelImportError.builder().rowNumber(1).message("Нет строк данных").build());
                return ExcelImportResultResponse.builder().errors(errors).build();
            }
            Row header = sheet.getRow(0);
            Map<String, Integer> col = mapHeader(header, MANUFACTURER_HEADERS);
            if (!col.containsKey("name")) {
                errors.add(ExcelImportError.builder().rowNumber(1).message("Обязательная колонка: name").build());
                return ExcelImportResultResponse.builder().errors(errors).build();
            }

            int last = sheet.getLastRowNum();
            for (int i = 1; i <= last; i++) {
                Row row = sheet.getRow(i);
                if (row == null || isEmptyRow(row)) {
                    skipped++;
                    continue;
                }
                int rowNum = i + 1;
                try {
                    Long id = parseLong(getCell(row, col, "id"));
                    String nm = trim(getCell(row, col, "name"));
                    if (nm == null || nm.isEmpty()) {
                        errors.add(ExcelImportError.builder().rowNumber(rowNum).message("Пустое name").build());
                        skipped++;
                        continue;
                    }
                    ManufacturerRequest req = new ManufacturerRequest();
                    req.setName(nm);
                    req.setLegalName(trimOrNull(getCell(row, col, "legalName")));
                    req.setDescription(trimOrNull(getCell(row, col, "description")));
                    req.setEmail(trimOrNull(getCell(row, col, "email")));
                    req.setWebsiteUrl(trimOrNull(getCell(row, col, "websiteUrl")));
                    req.setSocialVk(trimOrNull(getCell(row, col, "socialVk")));
                    req.setSocialTelegram(trimOrNull(getCell(row, col, "socialTelegram")));
                    req.setSocialYoutube(trimOrNull(getCell(row, col, "socialYoutube")));
                    req.setSocialInstagram(trimOrNull(getCell(row, col, "socialInstagram")));
                    req.setLogoUrl(trimOrNull(getCell(row, col, "logoUrl")));
                    req.setActive(parseBoolean(getCell(row, col, "active"), true));

                    if (id != null && id > 0) {
                        if (!manufacturerRepository.existsById(id)) {
                            errors.add(ExcelImportError.builder().rowNumber(rowNum).message("Производитель id=" + id + " не найден").build());
                            skipped++;
                            continue;
                        }
                        manufacturerService.update(id, req);
                        updated++;
                    } else {
                        manufacturerService.create(req);
                        created++;
                    }
                } catch (Exception ex) {
                    errors.add(ExcelImportError.builder().rowNumber(rowNum).message(ex.getMessage() != null ? ex.getMessage() : ex.toString()).build());
                    skipped++;
                }
            }
        } catch (IOException e) {
            errors.add(ExcelImportError.builder().rowNumber(0).message("Ошибка чтения Excel: " + e.getMessage()).build());
        }

        return ExcelImportResultResponse.builder()
                .created(created)
                .updated(updated)
                .skipped(skipped)
                .errors(errors)
                .build();
    }

    private static Map<String, Integer> mapHeader(Row header, String[] expected) {
        Map<String, Integer> map = new HashMap<>();
        if (header == null) {
            return map;
        }
        for (Cell cell : header) {
            if (cell == null) {
                continue;
            }
            String key = trim(cell.toString());
            if (key != null) {
                map.put(key.toLowerCase(Locale.ROOT).replace(" ", ""), cell.getColumnIndex());
            }
        }
        Map<String, Integer> norm = new HashMap<>();
        for (String e : expected) {
            String k = e.toLowerCase(Locale.ROOT).replace(" ", "");
            if (map.containsKey(k)) {
                norm.put(e, map.get(k));
            }
        }
        return norm;
    }

    private static String getCell(Row row, Map<String, Integer> col, String key) {
        Integer idx = col.get(key);
        if (idx == null) {
            return null;
        }
        Cell cell = row.getCell(idx);
        if (cell == null) {
            return null;
        }
        return cellToString(cell);
    }

    private static String cellToString(Cell cell) {
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> DateUtil.isCellDateFormatted(cell)
                    ? cell.getDateCellValue().toString()
                    : String.valueOf(cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield String.valueOf(cell.getNumericCellValue());
                } catch (Exception e) {
                    yield cell.getStringCellValue();
                }
            }
            default -> null;
        };
    }

    private static boolean isEmptyRow(Row row) {
        if (row == null) {
            return true;
        }
        int first = row.getFirstCellNum();
        int last = row.getLastCellNum();
        if (first < 0 || last < 0) {
            return true;
        }
        for (int i = first; i < last; i++) {
            Cell c = row.getCell(i);
            if (c != null && c.getCellType() != CellType.BLANK) {
                String s = trim(cellToString(c));
                if (s != null && !s.isEmpty()) {
                    return false;
                }
            }
        }
        return true;
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }

    private static String trimOrNull(String s) {
        String t = trim(s);
        return t == null || t.isEmpty() ? null : t;
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private static Long parseLong(String s) {
        if (s == null || s.trim().isEmpty()) {
            return null;
        }
        double d = Double.parseDouble(s.trim().replace(',', '.'));
        return (long) d;
    }

    private static BigDecimal parseBigDecimalRequired(String s, String field) {
        if (s == null || s.trim().isEmpty()) {
            throw new IllegalArgumentException("Поле " + field + " обязательно");
        }
        return new BigDecimal(s.trim().replace(',', '.'));
    }

    private static BigDecimal parseBigDecimalOpt(String s) {
        if (s == null || s.trim().isEmpty()) {
            return null;
        }
        return new BigDecimal(s.trim().replace(',', '.'));
    }

    private static boolean parseBoolean(String s, boolean def) {
        if (s == null || s.trim().isEmpty()) {
            return def;
        }
        String v = s.trim().toLowerCase(Locale.ROOT);
        return v.equals("true") || v.equals("1") || v.equals("да") || v.equals("yes");
    }
}
