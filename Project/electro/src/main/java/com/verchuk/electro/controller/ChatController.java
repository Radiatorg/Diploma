package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.ChatMessageRequest;
import com.verchuk.electro.dto.response.ChatMessageResponse;
import com.verchuk.electro.service.ChatService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/chat")
@PreAuthorize("hasAnyRole('DESIGNER', 'ADMIN')")
public class ChatController {
    @Autowired
    private ChatService chatService;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/send")
    @SendTo("/topic/messages")
    public ChatMessageResponse sendMessage(@Payload ChatMessageRequest request) {
        ChatMessageResponse response = chatService.createMessage(request);
        // Отправляем сообщение всем подписчикам
        messagingTemplate.convertAndSend("/topic/messages", response);
        return response;
    }

    @PostMapping("/messages")
    public ResponseEntity<ChatMessageResponse> createMessage(@RequestBody ChatMessageRequest request) {
        ChatMessageResponse response = chatService.createMessage(request);
        // Отправляем новое сообщение через WebSocket
        messagingTemplate.convertAndSend("/topic/messages", response);
        
        // Если это ответ админа, отправляем обновление исходного сообщения
        if (request.getReplyToMessageId() != null) {
            ChatMessageResponse updatedOriginal = chatService.getMessageById(request.getReplyToMessageId());
            if (updatedOriginal != null) {
                messagingTemplate.convertAndSend("/topic/messages", updatedOriginal);
            }
        }
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/messages")
    public ResponseEntity<List<ChatMessageResponse>> getAllMessages() {
        return ResponseEntity.ok(chatService.getAllMessages());
    }

    @DeleteMapping("/messages/{id}")
    public ResponseEntity<Void> deleteMessage(@PathVariable Long id) {
        chatService.deleteMessage(id);
        // Уведомляем всех об удалении
        messagingTemplate.convertAndSend("/topic/messages/deleted", id);
        return ResponseEntity.ok().build();
    }
}

