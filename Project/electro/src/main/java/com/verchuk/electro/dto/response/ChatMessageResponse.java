package com.verchuk.electro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageResponse {
    private Long id;
    private Long senderId;
    private String senderUsername;
    private String senderFirstName;
    private String senderLastName;
    private String messageText;
    private String imageUrl;
    private LocalDateTime createdAt;
    private Boolean deleted;
    private Long assignedAdminId; // ID админа, который отвечает на это сообщение
    private String assignedAdminUsername;
    private String assignedAdminFirstName;
    private String assignedAdminLastName;
    private Long replyToMessageId; // ID сообщения, на которое отвечаем
    private Long originalSenderId; // ID отправителя исходного сообщения (для ответов на удаленные сообщения)
    private String originalSenderUsername; // Username отправителя исходного сообщения
    private String originalSenderFirstName; // Имя отправителя исходного сообщения
    private String originalSenderLastName; // Фамилия отправителя исходного сообщения
    private Boolean originalMessageDeleted; // Удалено ли исходное сообщение
}

