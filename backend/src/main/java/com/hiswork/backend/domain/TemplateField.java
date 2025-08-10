package com.hiswork.backend.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "template_fields")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateField {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    @JsonIgnore
    private Template template;
    
    @Column(name = "field_key", nullable = false)
    private String fieldKey;
    
    @Column(nullable = false)
    private String label;
    
    @Column(nullable = false)
    private Boolean required;
    
    @Column(nullable = false)
    private Integer page;
    
    @Column(precision = 10, scale = 8, nullable = false)
    private BigDecimal x;
    
    @Column(precision = 10, scale = 8, nullable = false)
    private BigDecimal y;
    
    @Column(precision = 10, scale = 8, nullable = false)
    private BigDecimal width;
    
    @Column(precision = 10, scale = 8, nullable = false)
    private BigDecimal height;
    
    @CreationTimestamp
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    
    // 유니크 제약조건: 같은 템플릿 내에서 fieldKey는 유일해야 함
    @Table(uniqueConstraints = {
        @UniqueConstraint(columnNames = {"template_id", "field_key"})
    })
    public static class TableConstraints {}
}
