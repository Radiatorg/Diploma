import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fileAPI, chatAPI } from '../../api/api';
import Modal from '../UI/Modal';
import ImageModal from '../ImageModal/ImageModal';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import './ChatWidget.css';

const ChatWidget = () => {
  const { user, isDesigner, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [stompClient, setStompClient] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // ID сообщения, на которое отвечаем
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [alertModal, setAlertModal] = useState({ show: false, message: '' });
  const [selectedImage, setSelectedImage] = useState(null); // URL изображения для модального окна

  useEffect(() => {
    if (!isDesigner() && !isAdmin()) return;

    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Подключение к WebSocket с токеном в query параметре
    // SockJS передает query параметры в HTTP handshake запросе
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
        
        // Подписка на новые сообщения
        client.subscribe('/topic/messages', (message) => {
          const newMsg = JSON.parse(message.body);
          setMessages(prev => {
            // Для пользователей (не админов) фильтруем сообщения
            if (!isAdmin()) {
              // Проверяем, должно ли это сообщение быть видимым для пользователя
              const isWelcomeMessage = newMsg.messageText && 
                newMsg.messageText.includes('Добро пожаловать в систему ElectroPlanner');
              const isMyMessage = newMsg.senderId === user?.id;
              const isReplyToMyMessage = newMsg.replyToMessageId && prev.some(m => 
                m.id === newMsg.replyToMessageId && m.senderId === user?.id
              );
              
              // Показываем только приветственное сообщение, свои сообщения и ответы на свои сообщения
              if (!isWelcomeMessage && !isMyMessage && !isReplyToMyMessage) {
                return prev; // Не добавляем чужое сообщение
              }
            }
            
            // Обновляем существующее сообщение или добавляем новое
            const existingIndex = prev.findIndex(m => m.id === newMsg.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = newMsg;
              return updated;
            }
            return [...prev, newMsg];
          });
        });
        
        // Подписка на удаленные сообщения
        client.subscribe('/topic/messages/deleted', (messageId) => {
          const id = JSON.parse(messageId.body);
          setMessages(prev => {
            // Помечаем сообщение как удаленное и обновляем ответы на него
            return prev.map(msg => {
              // Если это удаленное сообщение, помечаем его как deleted
              if (msg.id === id) {
                return { ...msg, deleted: true };
              }
              // Если это ответ на удаленное сообщение, обновляем текст
              if (msg.replyToMessageId === id) {
                const deletedMsg = prev.find(m => m.id === id);
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
            }).filter(m => !m.deleted); // Удаляем удаленные сообщения из списка, но ответы остаются
          });
        });
        
        // Загружаем историю сообщений
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
  }, [isDesigner, isAdmin]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const response = await chatAPI.getAllMessages();
      const allMessages = response.data || [];
      
      // Для пользователей (не админов) фильтруем сообщения - показываем только свои и ответы на них
      if (!isAdmin()) {
        const filteredMessages = allMessages.filter(msg => {
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
            // Иначе ищем исходное сообщение в списке
            const repliedMsg = allMessages.find(m => m.id === msg.replyToMessageId);
            if (repliedMsg && repliedMsg.senderId === user?.id) return true;
          }
          return false;
        });
        setMessages(filteredMessages);
      } else {
        // Для админов показываем все сообщения
        setMessages(allMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (replyToId = null) => {
    const messageToSend = replyToId ? newMessage : newMessage.trim();
    if (!messageToSend && !uploadingImage) return;
    if (!stompClient || !stompClient.connected) return;

    try {
      const messageData = {
        messageText: messageToSend || null,
        replyToMessageId: replyToId || replyingTo || null
      };

      await chatAPI.createMessage(messageData);
      setNewMessage('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleReply = (messageId) => {
    setReplyingTo(messageId);
    // Фокус на поле ввода
    setTimeout(() => {
      const input = document.querySelector('.chat-input');
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

      if (stompClient && stompClient.connected) {
        const messageData = {
          messageText: newMessage.trim() || null,
          imageUrl: imageUrl,
          replyToMessageId: replyingTo || null
        };

        await chatAPI.createMessage(messageData);
        setNewMessage('');
        setReplyingTo(null);
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
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    
    // Если уже полный URL
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // Если начинается с /api/files, добавляем только хост
    if (imageUrl.startsWith('/api/files/')) {
      return `http://localhost:8080${imageUrl}`;
    }
    
    // Если просто имя файла или путь без /api/files
    if (imageUrl.startsWith('/')) {
      return `http://localhost:8080${imageUrl}`;
    }
    
    // Если просто имя файла без слеша
    return `http://localhost:8080/api/files/${imageUrl}`;
  };

  if (!isDesigner() && !isAdmin()) return null;

  return (
    <>
      <button 
        className={`chat-widget-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
          } else {
            // Открываем маленький виджет
            setIsOpen(true);
          }
        }}
        title="Обратиться за помощью к администратору"
      >
        {isOpen ? '✕' : 'Чат'}
      </button>

      {isOpen && (
        <div className="chat-widget-container">
          <div className="chat-widget-header">
            <h3>Чат поддержки</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                onClick={() => {
                  window.location.href = '/support';
                }}
                className="chat-go-to-full-btn"
                title="Перейти к полному чату"
              >
                Перейти к чату
              </button>
              <button onClick={() => setIsOpen(false)} className="chat-close-btn">✕</button>
            </div>
          </div>
          
          <div className="chat-messages">
            {messages.filter(msg => !msg.deleted).length === 0 ? (
              <div className="chat-empty">Нет сообщений</div>
            ) : (
              messages.filter(msg => !msg.deleted).map((msg) => {
                const isDesignerMessage = !msg.assignedAdminId; // Сообщение от дизайнера без назначенного админа
                const isMyMessage = msg.senderId === user?.id;
                const canReply = isAdmin() && !isMyMessage && isDesignerMessage;
                const isReplying = replyingTo === msg.id;
                
                return (
                  <div 
                    key={msg.id} 
                    className={`chat-message ${isMyMessage ? 'own' : 'other'} ${isReplying ? 'replying' : ''} ${msg.assignedAdminId ? 'assigned' : ''}`}
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
                            console.error('Image load error:', msg.imageUrl, 'Full URL:', getImageUrl(msg.imageUrl));
                            e.target.style.display = 'none';
                            const errorDiv = document.createElement('div');
                            errorDiv.textContent = 'Ошибка загрузки изображения';
                            errorDiv.style.padding = '10px';
                            errorDiv.style.color = '#c62828';
                            e.target.parentElement.appendChild(errorDiv);
                          }}
                        />
                      </div>
                    )}
                    {msg.messageText && (
                      <div className="message-text">{msg.messageText}</div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            {replyingTo && (
              <div className="chat-reply-indicator">
                <span>Отвечаете на сообщение #{replyingTo}</span>
                <button onClick={() => setReplyingTo(null)}>✕</button>
              </div>
            )}
            <div className="chat-input-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <button
                className="chat-image-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                title="Отправить изображение"
              >
                {uploadingImage ? '...' : 'Изобр.'}
              </button>
              <input
                type="text"
                className="chat-input"
                placeholder={replyingTo ? `Ответить на сообщение #${replyingTo}...` : "Введите сообщение..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage(replyingTo)}
              />
              <button
                className="chat-send-btn"
                onClick={() => sendMessage(replyingTo)}
                disabled={!newMessage.trim() && !uploadingImage}
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}
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
    </>
  );
};

export default ChatWidget;

