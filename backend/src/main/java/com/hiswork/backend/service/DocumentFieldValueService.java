package com.hiswork.backend.service;

import com.hiswork.backend.domain.Document;
import com.hiswork.backend.domain.DocumentFieldValue;
import com.hiswork.backend.domain.TemplateField;
import com.hiswork.backend.repository.DocumentFieldValueRepository;
import com.hiswork.backend.repository.DocumentRepository;
import com.hiswork.backend.repository.TemplateFieldRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class DocumentFieldValueService {
    
    private final DocumentFieldValueRepository documentFieldValueRepository;
    private final DocumentRepository documentRepository;
    private final TemplateFieldRepository templateFieldRepository;
    
    /**
     * 문서 필드 값 저장/업데이트
     */
    public DocumentFieldValue saveFieldValue(Long documentId, Long templateFieldId, String value) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found"));
        
        TemplateField templateField = templateFieldRepository.findById(templateFieldId)
                .orElseThrow(() -> new RuntimeException("Template field not found"));
        
        // 필드가 해당 문서의 템플릿에 속하는지 확인
        if (!templateField.getTemplate().getId().equals(document.getTemplate().getId())) {
            throw new RuntimeException("Template field does not belong to document's template");
        }
        
        // 기존 값이 있으면 업데이트, 없으면 새로 생성
        Optional<DocumentFieldValue> existingValue = documentFieldValueRepository
                .findByDocumentIdAndTemplateFieldId(documentId, templateFieldId);
        
        DocumentFieldValue fieldValue;
        if (existingValue.isPresent()) {
            fieldValue = existingValue.get();
            fieldValue.setValue(value);
            log.info("문서 필드 값 업데이트: documentId={}, fieldKey={}, value={}", 
                    documentId, templateField.getFieldKey(), value);
        } else {
            fieldValue = DocumentFieldValue.builder()
                    .document(document)
                    .templateField(templateField)
                    .value(value)
                    .build();
            log.info("문서 필드 값 생성: documentId={}, fieldKey={}, value={}", 
                    documentId, templateField.getFieldKey(), value);
        }
        
        return documentFieldValueRepository.save(fieldValue);
    }
    
    /**
     * 문서의 모든 필드 값 조회
     */
    @Transactional(readOnly = true)
    public List<DocumentFieldValue> getDocumentFieldValues(Long documentId) {
        return documentFieldValueRepository.findByDocumentIdOrderByTemplateFieldCreatedAt(documentId);
    }
    
    /**
     * 문서의 필드 값들을 Map 형태로 조회 (fieldKey -> value)
     */
    @Transactional(readOnly = true)
    public Map<String, String> getDocumentFieldValuesAsMap(Long documentId) {
        List<DocumentFieldValue> fieldValues = getDocumentFieldValues(documentId);
        return fieldValues.stream()
                .collect(Collectors.toMap(
                        fv -> fv.getTemplateField().getFieldKey(),
                        fv -> fv.getValue() != null ? fv.getValue() : "",
                        (existing, replacement) -> replacement
                ));
    }
    
    /**
     * 특정 필드 값 조회
     */
    @Transactional(readOnly = true)
    public Optional<DocumentFieldValue> getFieldValue(Long documentId, Long templateFieldId) {
        return documentFieldValueRepository.findByDocumentIdAndTemplateFieldId(documentId, templateFieldId);
    }
    
    /**
     * 문서의 필수 필드 완성도 체크
     */
    @Transactional(readOnly = true)
    public boolean isDocumentCompleted(Long documentId) {
        long filledRequiredFields = documentFieldValueRepository.countFilledRequiredFieldsByDocumentId(documentId);
        long totalRequiredFields = documentFieldValueRepository.countRequiredFieldsByDocumentId(documentId);
        
        log.info("문서 완성도 체크: documentId={}, filled={}, total={}", 
                documentId, filledRequiredFields, totalRequiredFields);
        
        return filledRequiredFields >= totalRequiredFields;
    }
    
    /**
     * 문서의 필수 필드 완성도 상세 정보
     */
    @Transactional(readOnly = true)
    public DocumentCompletionInfo getDocumentCompletionInfo(Long documentId) {
        long filledRequiredFields = documentFieldValueRepository.countFilledRequiredFieldsByDocumentId(documentId);
        long totalRequiredFields = documentFieldValueRepository.countRequiredFieldsByDocumentId(documentId);
        
        List<DocumentFieldValue> requiredFieldValues = documentFieldValueRepository
                .findRequiredFieldValuesByDocumentId(documentId);
        
        List<String> missingRequiredFields = requiredFieldValues.stream()
                .filter(fv -> fv.getValue() == null || fv.getValue().trim().isEmpty())
                .map(fv -> fv.getTemplateField().getLabel())
                .collect(Collectors.toList());
        
        return DocumentCompletionInfo.builder()
                .filledRequiredFields(filledRequiredFields)
                .totalRequiredFields(totalRequiredFields)
                .isCompleted(filledRequiredFields >= totalRequiredFields)
                .missingRequiredFields(missingRequiredFields)
                .build();
    }
    
    /**
     * 문서의 모든 필드 값 삭제
     */
    public void deleteAllFieldValues(Long documentId) {
        documentFieldValueRepository.deleteByDocumentId(documentId);
        log.info("문서의 모든 필드 값 삭제 완료: documentId={}", documentId);
    }
    
    /**
     * 문서 완성도 정보 DTO
     */
    @lombok.Builder
    @lombok.Data
    public static class DocumentCompletionInfo {
        private long filledRequiredFields;
        private long totalRequiredFields;
        private boolean isCompleted;
        private List<String> missingRequiredFields;
    }
}
