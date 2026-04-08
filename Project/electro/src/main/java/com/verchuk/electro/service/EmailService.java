package com.verchuk.electro.service;

import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.User;
import com.verchuk.electro.repository.ProjectRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private PdfExportService pdfExportService;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserService userService;

    @Value("${spring.mail.username:no-reply@electroplanner.local}")
    private String fromEmail;

    public void sendCalculationAndSpecification(Long projectId) {
        System.out.println("==========================================");
        System.out.println("EMAIL SERVICE: Начинаем отправку письма для проекта ID: " + projectId);
        logger.info("Начинаем отправку письма для проекта ID: {}", projectId);
        
        try {
            User currentUser = userService.getCurrentUser();
            String userEmail = currentUser.getEmail();
            
            System.out.println("EMAIL SERVICE: Получатель: " + userEmail);
            System.out.println("EMAIL SERVICE: Отправитель: " + fromEmail);
            logger.info("Получатель: {}", userEmail);
            logger.info("Отправитель: {}", fromEmail);

            if (userEmail == null || userEmail.isEmpty()) {
                System.out.println("EMAIL SERVICE: ОШИБКА - Email пользователя не указан!");
                throw new RuntimeException("Email пользователя не указан");
            }

            Project project = projectRepository.findByIdAndDesigner(projectId, currentUser)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

            System.out.println("EMAIL SERVICE: Генерируем PDF документы для проекта: " + project.getName());
            logger.info("Генерируем PDF документы для проекта: {}", project.getName());
            
            // Генерируем PDF документы
            byte[] calculationPdf = pdfExportService.generateCalculationPdf(projectId);
            byte[] specificationPdf = pdfExportService.generateSpecificationPdf(projectId);
            
            System.out.println("EMAIL SERVICE: PDF документы сгенерированы. Размер расчета: " + 
                    calculationPdf.length + " байт, сметы: " + specificationPdf.length + " байт");
            logger.info("PDF документы сгенерированы. Размер расчета: {} байт, сметы: {} байт", 
                    calculationPdf.length, specificationPdf.length);

            // Создаем сообщение
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            // Для Yandex важно, чтобы fromEmail совпадал с username
            helper.setFrom(fromEmail, "Система планирования электросети");
            helper.setTo(userEmail);
            helper.setSubject("Расчеты и смета оборудования - Проект: " + project.getName());

            String emailBody = String.format(
                    "Здравствуйте, %s!\n\n" +
                    "Высылаем вам документы по проекту \"%s\":\n\n" +
                    "1. Расчетная ведомость\n" +
                    "2. Смета электротехнического оборудования\n\n" +
                    "Документы прикреплены к этому письму.\n\n" +
                    "С уважением,\n" +
                    "Система планирования электросети",
                    currentUser.getFirstName() != null && !currentUser.getFirstName().isEmpty()
                            ? currentUser.getFirstName() : currentUser.getUsername(),
                    project.getName()
            );

            helper.setText(emailBody, false);

            // Прикрепляем PDF документы
            helper.addAttachment("Расчетная_ведомость_" + projectId + ".pdf", 
                    () -> new java.io.ByteArrayInputStream(calculationPdf), 
                    "application/pdf");
            helper.addAttachment("Смета_оборудования_" + projectId + ".pdf", 
                    () -> new java.io.ByteArrayInputStream(specificationPdf), 
                    "application/pdf");

            // Отправляем письмо
            System.out.println("EMAIL SERVICE: Отправляем письмо с " + fromEmail + " на " + userEmail);
            logger.info("Отправляем письмо с {} на {}", fromEmail, userEmail);
            
            mailSender.send(message);
            
            System.out.println("EMAIL SERVICE: Письмо успешно отправлено!");
            System.out.println("==========================================");
            logger.info("Письмо успешно отправлено!");
        } catch (MessagingException e) {
            System.out.println("EMAIL SERVICE: ОШИБКА MessagingException: " + e.getMessage());
            e.printStackTrace();
            logger.error("Ошибка отправки email: {}", e.getMessage(), e);
            throw new RuntimeException("Ошибка отправки email: " + e.getMessage(), e);
        } catch (Exception e) {
            System.out.println("EMAIL SERVICE: ОШИБКА Exception: " + e.getMessage());
            e.printStackTrace();
            logger.error("Неожиданная ошибка при отправке email: {}", e.getMessage(), e);
            throw new RuntimeException("Ошибка отправки email: " + e.getMessage(), e);
        }
    }
}

