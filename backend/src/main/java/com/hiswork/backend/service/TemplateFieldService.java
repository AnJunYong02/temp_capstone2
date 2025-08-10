package com.hiswork.backend.service;

import com.hiswork.backend.domain.Template;
import com.hiswork.backend.domain.TemplateField;
import com.hiswork.backend.repository.TemplateFieldRepository;
import com.hiswork.backend.repository.TemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class TemplateFieldService {
    
    private final TemplateFieldRepository templateFieldRepository;
    private final TemplateRepository templateRepository;
    
    /**
     * 템플릿 필드 생성
     */
    public TemplateField createTemplateField(Long templateId, String fieldKey, String label, 
                                           Boolean required, Integer page, 
                                           BigDecimal x, BigDecimal y, 
                                           BigDecimal width, BigDecimal height) {
        
        Template template = templateRepository.findById(templateId)
                .orElseThrow(() -> new RuntimeException("Template not found"));
        
        // 같은 템플릿에서 fieldKey 중복 체크
        if (templateFieldRepository.findByTemplateIdAndFieldKey(templateId, fieldKey).isPresent()) {
            throw new RuntimeException("Field key already exists in this template: " + fieldKey);
        }
        
        // 좌표값 유효성 검증 (0-1 범위)
        validateCoordinates(x, y, width, height);
        
        TemplateField templateField = TemplateField.builder()
                .template(template)
                .fieldKey(fieldKey)
                .label(label)
                .required(required)
                .page(page)
                .x(x)
                .y(y)
                .width(width)
                .height(height)
                .build();
        
        TemplateField saved = templateFieldRepository.save(templateField);
        log.info("템플릿 필드 생성 완료: templateId={}, fieldKey={}, label={}", 
                templateId, fieldKey, label);
        
        return saved;
    }
    
    /**
     * 템플릿의 모든 필드 조회
     */
    @Transactional(readOnly = true)
    public List<TemplateField> getTemplateFields(Long templateId) {
        return templateFieldRepository.findByTemplateIdOrderByCreatedAt(templateId);
    }
    
    /**
     * 템플릿의 필수 필드들만 조회
     */
    @Transactional(readOnly = true)
    public List<TemplateField> getRequiredTemplateFields(Long templateId) {
        return templateFieldRepository.findRequiredFieldsByTemplateId(templateId);
    }
    
    /**
     * 특정 필드 조회
     */
    @Transactional(readOnly = true)
    public Optional<TemplateField> getTemplateField(Long templateId, String fieldKey) {
        return templateFieldRepository.findByTemplateIdAndFieldKey(templateId, fieldKey);
    }
    
    /**
     * 템플릿 필드 수정
     */
    public TemplateField updateTemplateField(Long fieldId, String label, Boolean required,
                                           BigDecimal x, BigDecimal y, 
                                           BigDecimal width, BigDecimal height) {
        
        TemplateField templateField = templateFieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Template field not found"));
        
        // 좌표값 유효성 검증
        validateCoordinates(x, y, width, height);
        
        templateField.setLabel(label);
        templateField.setRequired(required);
        templateField.setX(x);
        templateField.setY(y);
        templateField.setWidth(width);
        templateField.setHeight(height);
        
        TemplateField updated = templateFieldRepository.save(templateField);
        log.info("템플릿 필드 수정 완료: fieldId={}, label={}", fieldId, label);
        
        return updated;
    }
    
    /**
     * 템플릿 필드 삭제
     */
    public void deleteTemplateField(Long fieldId) {
        TemplateField templateField = templateFieldRepository.findById(fieldId)
                .orElseThrow(() -> new RuntimeException("Template field not found"));
        
        templateFieldRepository.delete(templateField);
        log.info("템플릿 필드 삭제 완료: fieldId={}, fieldKey={}", 
                fieldId, templateField.getFieldKey());
    }
    
    /**
     * 템플릿의 모든 필드 삭제
     */
    public void deleteAllTemplateFields(Long templateId) {
        templateFieldRepository.deleteByTemplateId(templateId);
        log.info("템플릿의 모든 필드 삭제 완료: templateId={}", templateId);
    }
    
    /**
     * 좌표값 유효성 검증 (0-1 범위)
     */
    private void validateCoordinates(BigDecimal x, BigDecimal y, BigDecimal width, BigDecimal height) {
        if (x.compareTo(BigDecimal.ZERO) < 0 || x.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("X coordinate must be between 0 and 1");
        }
        if (y.compareTo(BigDecimal.ZERO) < 0 || y.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("Y coordinate must be between 0 and 1");
        }
        if (width.compareTo(BigDecimal.ZERO) <= 0 || width.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("Width must be between 0 and 1");
        }
        if (height.compareTo(BigDecimal.ZERO) <= 0 || height.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("Height must be between 0 and 1");
        }
        if (x.add(width).compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("X + Width must not exceed 1");
        }
        if (y.add(height).compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("Y + Height must not exceed 1");
        }
    }
}
