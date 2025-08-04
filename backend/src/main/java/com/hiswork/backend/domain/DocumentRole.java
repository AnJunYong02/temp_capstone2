package com.hiswork.backend.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "documents_role")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentRole {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    @JsonIgnore
    private Document document;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_user_id", nullable = false)
    private User assignedUser;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "task_role", nullable = false)
    private TaskRole taskRole;
    
    @CreationTimestamp
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    
    public enum TaskRole {
        CREATOR, EDITOR, REVIEWER
    }
} 