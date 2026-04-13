package com.verchuk.electro.service;

import com.verchuk.electro.dto.request.UserUpdateRequest;
import com.verchuk.electro.dto.response.UserResponse;
import com.verchuk.electro.exception.BadRequestException;
import com.verchuk.electro.exception.ResourceNotFoundException;
import com.verchuk.electro.model.Role;
import com.verchuk.electro.model.User;
import com.verchuk.electro.repository.ChatMessageRepository;
import com.verchuk.electro.repository.ProjectRepository;
import com.verchuk.electro.repository.RoleRepository;
import com.verchuk.electro.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @Autowired
    private ChatMessageRepository chatMessageRepository;
    
    @Autowired
    private ProjectRepository projectRepository;
    
    @Autowired
    private com.verchuk.electro.repository.SavedSpecificationRepository savedSpecificationRepository;
    
    @Autowired
    private com.verchuk.electro.repository.FloorPlanRepository floorPlanRepository;

    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
    }

    public UserResponse getCurrentUserProfile() {
        return UserResponse.fromUser(getCurrentUser());
    }

    @Transactional
    public UserResponse updateCurrentUserProfile(UserUpdateRequest request) {
        User user = getCurrentUser();

        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new BadRequestException("Email is already in use!");
            }
            user.setEmail(request.getEmail());
        }

        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName());
        }

        if (request.getLastName() != null) {
            user.setLastName(request.getLastName());
        }

        if (request.getPhotoUrl() != null) {
            // Если передана пустая строка, удаляем фото (устанавливаем null)
            if (request.getPhotoUrl().isEmpty()) {
                user.setPhotoUrl(null);
            } else {
                user.setPhotoUrl(request.getPhotoUrl());
            }
        }
        if (request.getPhoneNumber() != null) {
            user.setPhoneNumber(request.getPhoneNumber());
        }
        if (request.getBirthDate() != null) {
            user.setBirthDate(request.getBirthDate());
        }
        return UserResponse.fromUser(userRepository.save(user));
    }

    @Transactional
    public void deleteCurrentUser() {
        User user = getCurrentUser();
        Long userId = user.getId();
        
        // Проверяем, является ли пользователь главным админом (username="admin")
        if ("admin".equals(user.getUsername())) {
            throw new BadRequestException("Главный администратор не может удалить свой профиль");
        }
        
        // Проверяем, является ли пользователь администратором
        boolean isAdmin = user.getRoles().stream()
                .anyMatch(r -> r.getName() == Role.RoleName.ADMIN);
        
        // Для обычных пользователей автоматически удаляем все связанные сообщения
        if (!isAdmin) {
            // Находим все сообщения, где пользователь был отправителем
            List<com.verchuk.electro.model.ChatMessage> userMessages = chatMessageRepository.findAll().stream()
                    .filter(m -> m.getSender().getId().equals(userId))
                    .collect(Collectors.toList());
            
            // Удаляем все сообщения пользователя и ответы на них
            for (com.verchuk.electro.model.ChatMessage msg : userMessages) {
                // Удаляем все ответы на это сообщение
                List<com.verchuk.electro.model.ChatMessage> replies = chatMessageRepository.findAll().stream()
                        .filter(m -> m.getReplyToMessage() != null && 
                                   m.getReplyToMessage().getId().equals(msg.getId()))
                        .collect(Collectors.toList());
                
                for (com.verchuk.electro.model.ChatMessage reply : replies) {
                    reply.setDeleted(true);
                    chatMessageRepository.save(reply);
                }
                
                // Удаляем само сообщение пользователя
                msg.setDeleted(true);
                chatMessageRepository.save(msg);
            }
            
            // Находим все сообщения, где пользователь был назначенным админом
            List<com.verchuk.electro.model.ChatMessage> messagesWithAssignedAdmin = chatMessageRepository.findAll().stream()
                    .filter(m -> m.getAssignedAdmin() != null && m.getAssignedAdmin().getId().equals(userId))
                    .collect(Collectors.toList());
            
            // Сбрасываем assignedAdmin для этих сообщений
            for (com.verchuk.electro.model.ChatMessage msg : messagesWithAssignedAdmin) {
                msg.setAssignedAdmin(null);
                chatMessageRepository.save(msg);
            }
        }
        
        // Удаляем все проекты пользователя и связанные сущности
        List<com.verchuk.electro.model.Project> userProjects = projectRepository.findByDesigner(user);
        for (com.verchuk.electro.model.Project project : userProjects) {
            // Удаляем SavedSpecification для проекта
            savedSpecificationRepository.deleteAllByProjectId(project.getId());
            
            // Удаляем FloorPlan для проекта
            floorPlanRepository.findByProject(project).ifPresent(floorPlanRepository::delete);
        }
        
        // Удаляем все проекты пользователя явно перед удалением пользователя
        // Это необходимо, чтобы избежать проблем с каскадным удалением
        if (!userProjects.isEmpty()) {
            projectRepository.deleteAll(userProjects);
        }
        
        // Удаляем пользователя
        userRepository.delete(user);
    }

    // Admin methods
    public UserQueryResult getAllUsers(Optional<String> role,
                                       Optional<String> search,
                                       Optional<String> sortBy,
                                       Optional<String> sortDir,
                                       Optional<Integer> page,
                                       Optional<Integer> size) {
        Comparator<User> comparator = buildComparator(sortBy.orElse("id"));
        if ("desc".equalsIgnoreCase(sortDir.orElse("asc"))) {
            comparator = comparator.reversed();
        }

        List<User> filteredAndSortedUsers = userRepository.findAll().stream()
                .filter(user -> role
                        .map(r -> user.getRoles().stream()
                                .anyMatch(userRole -> userRole.getName().name().equalsIgnoreCase(r)))
                        .orElse(true))
                .filter(user -> search.map(q -> matchesSearch(user, q)).orElse(true))
                .sorted(comparator)
                .collect(Collectors.toList());

        long totalItems = filteredAndSortedUsers.size();
        List<User> paginatedUsers = paginateUsers(filteredAndSortedUsers, page, size);

        List<UserResponse> resultUsers = paginatedUsers.stream()
                .map(UserResponse::fromUser)
                .collect(Collectors.toList());

        return new UserQueryResult(resultUsers, totalItems);
    }

    private Comparator<User> buildComparator(String sortBy) {
        return switch (sortBy) {
            case "username" -> Comparator.comparing(User::getUsername, nullSafeStringComparator());
            case "email" -> Comparator.comparing(User::getEmail, nullSafeStringComparator());
            case "firstName" -> Comparator.comparing(User::getFirstName, nullSafeStringComparator());
            case "lastName" -> Comparator.comparing(User::getLastName, nullSafeStringComparator());
            case "phoneNumber" -> Comparator.comparing(User::getPhoneNumber, nullSafeStringComparator());
            case "birthDate" -> Comparator.comparing(User::getBirthDate, nullSafeComparableComparator());
            case "createdAt" -> Comparator.comparing(User::getCreatedAt, nullSafeComparableComparator());
            case "updatedAt" -> Comparator.comparing(User::getUpdatedAt, nullSafeComparableComparator());
            case "enabled" -> Comparator.comparing(User::getEnabled, nullSafeComparableComparator());
            case "roles" -> Comparator.comparing(this::rolesAsSortedString, nullSafeStringComparator());
            case "id" -> Comparator.comparing(User::getId, nullSafeComparableComparator());
            default -> Comparator.comparing(User::getId, nullSafeComparableComparator());
        };
    }

    private String rolesAsSortedString(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return null;
        }
        return user.getRoles().stream()
                .map(role -> role.getName().name())
                .sorted()
                .collect(Collectors.joining(","));
    }

    private Comparator<String> nullSafeStringComparator() {
        return Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER);
    }

    private <T extends Comparable<? super T>> Comparator<T> nullSafeComparableComparator() {
        return Comparator.nullsLast(Comparator.naturalOrder());
    }

    private boolean matchesSearch(User user, String query) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
        if (normalizedQuery.isEmpty()) {
            return true;
        }

        return containsIgnoreCase(user.getUsername(), normalizedQuery)
                || containsIgnoreCase(user.getEmail(), normalizedQuery)
                || containsIgnoreCase(user.getFirstName(), normalizedQuery)
                || containsIgnoreCase(user.getLastName(), normalizedQuery)
                || user.getId().toString().contains(normalizedQuery)
                || user.getRoles().stream()
                .anyMatch(role -> role.getName().name().toLowerCase().contains(normalizedQuery));
    }

    private boolean containsIgnoreCase(String value, String query) {
        return value != null && value.toLowerCase().contains(query);
    }

    private List<User> paginateUsers(List<User> users, Optional<Integer> page, Optional<Integer> size) {
        if (page.isEmpty() && size.isEmpty()) {
            return users;
        }

        int safePage = Math.max(0, page.orElse(0));
        int safeSize = size.orElse(20);
        if (safeSize <= 0) {
            safeSize = 20;
        }

        int fromIndex = safePage * safeSize;
        if (fromIndex >= users.size()) {
            return List.of();
        }

        int toIndex = Math.min(fromIndex + safeSize, users.size());
        return users.subList(fromIndex, toIndex);
    }

    public static class UserQueryResult {
        private final List<UserResponse> users;
        private final long totalItems;

        public UserQueryResult(List<UserResponse> users, long totalItems) {
            this.users = users;
            this.totalItems = totalItems;
        }

        public List<UserResponse> getUsers() {
            return users;
        }

        public long getTotalItems() {
            return totalItems;
        }
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
        return UserResponse.fromUser(user);
    }

    @Transactional
    public UserResponse createUser(com.verchuk.electro.dto.request.RegisterRequest request, List<String> roleNames) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BadRequestException("Username is already taken!");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email is already in use!");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .enabled(true)
                .build();

        Set<Role> roles = new HashSet<>();
        for (String roleName : roleNames) {
            Role.RoleName roleNameEnum = Role.RoleName.valueOf(roleName.toUpperCase());
            Role role = roleRepository.findByName(roleNameEnum)
                    .orElseThrow(() -> new BadRequestException("Role not found: " + roleName));
            roles.add(role);
        }
        user.setRoles(roles);

        return UserResponse.fromUser(userRepository.save(user));
    }

    @Transactional
    public UserResponse updateUser(Long id, UserUpdateRequest request, List<String> roleNames) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new BadRequestException("Email is already in use!");
            }
            user.setEmail(request.getEmail());
        }

        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName());
        }

        if (request.getLastName() != null) {
            user.setLastName(request.getLastName());
        }

        if (request.getPhotoUrl() != null) {
            // Если передана пустая строка, удаляем фото (устанавливаем null)
            if (request.getPhotoUrl().isEmpty()) {
                user.setPhotoUrl(null);
            } else {
                user.setPhotoUrl(request.getPhotoUrl());
            }
        }

        if (request.getPhoneNumber() != null) {
            user.setPhoneNumber(request.getPhoneNumber());
        }
        if (request.getBirthDate() != null) {
            user.setBirthDate(request.getBirthDate());
        }
        if (request.getPassword() != null && !request.getPassword().isEmpty()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        if (roleNames != null && !roleNames.isEmpty()) {
            // Защита: пользователь admin всегда должен иметь роль ADMIN
            if ("admin".equalsIgnoreCase(user.getUsername())) {
                boolean hasAdminRole = roleNames.stream()
                        .anyMatch(roleName -> "ADMIN".equalsIgnoreCase(roleName));
                if (!hasAdminRole) {
                    throw new BadRequestException("Нельзя изменить роль пользователя admin. Пользователь admin всегда должен иметь роль администратора.");
                }
            }
            
            // Защита: администратор не может изменить свою собственную роль
            User currentUser = getCurrentUser();
            if (user.getId().equals(currentUser.getId())) {
                boolean isCurrentUserAdmin = currentUser.getRoles().stream()
                        .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);
                if (isCurrentUserAdmin) {
                    boolean tryingToChangeRole = !roleNames.stream()
                            .anyMatch(roleName -> "ADMIN".equalsIgnoreCase(roleName));
                    if (tryingToChangeRole) {
                        throw new BadRequestException("Вы не можете изменить свою собственную роль. Обратитесь к другому администратору.");
                    }
                }
            }
            
            Set<Role> roles = new HashSet<>();
            boolean becomingAdmin = false;
            boolean becomingUser = false;
            boolean wasAdmin = user.getRoles().stream()
                    .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);
            
            for (String roleName : roleNames) {
                Role.RoleName roleNameEnum = Role.RoleName.valueOf(roleName.toUpperCase());
                Role role = roleRepository.findByName(roleNameEnum)
                        .orElseThrow(() -> new BadRequestException("Role not found: " + roleName));
                roles.add(role);
                if (roleNameEnum == com.verchuk.electro.model.Role.RoleName.ADMIN) {
                    becomingAdmin = true;
                }
            }
            
            // Проверяем, становится ли пользователь обычным пользователем (не админом)
            boolean willBeAdmin = roles.stream()
                    .anyMatch(r -> r.getName() == com.verchuk.electro.model.Role.RoleName.ADMIN);
            if (wasAdmin && !willBeAdmin) {
                becomingUser = true;
            }
            
            // Если админ становится пользователем, сначала удаляем все его сообщения и чаты
            if (becomingUser) {
                // Находим все сообщения, где этот админ был отправителем (его собственные сообщения)
                List<com.verchuk.electro.model.ChatMessage> adminMessages = chatMessageRepository.findAll().stream()
                        .filter(m -> m.getSender().getId().equals(user.getId()))
                        .collect(java.util.stream.Collectors.toList());
                
                // Удаляем все сообщения админа и ответы на них
                for (com.verchuk.electro.model.ChatMessage msg : adminMessages) {
                    // Удаляем все ответы на это сообщение
                    List<com.verchuk.electro.model.ChatMessage> replies = chatMessageRepository.findAll().stream()
                            .filter(m -> m.getReplyToMessage() != null && 
                                       m.getReplyToMessage().getId().equals(msg.getId()))
                            .collect(java.util.stream.Collectors.toList());
                    
                    for (com.verchuk.electro.model.ChatMessage reply : replies) {
                        reply.setDeleted(true);
                        chatMessageRepository.save(reply);
                    }
                    
                    // Удаляем само сообщение админа
                    msg.setDeleted(true);
                    chatMessageRepository.save(msg);
                }
                
                // Находим все сообщения пользователей, на которые админ отвечал (где админ был assignedAdmin)
                // и удаляем ответы админа на эти сообщения
                List<com.verchuk.electro.model.ChatMessage> userMessagesWithAdmin = chatMessageRepository.findAll().stream()
                        .filter(m -> m.getAssignedAdmin() != null && m.getAssignedAdmin().getId().equals(user.getId()))
                        .collect(java.util.stream.Collectors.toList());
                
                for (com.verchuk.electro.model.ChatMessage userMsg : userMessagesWithAdmin) {
                    // Находим все ответы админа на это сообщение пользователя
                    List<com.verchuk.electro.model.ChatMessage> adminReplies = chatMessageRepository.findAll().stream()
                            .filter(m -> m.getReplyToMessage() != null && 
                                       m.getReplyToMessage().getId().equals(userMsg.getId()) &&
                                       m.getSender().getId().equals(user.getId()))
                            .collect(java.util.stream.Collectors.toList());
                    
                    for (com.verchuk.electro.model.ChatMessage adminReply : adminReplies) {
                        adminReply.setDeleted(true);
                        chatMessageRepository.save(adminReply);
                    }
                    
                    // Сбрасываем assignedAdmin для сообщения пользователя
                    userMsg.setAssignedAdmin(null);
                    chatMessageRepository.save(userMsg);
                }
            }
            
            user.setRoles(roles);
            
            // Если пользователь стал администратором, удаляем все его переписки в поддержке
            if (becomingAdmin && !wasAdmin) {
                // Находим все сообщения пользователя
                List<com.verchuk.electro.model.ChatMessage> userMessages = chatMessageRepository.findAll().stream()
                        .filter(m -> m.getSender().getId().equals(user.getId()) || 
                                   (m.getAssignedAdmin() != null && m.getAssignedAdmin().getId().equals(user.getId())))
                        .collect(java.util.stream.Collectors.toList());
                
                // Удаляем все сообщения пользователя и ответы на них
                for (com.verchuk.electro.model.ChatMessage msg : userMessages) {
                    msg.setDeleted(true);
                    chatMessageRepository.save(msg);
                    
                    // Удаляем все ответы на это сообщение
                    List<com.verchuk.electro.model.ChatMessage> replies = chatMessageRepository.findAll().stream()
                            .filter(m -> m.getReplyToMessage() != null && 
                                       m.getReplyToMessage().getId().equals(msg.getId()))
                            .collect(java.util.stream.Collectors.toList());
                    
                    for (com.verchuk.electro.model.ChatMessage reply : replies) {
                        reply.setDeleted(true);
                        chatMessageRepository.save(reply);
                    }
                }
            }
        }

        return UserResponse.fromUser(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
        
        // Получаем текущего пользователя (администратора, который пытается удалить)
        User currentUser = getCurrentUser();
        
        // Проверяем, пытается ли администратор удалить сам себя
        if (currentUser.getId().equals(id)) {
            throw new BadRequestException("Вы не можете удалить самого себя. Обратитесь к другому администратору.");
        }
        
        // Проверяем, является ли пользователь главным админом
        if ("admin".equalsIgnoreCase(user.getUsername())) {
            throw new BadRequestException("Нельзя удалить пользователя admin. Это первородный администратор системы.");
        }
        
        // Проверяем, является ли пользователь администратором
        boolean isAdmin = user.getRoles().stream()
                .anyMatch(r -> r.getName() == Role.RoleName.ADMIN);
        
        // Для обычных пользователей автоматически удаляем все связанные сообщения
        if (!isAdmin) {
            // Находим все сообщения, где пользователь был отправителем
            List<com.verchuk.electro.model.ChatMessage> userMessages = chatMessageRepository.findAll().stream()
                    .filter(m -> m.getSender().getId().equals(id))
                    .collect(Collectors.toList());
            
            // Удаляем все сообщения пользователя и ответы на них
            for (com.verchuk.electro.model.ChatMessage msg : userMessages) {
                // Удаляем все ответы на это сообщение
                List<com.verchuk.electro.model.ChatMessage> replies = chatMessageRepository.findAll().stream()
                        .filter(m -> m.getReplyToMessage() != null && 
                                   m.getReplyToMessage().getId().equals(msg.getId()))
                        .collect(Collectors.toList());
                
                for (com.verchuk.electro.model.ChatMessage reply : replies) {
                    reply.setDeleted(true);
                    chatMessageRepository.save(reply);
                }
                
                // Удаляем само сообщение пользователя
                msg.setDeleted(true);
                chatMessageRepository.save(msg);
            }
            
            // Находим все сообщения, где пользователь был назначенным админом
            List<com.verchuk.electro.model.ChatMessage> messagesWithAssignedAdmin = chatMessageRepository.findAll().stream()
                    .filter(m -> m.getAssignedAdmin() != null && m.getAssignedAdmin().getId().equals(id))
                    .collect(Collectors.toList());
            
            // Сбрасываем assignedAdmin для этих сообщений
            for (com.verchuk.electro.model.ChatMessage msg : messagesWithAssignedAdmin) {
                msg.setAssignedAdmin(null);
                chatMessageRepository.save(msg);
            }
        }
        
        // Удаляем все проекты пользователя и связанные сущности
        List<com.verchuk.electro.model.Project> userProjects = projectRepository.findByDesigner(user);
        for (com.verchuk.electro.model.Project project : userProjects) {
            // Удаляем SavedSpecification для проекта
            savedSpecificationRepository.deleteAllByProjectId(project.getId());
            
            // Удаляем FloorPlan для проекта
            floorPlanRepository.findByProject(project).ifPresent(floorPlanRepository::delete);
        }
        
        // Удаляем все проекты пользователя явно перед удалением пользователя
        // Это необходимо, чтобы избежать проблем с каскадным удалением
        if (!userProjects.isEmpty()) {
            projectRepository.deleteAll(userProjects);
        }
        
        // Удаляем пользователя
        userRepository.delete(user);
    }
}

