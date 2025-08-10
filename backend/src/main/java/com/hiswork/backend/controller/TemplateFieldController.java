package com.hiswork.backend.controller;

import com.hiswork.backend.domain.TemplateField;
import com.hiswork.backend.service.TemplateFieldService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/templates/{templateId}/fields")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class TemplateFieldController {
    
    private final TemplateFieldService templateFieldService;
    
    /**
     * 템플릿 필드 생성
     */
    @PostMapping
    public ResponseEntity<?> createTemplateField(
            @PathVariable Long templateId,
            @Valid @RequestBody CreateTemplateFieldRequest request) {
        
        try {
            TemplateField templateField = templateFieldService.createTemplateField(
                    templateId,
                    request.getFieldKey(),
                    request.getLabel(),
                    request.getRequired(),
                    request.getPage(),
                    request.getX(),
                    request.getY(),
                    request.getWidth(),
                    request.getHeight()
            );
            
            return ResponseEntity.ok(TemplateFieldResponse.from(templateField));
        } catch (Exception e) {
            log.error("템플릿 필드 생성 실패", e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 템플릿의 모든 필드 조회
     */
    @GetMapping
    public ResponseEntity<List<TemplateFieldResponse>> getTemplateFields(@PathVariable Long templateId) {
        try {
            List<TemplateField> fields = templateFieldService.getTemplateFields(templateId);
            List<TemplateFieldResponse> responses = fields.stream()
                    .map(TemplateFieldResponse::from)
                    .toList();
            
            return ResponseEntity.ok(responses);
        } catch (Exception e) {
            log.error("템플릿 필드 조회 실패", e);
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 템플릿의 필수 필드들만 조회
     */
    @GetMapping("/required")
    public ResponseEntity<List<TemplateFieldResponse>> getRequiredTemplateFields(@PathVariable Long templateId) {
        try {
            List<TemplateField> fields = templateFieldService.getRequiredTemplateFields(templateId);
            List<TemplateFieldResponse> responses = fields.stream()
                    .map(TemplateFieldResponse::from)
                    .toList();
            
            return ResponseEntity.ok(responses);
        } catch (Exception e) {
            log.error("필수 템플릿 필드 조회 실패", e);
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 템플릿 필드 수정
     */
    @PutMapping("/{fieldId}")
    public ResponseEntity<?> updateTemplateField(
            @PathVariable Long templateId,
            @PathVariable Long fieldId,
            @Valid @RequestBody UpdateTemplateFieldRequest request) {
        
        try {
            TemplateField templateField = templateFieldService.updateTemplateField(
                    fieldId,
                    request.getLabel(),
                    request.getRequired(),
                    request.getX(),
                    request.getY(),
                    request.getWidth(),
                    request.getHeight()
            );
            
            return ResponseEntity.ok(TemplateFieldResponse.from(templateField));
        } catch (Exception e) {
            log.error("템플릿 필드 수정 실패", e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 템플릿 필드 삭제
     */
    @DeleteMapping("/{fieldId}")
    public ResponseEntity<?> deleteTemplateField(
            @PathVariable Long templateId,
            @PathVariable Long fieldId) {
        
        try {
            templateFieldService.deleteTemplateField(fieldId);
            return ResponseEntity.ok(Map.of("message", "Template field deleted successfully"));
        } catch (Exception e) {
            log.error("템플릿 필드 삭제 실패", e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 템플릿 필드 생성 요청 DTO
     */
    @lombok.Data
    public static class CreateTemplateFieldRequest {
        private String fieldKey;
        private String label;
        private Boolean required;
        private Integer page;
        private BigDecimal x;
        private BigDecimal y;
        private BigDecimal width;
        private BigDecimal height;
    }
    
    /**
     * 템플릿 필드 수정 요청 DTO
     */
    @lombok.Data
    public static class UpdateTemplateFieldRequest {
        private String label;
        private Boolean required;
        private BigDecimal x;
        private BigDecimal y;
        private BigDecimal width;
        private BigDecimal height;
    }
    
    /**
     * 템플릿 필드 응답 DTO
     */
    @lombok.Data
    @lombok.Builder
    public static class TemplateFieldResponse {
        private Long id;
        private String fieldKey;
        private String label;
        private Boolean required;
        private Integer page;
        private BigDecimal x;
        private BigDecimal y;
        private BigDecimal width;
        private BigDecimal height;
        
        public static TemplateFieldResponse from(TemplateField templateField) {
            return TemplateFieldResponse.builder()
                    .id(templateField.getId())
                    .fieldKey(templateField.getFieldKey())
                    .label(templateField.getLabel())
                    .required(templateField.getRequired())
                    .page(templateField.getPage())
                    .x(templateField.getX())
                    .y(templateField.getY())
                    .width(templateField.getWidth())
                    .height(templateField.getHeight())
                    .build();
        }
    }
}
