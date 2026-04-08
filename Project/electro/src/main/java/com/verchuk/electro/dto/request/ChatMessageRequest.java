package com.verchuk.electro.dto.request;

import lombok.Data;

@Data
public class ChatMessageRequest {
    private String messageText;
    private String imageUrl;
    private Long replyToMessageId; // ID сообщения, на которое отвечаем
}

