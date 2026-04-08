package com.verchuk.electro.config;

import com.verchuk.electro.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.security.Principal;

@Configuration
@EnableWebSocketMessageBroker
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
public class WebSocketSecurityConfig implements WebSocketMessageBrokerConfigurer {

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private UserDetailsService userDetailsService;

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    // Проверяем, есть ли уже аутентификация в SecurityContext
                    org.springframework.security.core.context.SecurityContext securityContext = 
                        org.springframework.security.core.context.SecurityContextHolder.getContext();
                    Authentication existingAuth = securityContext.getAuthentication();
                    
                    if (existingAuth != null && existingAuth.isAuthenticated()) {
                        // Используем существующую аутентификацию
                        accessor.setUser(existingAuth);
                    } else {
                        // Пытаемся получить токен из заголовков STOMP
                        String token = null;
                        String authHeader = accessor.getFirstNativeHeader("Authorization");
                        if (authHeader != null && authHeader.startsWith("Bearer ")) {
                            token = authHeader.substring(7);
                        }
                        
                        // Если токен не найден в заголовках, пытаемся получить из query параметров
                        if (token == null) {
                            // SockJS передает query параметры через заголовок
                            java.util.List<String> queryHeaders = accessor.getNativeHeader("query");
                            if (queryHeaders != null && !queryHeaders.isEmpty()) {
                                String query = queryHeaders.get(0);
                                if (query != null && query.contains("token=")) {
                                    token = query.substring(query.indexOf("token=") + 6);
                                    int endIndex = token.indexOf("&");
                                    if (endIndex > 0) {
                                        token = token.substring(0, endIndex);
                                    }
                                }
                            }
                        }
                        
                        if (token != null) {
                            try {
                                String username = jwtUtils.extractUsername(token);
                                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                                if (jwtUtils.validateToken(token, userDetails)) {
                                    Authentication authentication = new UsernamePasswordAuthenticationToken(
                                            userDetails, null, userDetails.getAuthorities());
                                    accessor.setUser(authentication);
                                }
                            } catch (Exception e) {
                                // Игнорируем ошибки аутентификации
                            }
                        }
                    }
                }
                return message;
            }
        });
    }
}

