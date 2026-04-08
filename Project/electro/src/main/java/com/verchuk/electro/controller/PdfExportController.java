package com.verchuk.electro.controller;

import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.service.EmailService;
import com.verchuk.electro.service.PdfExportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}")
public class PdfExportController {

    @Autowired
    private PdfExportService pdfExportService;

    @Autowired
    private EmailService emailService;

    @GetMapping("/export/specification.pdf")
    public ResponseEntity<byte[]> exportSpecification(@PathVariable Long projectId) {
        byte[] pdfBytes = pdfExportService.generateSpecificationPdf(projectId);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=specification_" + projectId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    @GetMapping("/export/calculation.pdf")
    public ResponseEntity<byte[]> exportCalculation(@PathVariable Long projectId) {
        byte[] pdfBytes = pdfExportService.generateCalculationPdf(projectId);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=calculation_" + projectId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    @PostMapping("/send-email")
    public ResponseEntity<ApiResponse> sendEmail(@PathVariable Long projectId) {
        try {
            emailService.sendCalculationAndSpecification(projectId);
            return ResponseEntity.ok(ApiResponse.success("Документы успешно отправлены на почту"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Ошибка отправки на почту: " + e.getMessage()));
        }
    }
}

