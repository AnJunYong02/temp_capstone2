package com.hiswork.backend.dto;

import com.hiswork.backend.domain.Template;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateResponse {
    private Long id;
    private String name;
    private String description;
    private Boolean isPublic;
    private String pdfFilePath;
    private String pdfImagePath;
    private UUID createdById;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    public static TemplateResponse from(Template template) {
        return TemplateResponse.builder()
                .id(template.getId())
                .name(template.getName())
                .description(template.getDescription())
                .isPublic(template.getIsPublic())
                .pdfFilePath(template.getPdfFilePath())
                .pdfImagePath(template.getPdfImagePath())
                .createdById(template.getCreatedBy().getId())
                .createdByName(template.getCreatedBy().getName())
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build();
    }
} 