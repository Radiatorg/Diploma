package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.ManufacturerRequest;
import com.verchuk.electro.dto.response.ApplianceResponse;
import com.verchuk.electro.dto.response.ManufacturerResponse;
import com.verchuk.electro.dto.response.ManufacturerSummaryResponse;
import com.verchuk.electro.exception.BadRequestException;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Appliance;
import com.verchuk.electro.model.Manufacturer;
import com.verchuk.electro.repository.ApplianceRepository;
import com.verchuk.electro.repository.ManufacturerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ManufacturerService {

    @Autowired
    private ManufacturerRepository manufacturerRepository;

    @Autowired
    private ApplianceRepository applianceRepository;

    @Autowired
    private ApplianceService applianceService;

    @Transactional(readOnly = true)
    public List<ManufacturerSummaryResponse> listActiveSummaries() {
        return manufacturerRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ManufacturerResponse getPublicById(Long id) {
        Manufacturer m = manufacturerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Manufacturer", "id", id));
        if (!Boolean.TRUE.equals(m.getActive())) {
            throw new ResourceNotFoundException("Manufacturer", "id", id);
        }
        return toResponse(m);
    }

    @Transactional(readOnly = true)
    public List<ApplianceResponse> getActiveAppliancesByManufacturer(Long manufacturerId) {
        if (!manufacturerRepository.existsById(manufacturerId)) {
            throw new ResourceNotFoundException("Manufacturer", "id", manufacturerId);
        }
        List<Appliance> list = applianceRepository.findByManufacturer_IdAndActiveTrueOrderByNameAsc(manufacturerId);
        return list.stream().map(applianceService::mapToResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ManufacturerResponse> getAllForAdmin() {
        return getAllForAdmin(
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty()
        ).getManufacturers();
    }

    @Transactional(readOnly = true)
    public ManufacturerQueryResult getAllForAdmin(Optional<String> search,
                                                  Optional<Boolean> active,
                                                  Optional<String> sortBy,
                                                  Optional<String> sortDir,
                                                  Optional<Integer> page,
                                                  Optional<Integer> size) {
        Comparator<Manufacturer> comparator = buildComparator(sortBy.orElse("name"));
        if ("desc".equalsIgnoreCase(sortDir.orElse("asc"))) {
            comparator = comparator.reversed();
        }

        List<Manufacturer> filteredAndSorted = manufacturerRepository.findAll().stream()
                .filter(m -> active.map(a -> a.equals(m.getActive())).orElse(true))
                .filter(m -> search.map(q -> matchesSearch(m, q)).orElse(true))
                .sorted(comparator)
                .collect(Collectors.toList());

        long totalItems = filteredAndSorted.size();
        List<Manufacturer> paginated = paginateManufacturers(filteredAndSorted, page, size);

        List<ManufacturerResponse> result = paginated.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return new ManufacturerQueryResult(result, totalItems);
    }

    @Transactional(readOnly = true)
    public ManufacturerResponse getByIdForAdmin(Long id) {
        Manufacturer m = manufacturerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Manufacturer", "id", id));
        return toResponse(m);
    }

    @Transactional
    public ManufacturerResponse create(ManufacturerRequest request) {
        String name = request.getName().trim();
        if (manufacturerRepository.findByNameIgnoreCase(name).isPresent()) {
            throw new BadRequestException("Производитель с таким названием уже существует");
        }
        Manufacturer m = Manufacturer.builder()
                .name(name)
                .legalName(trimToNull(request.getLegalName()))
                .description(trimToNull(request.getDescription()))
                .logoUrl(trimToNull(request.getLogoUrl()))
                .email(trimToNull(request.getEmail()))
                .websiteUrl(trimToNull(request.getWebsiteUrl()))
                .socialVk(trimToNull(request.getSocialVk()))
                .socialTelegram(trimToNull(request.getSocialTelegram()))
                .socialYoutube(trimToNull(request.getSocialYoutube()))
                .socialInstagram(trimToNull(request.getSocialInstagram()))
                .active(request.getActive() != null ? request.getActive() : true)
                .build();
        return toResponse(manufacturerRepository.save(m));
    }

    @Transactional
    public ManufacturerResponse update(Long id, ManufacturerRequest request) {
        Manufacturer m = manufacturerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Manufacturer", "id", id));
        String name = request.getName().trim();
        manufacturerRepository.findByNameIgnoreCase(name).ifPresent(other -> {
            if (!other.getId().equals(id)) {
                throw new BadRequestException("Производитель с таким названием уже существует");
            }
        });
        m.setName(name);
        m.setLegalName(trimToNull(request.getLegalName()));
        m.setDescription(trimToNull(request.getDescription()));
        if (request.getLogoUrl() != null) {
            m.setLogoUrl(trimToNull(request.getLogoUrl()));
        }
        m.setEmail(trimToNull(request.getEmail()));
        m.setWebsiteUrl(trimToNull(request.getWebsiteUrl()));
        m.setSocialVk(trimToNull(request.getSocialVk()));
        m.setSocialTelegram(trimToNull(request.getSocialTelegram()));
        m.setSocialYoutube(trimToNull(request.getSocialYoutube()));
        m.setSocialInstagram(trimToNull(request.getSocialInstagram()));
        if (request.getActive() != null) {
            m.setActive(request.getActive());
        }
        return toResponse(manufacturerRepository.save(m));
    }

    @Transactional
    public void delete(Long id) {
        manufacturerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Manufacturer", "id", id));
        long cnt = applianceRepository.countLinkedToManufacturer(id);
        if (cnt > 0) {
            throw new BadRequestException("Нельзя удалить производителя: к нему привязано " + cnt + " прибор(ов). Сначала снимите связь.");
        }
        manufacturerRepository.deleteById(id);
    }

    public ManufacturerSummaryResponse toSummary(Manufacturer m) {
        if (m == null) {
            return null;
        }
        return ManufacturerSummaryResponse.builder()
                .id(m.getId())
                .name(m.getName())
                .logoUrl(resolveLogoUrl(m))
                .build();
    }

    private ManufacturerResponse toResponse(Manufacturer m) {
        return ManufacturerResponse.builder()
                .id(m.getId())
                .name(m.getName())
                .legalName(m.getLegalName())
                .description(m.getDescription())
                .logoUrl(resolveLogoUrl(m))
                .email(m.getEmail())
                .websiteUrl(m.getWebsiteUrl())
                .socialVk(m.getSocialVk())
                .socialTelegram(m.getSocialTelegram())
                .socialYoutube(m.getSocialYoutube())
                .socialInstagram(m.getSocialInstagram())
                .active(m.getActive())
                .build();
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private String resolveLogoUrl(Manufacturer m) {
        if (m.getLogoUrl() != null && !m.getLogoUrl().isBlank()) {
            return m.getLogoUrl();
        }
        if (m.getName() == null || m.getName().isBlank()) {
            return null;
        }
        Optional<String> filename = findLogoFilenameByManufacturerName(m.getName());
        return filename.map(name -> "/api/files/" + name).orElse(null);
    }

    private Optional<String> findLogoFilenameByManufacturerName(String manufacturerName) {
        Path uploadsRoot = resolveUploadsRoot();
        List<Path> dirs = List.of(
                uploadsRoot.resolve("manufacturers"),
                uploadsRoot.resolve("manufactures")
        );

        List<String> baseNames = new ArrayList<>();
        String trimmed = manufacturerName.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);
        String upper = trimmed.toUpperCase(Locale.ROOT);
        baseNames.add(trimmed);
        baseNames.add(lower);
        baseNames.add(upper);
        baseNames.add(trimmed.replace(" ", ""));
        baseNames.add(lower.replace(" ", ""));
        baseNames.add(upper.replace(" ", ""));

        String[] exts = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".JPG", ".JPEG", ".PNG", ".WEBP", ".GIF", ".SVG"};
        for (Path dir : dirs) {
            for (String base : baseNames) {
                for (String ext : exts) {
                    Path candidate = dir.resolve(base + ext);
                    if (Files.exists(candidate) && Files.isRegularFile(candidate)) {
                        return Optional.of(candidate.getFileName().toString());
                    }
                }
            }
        }
        return Optional.empty();
    }

    private Path resolveUploadsRoot() {
        String workingDir = System.getProperty("user.dir");
        Path direct = Paths.get(workingDir, "uploads").toAbsolutePath().normalize();
        if (Files.exists(direct)) {
            return direct;
        }
        Path inProject = Paths.get(workingDir, "Project", "electro", "uploads").toAbsolutePath().normalize();
        if (Files.exists(inProject)) {
            return inProject;
        }
        Path parent = Paths.get(workingDir).getParent();
        if (parent != null) {
            Path parentUploads = parent.resolve("uploads").toAbsolutePath().normalize();
            if (Files.exists(parentUploads)) {
                return parentUploads;
            }
        }
        return direct;
    }

    private Comparator<Manufacturer> buildComparator(String sortBy) {
        return switch (sortBy) {
            case "id" -> Comparator.comparing(Manufacturer::getId, nullSafeComparableComparator());
            case "name" -> Comparator.comparing(Manufacturer::getName, nullSafeStringComparator());
            case "legalName" -> Comparator.comparing(Manufacturer::getLegalName, nullSafeStringComparator());
            case "email" -> Comparator.comparing(Manufacturer::getEmail, nullSafeStringComparator());
            case "websiteUrl" -> Comparator.comparing(Manufacturer::getWebsiteUrl, nullSafeStringComparator());
            case "active" -> Comparator.comparing(Manufacturer::getActive, nullSafeComparableComparator());
            default -> Comparator.comparing(Manufacturer::getName, nullSafeStringComparator());
        };
    }

    private boolean matchesSearch(Manufacturer m, String searchQuery) {
        String query = searchQuery == null ? "" : searchQuery.trim().toLowerCase(Locale.ROOT);
        if (query.isEmpty()) {
            return true;
        }
        return containsIgnoreCase(m.getName(), query)
                || containsIgnoreCase(m.getLegalName(), query)
                || containsIgnoreCase(m.getEmail(), query)
                || containsIgnoreCase(m.getWebsiteUrl(), query)
                || containsIgnoreCase(m.getDescription(), query)
                || containsIgnoreCase(m.getSocialVk(), query)
                || containsIgnoreCase(m.getSocialTelegram(), query)
                || containsIgnoreCase(m.getSocialYoutube(), query)
                || containsIgnoreCase(m.getSocialInstagram(), query)
                || String.valueOf(m.getId()).contains(query);
    }

    private boolean containsIgnoreCase(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private List<Manufacturer> paginateManufacturers(List<Manufacturer> manufacturers, Optional<Integer> page, Optional<Integer> size) {
        if (page.isEmpty() && size.isEmpty()) {
            return manufacturers;
        }
        int safePage = Math.max(0, page.orElse(0));
        int safeSize = size.orElse(20);
        if (safeSize <= 0) {
            safeSize = 20;
        }
        int fromIndex = safePage * safeSize;
        if (fromIndex >= manufacturers.size()) {
            return List.of();
        }
        int toIndex = Math.min(fromIndex + safeSize, manufacturers.size());
        return manufacturers.subList(fromIndex, toIndex);
    }

    private Comparator<String> nullSafeStringComparator() {
        return Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER);
    }

    private <T extends Comparable<? super T>> Comparator<T> nullSafeComparableComparator() {
        return Comparator.nullsLast(Comparator.naturalOrder());
    }

    public static class ManufacturerQueryResult {
        private final List<ManufacturerResponse> manufacturers;
        private final long totalItems;

        public ManufacturerQueryResult(List<ManufacturerResponse> manufacturers, long totalItems) {
            this.manufacturers = manufacturers;
            this.totalItems = totalItems;
        }

        public List<ManufacturerResponse> getManufacturers() {
            return manufacturers;
        }

        public long getTotalItems() {
            return totalItems;
        }
    }
}
