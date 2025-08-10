package com.hiswork.backend.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "document_field_values")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentFieldValue {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    @JsonIgnore
    private Document document;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_field_id", nullable = false)
    private TemplateField templateField;
    
    @Column(columnDefinition = "TEXT")
    private String value;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "value_raw", columnDefinition = "jsonb")
    private JsonNode valueRaw;
    
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    
    // 유니크 제약조건: 같은 문서에서 같은 템플릿 필드는 하나의 값만 가져야 함
    @Table(uniqueConstraints = {
        @UniqueConstraint(columnNames = {"document_id", "template_field_id"})
    })
    public static class TableConstraints {}
}
