import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fileAPI, chatAPI } from '../api/api';
import Modal from '../components/UI/Modal';
import ImageModal from '../components/ImageModal/ImageModal';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import './Support.css';

const Support = () => {
  const { user, isDesigner, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [stompClient, setStompClient] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null); // Для админа: выбранный пользователь
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [alertModal, setAlertModal] = useState({ show: false, message: '' });
  const [selectedImage, setSelectedImage] = useState(null);

  // Группировка сообщений по пользователям (для админа)
  const getConversations = () => {
    if (!isAdmin()) return [];
    
    const conversationsMap = new Map();
    const adminIds = new Set(); // Собираем ID всех админов
    const currentAdminId = user?.id; // ID текущего админа
    
    // Сначала находим всех админов - проверяем, кто отвечал на сообщения
    messages.forEach(msg => {
      if (msg.assignedAdminId) {
        adminIds.add(msg.assignedAdminId);
      }
    });
    
    // Также проверяем, есть ли сообщения от админов (которые отвечали)
    messages.forEach(msg => {
      // Если это ответ на сообщение и отправитель - админ
      if (msg.replyToMessageId && adminIds.has(msg.senderId)) {
        adminIds.add(msg.senderId);
      }
      // Если отправитель - текущий админ, добавляем его в список админов
      if (msg.senderId === currentAdminId) {
        adminIds.add(msg.senderId);
      }
    });
    
    messages.forEach(msg => {
      // Пропускаем приветственные сообщения (системные)
      const isWelcomeMessage = msg.messageText && 
        msg.messageText.includes('Добро пожаловать в систему ElectroPlanner');
      if (isWelcomeMessage) return;
      
      // Пропускаем сообщения от админов (они не создают беседы)
      if (adminIds.has(msg.senderId)) {
        // Но если это ответ на сообщение пользователя, учитываем исходное сообщение
        if (msg.replyToMessageId) {
          // Используем originalSenderId, если исходное сообщение удалено
          let userId = null;
          let userName = null;
          
          if (msg.originalSenderId && msg.originalMessageDeleted) {
            // Исходное сообщение удалено, используем сохраненную информацию
            userId = msg.originalSenderId;
            userName = msg.originalSenderFirstName || msg.originalSenderUsername;
          } else {
            // Исходное сообщение не удалено, ищем его в списке
            const originalMsg = messages.find(m => m.id === msg.replyToMessageId);
            if (originalMsg && !adminIds.has(originalMsg.senderId)) {
              userId = originalMsg.senderId;
              userName = originalMsg.senderFirstName || originalMsg.senderUsername;
            }
          }
          
          // Важно: ответы админа создают беседу только с пользователем, не с самим админом
          // Проверяем, что userId не является админом и не совпадает с отправителем ответа
          if (userId && !adminIds.has(userId) && userId !== msg.senderId) {
            if (!conversationsMap.has(userId)) {
              conversationsMap.set(userId, {
                userId,
                userName,
                lastMessage: msg,
                unreadCount: 0
              });
            } else {
              const conv = conversationsMap.get(userId);
              if (new Date(msg.createdAt) > new Date(conv.lastMessage.createdAt)) {
                conv.lastMessage = msg;
              }
            }
          }
        }
        return;
      }
      
      // Сообщение от пользователя (не админа, не удаленное)
      if (msg.deleted) return; // Пропускаем удаленные сообщения
      
      const userId = msg.senderId;
      const userName = msg.senderFirstName || msg.senderUsername;
      
      // Не создаем беседу, если это админ
      if (adminIds.has(userId)) return;
      
      if (!conversationsMap.has(userId)) {
        conversationsMap.set(userId, {
          userId,
          userName,
          lastMessage: msg,
          unreadCount: 0
        });
      } else {
        const conv = conversationsMap.get(userId);
        if (new Date(msg.createdAt) > new Date(conv.lastMessage.createdAt)) {
          conv.lastMessage = msg;
        }
      }
    });
    
    return Array.from(conversationsMap.values())
      .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
  };

  // Получить сообщения для текущей беседы
  const getCurrentConversationMessages = () => {
    if (isAdmin() && selectedConversation) {
      // Для админа: показываем сообщения выбранного пользователя и ответы админов на них
      return messages.filter(msg => {
        // Пропускаем приветственные сообщения
        const isWelcomeMessage = msg.messageText && 
          msg.messageText.includes('Добро пожаловать в систему ElectroPlanner');
        if (isWelcomeMessage) return false;
        
        // Сообщения от выбранного пользователя (не удаленные)
        if (msg.senderId === selectedConversation && !msg.deleted) return true;
        // Ответы админов на сообщения этого пользователя
        if (msg.replyToMessageId) {
          // Если исходное сообщение удалено, используем originalSenderId
          if (msg.originalMessageDeleted && msg.originalSenderId === selectedConversation) {
            return true;
          }
          // Иначе ищем исходное сообщение в списке (даже если оно удалено)
          const repliedMsg = messages.find(m => m.id === msg.replyToMessageId);
          if (repliedMsg && repliedMsg.senderId === selectedConversation) return true;
        }
        return false;
      }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    // Для пользователя - все его сообщения (включая приветственное) и ответы на них
    return messages.filter(msg => {
      // Показываем приветственное сообщение от админа только если оно предназначено для текущего пользователя
      const isWelcomeMessage = msg.messageText && 
        msg.messageText.includes('Добро пожаловать в систему ElectroPlanner');
      if (isWelcomeMessage && !msg.deleted) {
        // Приветственное сообщение видит только тот пользователь, для которого оно предназначено (assignedAdminId)
        return msg.assignedAdminId === user?.id;
      }
      
      // Показываем только не удаленные сообщения от пользователя
      if (msg.senderId === user?.id && !msg.deleted) return true;
      
      // Показываем ответы админов на сообщения пользователя
      if (msg.replyToMessageId) {
        // Если исходное сообщение удалено, используем originalSenderId
        if (msg.originalMessageDeleted && msg.originalSenderId === user?.id) {
          return true;
        }
        // Иначе ищем исходное сообщение в списке (даже если оно удалено)
        const repliedMsg = messages.find(m => m.id === msg.replyToMessageId);
        if (repliedMsg && repliedMsg.senderId === user?.id) return true;
      }
      return false;
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  };

  useEffect(() => {
    if (!isDesigner() && !isAdmin()) {
      navigate('/');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;
    
    const wsUrl = `http://localhost:8080/ws?token=${encodeURIComponent(token)}`;
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      debug: (str) => {
        console.log('STOMP:', str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: (frame) => {
        setStompClient(client);
        
        client.subscribe('/topic/messages', (message) => {
          const newMsg = JSON.parse(message.body);
          setMessages(prev => {
            const existingIndex = prev.findIndex(m => m.id === newMsg.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = newMsg;
              return updated;
            }
            return [...prev, newMsg];
          });
        });
        
        client.subscribe('/topic/messages/deleted', (messageId) => {
          const id = JSON.parse(messageId.body);
          // Если админ, перезагружаем сообщения, чтобы получить актуальное состояние (включая удаленные ответы)
          if (isAdmin()) {
            loadMessages();
          } else {
            // Если обычный пользователь, обновляем локально
            setMessages(prev => {
              const deletedMsg = prev.find(m => m.id === id);
              return prev.map(msg => {
                // Если это удаленное сообщение, помечаем его как deleted
                if (msg.id === id) {
                  return { ...msg, deleted: true };
                }
                // Если это ответ на удаленное сообщение, обновляем текст
                if (msg.replyToMessageId === id) {
                  const updatedText = msg.messageText && !msg.messageText.includes("ответ на удаленное сообщение")
                    ? msg.messageText + " [ответ на удаленное сообщение]"
                    : msg.messageText;
                  return { 
                    ...msg, 
                    messageText: updatedText,
                    originalMessageDeleted: true,
                    originalSenderId: msg.originalSenderId || deletedMsg?.senderId,
                    originalSenderUsername: msg.originalSenderUsername || deletedMsg?.senderUsername,
                    originalSenderFirstName: msg.originalSenderFirstName || deletedMsg?.senderFirstName,
                    originalSenderLastName: msg.originalSenderLastName || deletedMsg?.senderLastName
                  };
                }
                return msg;
              }).filter(m => !m.deleted); // Удаляем удаленные сообщения из списка
            });
          }
        });
        
        loadMessages();
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame);
      },
      onWebSocketError: (error) => {
        console.error('WebSocket error:', error);
      }
    });

    client.activate();

    return () => {
      if (client && client.connected) {
        client.deactivate();
      }
    };
  }, [isDesigner, isAdmin, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedConversation]);

  useEffect(() => {
    // Для админа: автоматически выбираем первую беседу, если не выбрана
    if (isAdmin() && !selectedConversation && messages.length > 0) {
      const conversations = getConversations();
      if (conversations.length > 0) {
        setSelectedConversation(conversations[0].userId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isAdmin, selectedConversation]);

  // Автоматически выбираем первое сообщение пользователя для ответа при выборе беседы
  useEffect(() => {
    if (isAdmin() && selectedConversation) {
      const currentMessages = getCurrentConversationMessages();
      
      // Проверяем, есть ли уже ответы админа в этой беседе
      const hasAdminReplies = currentMessages.some(msg => 
        msg.senderId === user?.id && msg.replyToMessageId
      );
      
      // Проверяем, указывает ли текущий replyingTo на сообщение из выбранной беседы
      let shouldUpdateReplyingTo = false;
      if (replyingTo) {
        const currentReplyingMsg = messages.find(m => m.id === replyingTo);
        // Если replyingTo указывает на сообщение из другой беседы или не найдено, нужно обновить
        if (!currentReplyingMsg || currentReplyingMsg.senderId !== selectedConversation) {
          shouldUpdateReplyingTo = true;
        }
      } else {
        // Если replyingTo не установлено, нужно установить для первой беседы
        shouldUpdateReplyingTo = !hasAdminReplies;
      }
      
      // Если нужно обновить, находим первое сообщение от выбранного пользователя
      if (shouldUpdateReplyingTo) {
        const firstUserMessage = currentMessages.find(msg => 
          msg.senderId === selectedConversation && 
          !msg.assignedAdminId && // Не ответ админа
          !msg.deleted // Не удаленное
        );
        if (firstUserMessage) {
          setReplyingTo(firstUserMessage.id);
        } else {
          // Если нет сообщений от пользователя, сбрасываем replyingTo
          setReplyingTo(null);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation, isAdmin, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const response = await chatAPI.getAllMessages();
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (replyToId = null) => {
    const messageToSend = replyToId ? newMessage : newMessage.trim();
    if (!messageToSend && !uploadingImage) return;
    if (!stompClient || !stompClient.connected) return;

    // Для админа: проверяем, может ли он писать в этой беседе
    if (isAdmin()) {
      if (!selectedConversation) {
        setAlertModal({ show: true, message: 'Выберите беседу с пользователем для отправки сообщения' });
        return;
      }
      
      // Проверяем, есть ли уже ответы админа в этой беседе
      const currentMessages = getCurrentConversationMessages();
      const hasAdminReplies = currentMessages.some(msg => 
        msg.senderId === user?.id && msg.replyToMessageId
      );
      
      const replyId = replyToId || replyingTo;
      
      // Если это первое сообщение админа в беседе, нужен replyToMessageId
      if (!hasAdminReplies && !replyId) {
        setAlertModal({ show: true, message: 'Для первого сообщения необходимо ответить на сообщение пользователя. Нажмите кнопку "Ответить" на сообщении.' });
        return;
      }
      
      // Если есть replyId, проверяем что это сообщение от выбранного пользователя
      if (replyId) {
        const repliedMessage = messages.find(m => m.id === replyId);
        if (!repliedMessage) {
          setAlertModal({ show: true, message: 'Сообщение для ответа не найдено. Выберите сообщение пользователя и нажмите "Ответить".' });
          return;
        }
        // Проверяем, что это сообщение от выбранного пользователя, а не от админа или другого пользователя
        if (repliedMessage.senderId === user?.id) {
          setAlertModal({ show: true, message: 'Можно отвечать только на сообщения пользователей, а не на свои собственные сообщения' });
          return;
        }
        if (repliedMessage.senderId !== selectedConversation) {
          setAlertModal({ show: true, message: 'Вы пытаетесь ответить на сообщение из другой беседы. Выберите сообщение из текущей беседы.' });
          return;
        }
      }
    }

    try {
      let finalReplyToId = replyToId || replyingTo;
      
      // Для админа: если нет replyToId, но есть ответы в беседе, используем последнее сообщение пользователя
      if (isAdmin() && !finalReplyToId && selectedConversation) {
        const currentMessages = getCurrentConversationMessages();
        const hasAdminReplies = currentMessages.some(msg => 
          msg.senderId === user?.id && msg.replyToMessageId
        );
        
        if (hasAdminReplies) {
          // Находим последнее сообщение от пользователя
          const userMessages = currentMessages.filter(msg => 
            msg.senderId === selectedConversation && !msg.deleted
          );
          if (userMessages.length > 0) {
            // Берем последнее сообщение пользователя
            const lastUserMessage = userMessages[userMessages.length - 1];
            finalReplyToId = lastUserMessage.id;
          }
        }
      }
      
      const messageData = {
        messageText: messageToSend || null,
        replyToMessageId: finalReplyToId || null
      };

      await chatAPI.createMessage(messageData);
      setNewMessage('');
      // Не сбрасываем replyingTo, если админ уже отвечал в беседе
      if (!isAdmin() || !selectedConversation) {
        setReplyingTo(null);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка отправки сообщения';
      setAlertModal({ show: true, message: errorMessage });
    }
  };

  const handleReply = (messageId) => {
    setReplyingTo(messageId);
    setTimeout(() => {
      const input = document.querySelector('.support-input');
      if (input) input.focus();
    }, 100);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAlertModal({ show: true, message: 'Пожалуйста, выберите изображение' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAlertModal({ show: true, message: 'Размер файла не должен превышать 10MB' });
      return;
    }

    setUploadingImage(true);
    try {
      const response = await fileAPI.upload(file, 'chat');
      let imageUrl = null;
      if (response.data && response.data.data) {
        imageUrl = typeof response.data.data === 'string' 
          ? response.data.data 
          : String(response.data.data);
      } else if (response.data && typeof response.data === 'string') {
        imageUrl = response.data;
      }

      if (imageUrl && !imageUrl.startsWith('http')) {
        // Если уже начинается с /api/files/, не добавляем еще раз
        if (!imageUrl.startsWith('/api/files/')) {
          imageUrl = `/api/files/${imageUrl}`;
        }
      }

      // Для админа: проверяем, может ли он писать в этой беседе
      if (isAdmin()) {
        if (!selectedConversation) {
          setAlertModal({ show: true, message: 'Выберите беседу с пользователем для отправки сообщения' });
          setUploadingImage(false);
          return;
        }
        
        // Проверяем, есть ли уже ответы админа в этой беседе
        const currentMessages = getCurrentConversationMessages();
        const hasAdminReplies = currentMessages.some(msg => 
          msg.senderId === user?.id && msg.replyToMessageId
        );
        
        // Если это первое сообщение админа в беседе, нужен replyingTo
        if (!hasAdminReplies && !replyingTo) {
          setAlertModal({ show: true, message: 'Для первого сообщения необходимо ответить на сообщение пользователя. Нажмите кнопку "Ответить" на сообщении.' });
          setUploadingImage(false);
          return;
        }
        
        // Если есть replyingTo, проверяем что это сообщение от выбранного пользователя
        if (replyingTo) {
          const repliedMessage = messages.find(m => m.id === replyingTo);
          if (!repliedMessage) {
            setAlertModal({ show: true, message: 'Сообщение для ответа не найдено. Выберите сообщение пользователя и нажмите "Ответить".' });
            setUploadingImage(false);
            return;
          }
          // Проверяем, что это сообщение от выбранного пользователя, а не от админа или другого пользователя
          if (repliedMessage.senderId === user?.id) {
            setAlertModal({ show: true, message: 'Можно отвечать только на сообщения пользователей, а не на свои собственные сообщения' });
            setUploadingImage(false);
            return;
          }
          if (repliedMessage.senderId !== selectedConversation) {
            setAlertModal({ show: true, message: 'Вы пытаетесь ответить на сообщение из другой беседы. Выберите сообщение из текущей беседы.' });
            setUploadingImage(false);
            return;
          }
        }
      }

      if (stompClient && stompClient.connected) {
        let finalReplyToId = replyingTo;
        
        // Для админа: если нет replyingTo, но есть ответы в беседе, используем последнее сообщение пользователя
        if (isAdmin() && !finalReplyToId && selectedConversation) {
          const currentMessages = getCurrentConversationMessages();
          const hasAdminReplies = currentMessages.some(msg => 
            msg.senderId === user?.id && msg.replyToMessageId
          );
          
          if (hasAdminReplies) {
            // Находим последнее сообщение от пользователя
            const userMessages = currentMessages.filter(msg => 
              msg.senderId === selectedConversation && !msg.deleted
            );
            if (userMessages.length > 0) {
              // Берем последнее сообщение пользователя
              const lastUserMessage = userMessages[userMessages.length - 1];
              finalReplyToId = lastUserMessage.id;
            }
          }
        }
        
        const messageData = {
          messageText: newMessage.trim() || null,
          imageUrl: imageUrl,
          replyToMessageId: finalReplyToId || null
        };

        await chatAPI.createMessage(messageData);
        setNewMessage('');
        // Не сбрасываем replyingTo, если админ уже отвечал в беседе
        if (!isAdmin() || !selectedConversation) {
          setReplyingTo(null);
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setAlertModal({ show: true, message: 'Ошибка загрузки изображения' });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await chatAPI.deleteMessage(messageId);
      // Если админ удаляет сообщение, перезагружаем сообщения, чтобы получить актуальное состояние (включая удаленные ответы)
      if (isAdmin()) {
        loadMessages();
      } else {
        // Если обычный пользователь удаляет свое сообщение, обновляем локально
        setMessages(prev => prev.map(msg => {
          // Если это удаленное сообщение, помечаем его как deleted
          if (msg.id === messageId) {
            return { ...msg, deleted: true };
          }
          // Если это ответ на удаленное сообщение, обновляем текст
          if (msg.replyToMessageId === messageId) {
            const deletedMsg = prev.find(m => m.id === messageId);
            const updatedText = msg.messageText && !msg.messageText.includes("ответ на удаленное сообщение")
              ? msg.messageText + " [ответ на удаленное сообщение]"
              : msg.messageText;
            return { 
              ...msg, 
              messageText: updatedText,
              originalMessageDeleted: true,
              originalSenderId: msg.originalSenderId || deletedMsg?.senderId,
              originalSenderUsername: msg.originalSenderUsername || deletedMsg?.senderUsername,
              originalSenderFirstName: msg.originalSenderFirstName || deletedMsg?.senderFirstName,
              originalSenderLastName: msg.originalSenderLastName || deletedMsg?.senderLastName
            };
          }
          return msg;
        }).filter(m => !m.deleted)); // Удаляем удаленные сообщения из списка
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    if (imageUrl.startsWith('/api/files/')) {
      return `http://localhost:8080${imageUrl}`;
    }
    
    if (imageUrl.startsWith('/')) {
      return `http://localhost:8080${imageUrl}`;
    }
    
    return `http://localhost:8080/api/files/${imageUrl}`;
  };

  const currentMessages = getCurrentConversationMessages();
  const conversations = getConversations();

  if (!isDesigner() && !isAdmin()) return null;

  return (
    <div className="support-page">
      <div className="support-container">
        {isAdmin() && (
          <div className="support-sidebar">
            <h3>Беседы</h3>
            <div className="conversations-list">
              {conversations.length === 0 ? (
                <div className="no-conversations">Нет активных бесед</div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.userId}
                    className={`conversation-item ${selectedConversation === conv.userId ? 'active' : ''}`}
                    onClick={() => setSelectedConversation(conv.userId)}
                  >
                    <div className="conversation-avatar">
                      {conv.userName[0].toUpperCase()}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-name">{conv.userName}</div>
                      <div className="conversation-preview">
                        {conv.lastMessage.messageText 
                          ? (conv.lastMessage.messageText.length > 30 
                              ? conv.lastMessage.messageText.substring(0, 30) + '...' 
                              : conv.lastMessage.messageText)
                          : '📷 Изображение'}
                      </div>
                    </div>
                    <div className="conversation-time">
                      {formatTime(conv.lastMessage.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="support-main">
          <div className="support-header">
            <h2>Чат поддержки</h2>
            {isAdmin() && selectedConversation && (
              <div className="support-header-user">
                Беседа с: {conversations.find(c => c.userId === selectedConversation)?.userName}
              </div>
            )}
          </div>
          
          <div className="support-messages">
            {currentMessages.length === 0 ? (
              <div className="support-empty">Нет сообщений</div>
            ) : (
              currentMessages.map((msg, index) => {
                const prevMsg = index > 0 ? currentMessages[index - 1] : null;
                const showDate = !prevMsg || 
                  formatDate(prevMsg.createdAt) !== formatDate(msg.createdAt);
                
                const isMyMessage = msg.senderId === user?.id;
                const canReply = isAdmin() && !isMyMessage && !msg.assignedAdminId;
                const isReplying = replyingTo === msg.id;
                
                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div className="message-date-divider">
                        {formatDate(msg.createdAt)}
                      </div>
                    )}
                    <div 
                      className={`support-message ${isMyMessage ? 'own' : 'other'} ${isReplying ? 'replying' : ''} ${msg.assignedAdminId ? 'assigned' : ''}`}
                    >
                      {msg.replyToMessageId && (
                        <div className="message-reply-indicator">
                          {msg.originalMessageDeleted ? (
                            <span style={{ color: '#999', fontStyle: 'italic' }}>
                              Ответ на удаленное сообщение
                            </span>
                          ) : (
                            `Ответ на сообщение #${msg.replyToMessageId}`
                          )}
                        </div>
                      )}
                      <div className="message-header">
                        <div className="message-sender-info">
                          <span className="message-sender">
                            {msg.senderFirstName || msg.senderUsername}
                          </span>
                          {msg.assignedAdminId && (
                            <span className="message-assigned">
                              → {msg.assignedAdminFirstName || msg.assignedAdminUsername}
                            </span>
                          )}
                        </div>
                        <div className="message-actions">
                          {canReply && (
                            <>
                              <button 
                                className="message-reply-btn"
                                onClick={() => handleReply(msg.id)}
                                title="Ответить на сообщение"
                              >
                                Ответить
                              </button>
                              {msg.imageUrl && (
                                <button 
                                  className="message-reply-btn"
                                  onClick={() => {
                                    setReplyingTo(msg.id);
                                    fileInputRef.current?.click();
                                  }}
                                  title="Ответить фотографией"
                                >
                                  📷 Ответить фото
                                </button>
                              )}
                            </>
                          )}
                          <span className="message-time">{formatTime(msg.createdAt)}</span>
                          {(isMyMessage || isAdmin()) && (
                            <button 
                              className="message-delete-btn"
                              onClick={() => deleteMessage(msg.id)}
                              title="Удалить сообщение"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                      {msg.imageUrl && (
                        <div className="message-image">
                          <img 
                            src={getImageUrl(msg.imageUrl)} 
                            alt="Сообщение в чате" 
                            onClick={() => setSelectedImage(getImageUrl(msg.imageUrl))}
                            style={{ cursor: 'pointer' }}
                            onError={(e) => {
                              console.error('Image load error:', msg.imageUrl);
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      {msg.messageText && (
                        <div className="message-text">{msg.messageText}</div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="support-input-container">
            {replyingTo && (
              <div className="support-reply-indicator">
                <span>Отвечаете на сообщение #{replyingTo}</span>
                <button onClick={() => setReplyingTo(null)}>✕</button>
              </div>
            )}
            <div className="support-input-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <button
                className="support-image-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                title="Отправить изображение"
              >
                {uploadingImage ? '...' : '📷'}
              </button>
              <input
                type="text"
                className="support-input"
                placeholder={replyingTo ? `Ответить на сообщение #${replyingTo}...` : "Введите сообщение..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage(replyingTo)}
              />
              <button
                className="support-send-btn"
                onClick={() => sendMessage(replyingTo)}
                disabled={!newMessage.trim() && !uploadingImage}
                title=""
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        show={alertModal.show}
        title="Информация"
        type="info"
        onClose={() => setAlertModal({ show: false, message: '' })}
        cancelText="Ок"
      >
        <p>{alertModal.message}</p>
      </Modal>
      <ImageModal
        show={!!selectedImage}
        imageUrl={selectedImage}
        alt="Изображение из чата"
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
};

export default Support;

