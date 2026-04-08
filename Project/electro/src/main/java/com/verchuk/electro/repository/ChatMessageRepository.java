package com.verchuk.electro.repository;

import com.verchuk.electro.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    @Query("SELECT m FROM ChatMessage m WHERE m.deleted = false ORDER BY m.createdAt ASC")
    List<ChatMessage> findAllActiveMessages();
    
    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.sender.id = :userId")
    long countBySenderId(Long userId);
    
    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.assignedAdmin.id = :userId")
    long countByAssignedAdminId(Long userId);
}

