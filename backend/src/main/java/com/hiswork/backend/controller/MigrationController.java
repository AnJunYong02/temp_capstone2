package com.hiswork.backend.controller;

import com.hiswork.backend.domain.Template;
import com.hiswork.backend.service.TemplateMigrationService;
import com.hiswork.backend.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/migration")
@RequiredArgsConstructor
public class MigrationController {
    
    private final TemplateMigrationService templateMigrationService;
    private final TemplateService templateService;
    
    @PostMapping("/templates")
    public ResponseEntity<TemplateMigrationService.MigrationResult> migrateTemplates() {
        try {
            TemplateMigrationService.MigrationResult result = templateMigrationService.migrateAllTemplates();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            // 오류 발생 시 500 에러와 함께 상세 정보 반환
            TemplateMigrationService.MigrationResult errorResult = TemplateMigrationService.MigrationResult.builder()
                    .totalTemplates(0)
                    .migratedCount(0)
                    .skippedCount(0)
                    .errorCount(1)
                    .errors(java.util.List.of("Migration failed: " + e.getMessage()))
                    .build();
            return ResponseEntity.internalServerError().body(errorResult);
        }
    }
    
    @PostMapping("/templates/{templateId}")
    public ResponseEntity<MigrationStatus> migrateSingleTemplate(@PathVariable Long templateId) {
        try {
            // 템플릿 조회 및 마이그레이션
            Template template = templateService.getTemplateById(templateId)
                    .orElseThrow(() -> new RuntimeException("Template not found: " + templateId));
            boolean migrated = templateMigrationService.migrateTemplate(template);
            
            MigrationStatus status = MigrationStatus.builder()
                    .templateId(templateId)
                    .success(true)
                    .migrated(migrated)
                    .message(migrated ? "Migration completed successfully" : "Template already migrated or no fields to migrate")
                    .build();
            
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            MigrationStatus errorStatus = MigrationStatus.builder()
                    .templateId(templateId)
                    .success(false)
                    .migrated(false)
                    .message("Migration failed: " + e.getMessage())
                    .build();
            return ResponseEntity.internalServerError().body(errorStatus);
        }
    }
    
    @lombok.Builder
    @lombok.Data
    public static class MigrationStatus {
        private Long templateId;
        private boolean success;
        private boolean migrated;
        private String message;
    }
}
