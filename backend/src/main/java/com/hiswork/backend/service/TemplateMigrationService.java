package com.hiswork.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.hiswork.backend.domain.Template;
import com.hiswork.backend.domain.TemplateField;
import com.hiswork.backend.repository.TemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class TemplateMigrationService {
    
    private final TemplateRepository templateRepository;
    private final TemplateFieldService templateFieldService;
    private final ObjectMapper objectMapper;
    
    /**
     * 모든 템플릿의 coordinateFields를 새로운 구조로 마이그레이션
     */
    public MigrationResult migrateAllTemplates() {
        List<Template> templates = templateRepository.findAll();
        
        int totalTemplates = templates.size();
        int migratedCount = 0;
        int skippedCount = 0;
        List<String> errors = new ArrayList<>();
        
        log.info("템플릿 마이그레이션 시작 - 총 {}개 템플릿", totalTemplates);
        
        for (Template template : templates) {
            try {
                if (migrateTemplate(template)) {
                    migratedCount++;
                    log.info("템플릿 마이그레이션 완료: {} (ID: {})", template.getName(), template.getId());
                } else {
                    skippedCount++;
                    log.info("템플릿 마이그레이션 스킵: {} (ID: {}) - 이미 마이그레이션됨 또는 필드 없음", 
                            template.getName(), template.getId());
                }
            } catch (Exception e) {
                errors.add("Template ID " + template.getId() + ": " + e.getMessage());
                log.error("템플릿 마이그레이션 실패: {} (ID: {})", template.getName(), template.getId(), e);
            }
        }
        
        log.info("템플릿 마이그레이션 완료 - 총: {}, 마이그레이션: {}, 스킵: {}, 오류: {}", 
                totalTemplates, migratedCount, skippedCount, errors.size());
        
        return MigrationResult.builder()
                .totalTemplates(totalTemplates)
                .migratedCount(migratedCount)
                .skippedCount(skippedCount)
                .errorCount(errors.size())
                .errors(errors)
                .build();
    }
    
    /**
     * 특정 템플릿의 coordinateFields를 새로운 구조로 마이그레이션
     */
    public boolean migrateTemplate(Template template) {
        // 이미 templateFields가 있다면 스킵
        if (!template.getTemplateFields().isEmpty()) {
            log.debug("템플릿 {}는 이미 새로운 구조의 필드가 있음", template.getId());
            return false;
        }
        
        // coordinateFields가 없다면 스킵
        if (template.getCoordinateFields() == null || template.getCoordinateFields().trim().isEmpty()) {
            log.debug("템플릿 {}에 coordinateFields가 없음", template.getId());
            return false;
        }
        
        try {
            JsonNode coordinateFieldsJson = objectMapper.readTree(template.getCoordinateFields());
            
            // coordinateFields가 배열이 아니면 스킵
            if (!coordinateFieldsJson.isArray()) {
                log.warn("템플릿 {}의 coordinateFields가 배열이 아님", template.getId());
                return false;
            }
            
            ArrayNode fieldsArray = (ArrayNode) coordinateFieldsJson;
            int fieldCount = 0;
            
            for (JsonNode fieldNode : fieldsArray) {
                try {
                    TemplateField templateField = convertJsonToTemplateField(template, fieldNode, fieldCount);
                    templateFieldService.createTemplateField(
                            template.getId(),
                            templateField.getFieldKey(),
                            templateField.getLabel(),
                            templateField.getRequired(),
                            templateField.getPage(),
                            templateField.getX(),
                            templateField.getY(),
                            templateField.getWidth(),
                            templateField.getHeight()
                    );
                    fieldCount++;
                } catch (Exception e) {
                    log.error("필드 변환 실패 - 템플릿 ID: {}, 필드 인덱스: {}", template.getId(), fieldCount, e);
                    throw e;
                }
            }
            
            log.info("템플릿 {} 마이그레이션 완료 - {}개 필드 변환", template.getId(), fieldCount);
            return fieldCount > 0;
            
        } catch (Exception e) {
            log.error("템플릿 {} coordinateFields 파싱 실패", template.getId(), e);
            throw new RuntimeException("Template migration failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * JSON 필드 노드를 TemplateField로 변환
     */
    private TemplateField convertJsonToTemplateField(Template template, JsonNode fieldNode, int index) {
        // 기본값 설정
        String fieldKey = fieldNode.has("id") ? fieldNode.get("id").asText() : "field_" + index;
        String label = fieldNode.has("label") ? fieldNode.get("label").asText() : "Field " + (index + 1);
        boolean required = fieldNode.has("required") && fieldNode.get("required").asBoolean();
        int page = fieldNode.has("page") ? fieldNode.get("page").asInt() : 1;
        
        // 좌표 정보 추출 (픽셀 좌표를 비율로 변환)
        double x = fieldNode.has("x") ? fieldNode.get("x").asDouble() : 0.0;
        double y = fieldNode.has("y") ? fieldNode.get("y").asDouble() : 0.0;
        double width = fieldNode.has("width") ? fieldNode.get("width").asDouble() : 100.0;
        double height = fieldNode.has("height") ? fieldNode.get("height").asDouble() : 30.0;
        
        // 픽셀 좌표를 비율로 변환 (가정: PDF 크기 800x1000)
        // 실제 PDF 크기에 맞게 조정 필요
        double pdfWidth = 800.0;
        double pdfHeight = 1000.0;
        
        BigDecimal xRatio = BigDecimal.valueOf(Math.max(0, Math.min(1, x / pdfWidth)));
        BigDecimal yRatio = BigDecimal.valueOf(Math.max(0, Math.min(1, y / pdfHeight)));
        BigDecimal widthRatio = BigDecimal.valueOf(Math.max(0.01, Math.min(1, width / pdfWidth)));
        BigDecimal heightRatio = BigDecimal.valueOf(Math.max(0.01, Math.min(1, height / pdfHeight)));
        
        return TemplateField.builder()
                .template(template)
                .fieldKey(fieldKey)
                .label(label)
                .required(required)
                .page(page)
                .x(xRatio)
                .y(yRatio)
                .width(widthRatio)
                .height(heightRatio)
                .build();
    }
    
    /**
     * 마이그레이션 결과 DTO
     */
    @lombok.Builder
    @lombok.Data
    public static class MigrationResult {
        private int totalTemplates;
        private int migratedCount;
        private int skippedCount;
        private int errorCount;
        private List<String> errors;
        
        public boolean isSuccessful() {
            return errorCount == 0;
        }
        
        public double getSuccessRate() {
            if (totalTemplates == 0) return 1.0;
            return (double) (migratedCount + skippedCount) / totalTemplates;
        }
    }
}
