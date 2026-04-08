package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.ChatMessageRequest;
import com.verchuk.electro.dto.response.ChatMessageResponse;
import com.verchuk.electro.exception.BadRequestException;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.ChatMessage;
import com.verchuk.electro.model.User;
import com.verchuk.electro.repository.ChatMessageRepository;
import com.verchuk.electro.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ChatService {
    @Autowired
    private ChatMessageRepository chatMessageRepository;
    
    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
    }

    @Transactional
    public ChatMessageResponse createMessage(ChatMessageRequest request) {
        User sender = getCurrentUser();
        boolean isAdmin = sender.getRoles().stream()
                .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);

        // Проверка для админа: если это первое сообщение в беседе, должен быть replyToMessageId
        if (isAdmin && request.getReplyToMessageId() == null) {
            // Проверяем, есть ли уже сообщения от этого админа в беседе с пользователями
            // (т.е. админ уже отвечал кому-то)
            List<ChatMessage> adminMessages = chatMessageRepository.findAll().stream()
                    .filter(m -> m.getSender().getId().equals(sender.getId()) && !m.getDeleted())
                    .collect(Collectors.toList());
            
            // Если у админа нет сообщений, значит это первое сообщение - нужен replyToMessageId
            if (adminMessages.isEmpty()) {
                throw new BadRequestException(
                    "Для первого сообщения необходимо ответить на сообщение пользователя. Выберите сообщение пользователя и нажмите 'Ответить'."
                );
            }
        }
        
        // Если админ отвечает на сообщение, проверяем что это сообщение от пользователя (не админа)
        if (isAdmin && request.getReplyToMessageId() != null) {
            ChatMessage repliedMessage = chatMessageRepository.findById(request.getReplyToMessageId())
                    .orElseThrow(() -> new ResourceNotFoundException("ChatMessage", "id", request.getReplyToMessageId()));
            
            boolean repliedMessageFromAdmin = repliedMessage.getSender().getRoles().stream()
                    .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);
            
            if (repliedMessageFromAdmin) {
                throw new BadRequestException(
                    "Администратор может отвечать только на сообщения пользователей, а не на сообщения других администраторов."
                );
            }
        }

        ChatMessage replyToMessage = null;
        if (request.getReplyToMessageId() != null) {
            replyToMessage = chatMessageRepository.findById(request.getReplyToMessageId())
                    .orElseThrow(() -> new ResourceNotFoundException("ChatMessage", "id", request.getReplyToMessageId()));
        }

        ChatMessage message = ChatMessage.builder()
                .sender(sender)
                .messageText(request.getMessageText())
                .imageUrl(request.getImageUrl())
                .deleted(false)
                .replyToMessage(replyToMessage)
                .build();

        // Если админ отвечает на сообщение, назначаем это сообщение ему (только если еще не назначен)
        if (isAdmin && replyToMessage != null && replyToMessage.getAssignedAdmin() == null) {
            replyToMessage.setAssignedAdmin(sender);
            chatMessageRepository.save(replyToMessage);
        }

        ChatMessage saved = chatMessageRepository.save(message);
        return mapToResponse(saved);
    }

    @Transactional
    public void deleteMessage(Long messageId) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatMessage", "id", messageId));

        User currentUser = getCurrentUser();
        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);

        // Проверяем, что пользователь является отправителем или администратором
        if (message.getSender().getId().equals(currentUser.getId()) || isAdmin) {
            // Если удаляется сообщение, на которое есть ответы, удаляем все ответы
            List<ChatMessage> replies = chatMessageRepository.findAll().stream()
                    .filter(m -> m.getReplyToMessage() != null && m.getReplyToMessage().getId().equals(messageId))
                    .collect(java.util.stream.Collectors.toList());
            
            // Если админ удаляет сообщение, удаляем все ответы на него
            if (isAdmin) {
                for (ChatMessage reply : replies) {
                    reply.setDeleted(true);
                    chatMessageRepository.save(reply);
                }
            } else {
                // Если обычный пользователь удаляет свое сообщение, ответы остаются с пометкой "ответ на удаленное сообщение"
                // Это будет обработано в mapToResponse
            }
            
            message.setDeleted(true);
            chatMessageRepository.save(message);
        } else {
            throw new RuntimeException("Нет прав на удаление сообщения");
        }
    }

    public List<ChatMessageResponse> getAllMessages() {
        // Получаем все активные сообщения
        List<ChatMessage> activeMessages = chatMessageRepository.findAllActiveMessages();
        
        // Находим все удаленные сообщения, на которые есть ответы (для сохранения информации об отправителе)
        List<ChatMessage> deletedWithReplies = chatMessageRepository.findAll().stream()
                .filter(m -> m.getDeleted() && activeMessages.stream()
                        .anyMatch(am -> am.getReplyToMessage() != null && 
                                      am.getReplyToMessage().getId().equals(m.getId())))
                .collect(Collectors.toList());
        
        // Объединяем активные сообщения и удаленные, на которые есть ответы (для получения информации об отправителе)
        List<ChatMessage> allMessages = new ArrayList<>(activeMessages);
        allMessages.addAll(deletedWithReplies);
        
        // Маппим в ответы - удаленные сообщения не будут показаны, но информация о них сохранится в ответах
        return allMessages.stream()
                .distinct()
                .sorted((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                .map(this::mapToResponse)
                .filter(msg -> !msg.getDeleted()) // Фильтруем удаленные сообщения из результата
                .collect(Collectors.toList());
    }

    public ChatMessageResponse getMessageById(Long messageId) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatMessage", "id", messageId));
        return mapToResponse(message);
    }

    private ChatMessageResponse mapToResponse(ChatMessage message) {
        ChatMessageResponse.ChatMessageResponseBuilder builder = ChatMessageResponse.builder()
                .id(message.getId())
                .senderId(message.getSender().getId())
                .senderUsername(message.getSender().getUsername())
                .senderFirstName(message.getSender().getFirstName())
                .senderLastName(message.getSender().getLastName())
                .messageText(message.getMessageText())
                .imageUrl(message.getImageUrl())
                .createdAt(message.getCreatedAt())
                .deleted(message.getDeleted());

        if (message.getAssignedAdmin() != null) {
            builder.assignedAdminId(message.getAssignedAdmin().getId())
                    .assignedAdminUsername(message.getAssignedAdmin().getUsername())
                    .assignedAdminFirstName(message.getAssignedAdmin().getFirstName())
                    .assignedAdminLastName(message.getAssignedAdmin().getLastName());
        }

        if (message.getReplyToMessage() != null) {
            ChatMessage originalMessage = message.getReplyToMessage();
            builder.replyToMessageId(originalMessage.getId());
            builder.originalSenderId(originalMessage.getSender().getId());
            builder.originalSenderUsername(originalMessage.getSender().getUsername());
            builder.originalSenderFirstName(originalMessage.getSender().getFirstName());
            builder.originalSenderLastName(originalMessage.getSender().getLastName());
            builder.originalMessageDeleted(originalMessage.getDeleted());
            
            // Если исходное сообщение удалено, добавляем пометку в текст
            if (originalMessage.getDeleted()) {
                String originalText = message.getMessageText();
                if (originalText != null && !originalText.contains("ответ на удаленное сообщение")) {
                    builder.messageText(originalText + " [ответ на удаленное сообщение]");
                }
            }
        }

        return builder.build();
    }
}

