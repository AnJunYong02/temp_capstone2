package com.hiswork.backend.controller;

import com.hiswork.backend.domain.DocumentFieldValue;
import com.hiswork.backend.service.DocumentFieldValueService;
import com.hiswork.backend.util.AuthUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents/{documentId}/field-values")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class DocumentFieldValueController {
    
    private final DocumentFieldValueService documentFieldValueService;
    private final AuthUtil authUtil;
    
    /**
     * 문서 필드 값 저장/업데이트
     */
    @PostMapping
    public ResponseEntity<?> saveFieldValue(
            @PathVariable Long documentId,
            @Valid @RequestBody SaveFieldValueRequest request,
            HttpServletRequest httpRequest) {
        
        try {
            // TODO: 권한 체크 (문서 편집 권한 확인)
            
            DocumentFieldValue fieldValue = documentFieldValueService.saveFieldValue(
                    documentId,
                    request.getTemplateFieldId(),
                    request.getValue()
            );
            
            return ResponseEntity.ok(DocumentFieldValueResponse.from(fieldValue));
        } catch (Exception e) {
            log.error("문서 필드 값 저장 실패", e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 문서의 모든 필드 값 조회
     */
    @GetMapping
    public ResponseEntity<List<DocumentFieldValueResponse>> getDocumentFieldValues(@PathVariable Long documentId) {
        try {
            List<DocumentFieldValue> fieldValues = documentFieldValueService.getDocumentFieldValues(documentId);
            List<DocumentFieldValueResponse> responses = fieldValues.stream()
                    .map(DocumentFieldValueResponse::from)
                    .toList();
            
            return ResponseEntity.ok(responses);
        } catch (Exception e) {
            log.error("문서 필드 값 조회 실패", e);
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 문서의 필드 값들을 Map 형태로 조회
     */
    @GetMapping("/map")
    public ResponseEntity<Map<String, String>> getDocumentFieldValuesAsMap(@PathVariable Long documentId) {
        try {
            Map<String, String> fieldValues = documentFieldValueService.getDocumentFieldValuesAsMap(documentId);
            return ResponseEntity.ok(fieldValues);
        } catch (Exception e) {
            log.error("문서 필드 값 Map 조회 실패", e);
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 문서 완성도 체크
     */
    @GetMapping("/completion")
    public ResponseEntity<DocumentFieldValueService.DocumentCompletionInfo> getDocumentCompletion(@PathVariable Long documentId) {
        try {
            DocumentFieldValueService.DocumentCompletionInfo completionInfo = 
                    documentFieldValueService.getDocumentCompletionInfo(documentId);
            return ResponseEntity.ok(completionInfo);
        } catch (Exception e) {
            log.error("문서 완성도 체크 실패", e);
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 문서 필드 값 저장 요청 DTO
     */
    @lombok.Data
    public static class SaveFieldValueRequest {
        private Long templateFieldId;
        private String value;
    }
    
    /**
     * 문서 필드 값 응답 DTO
     */
    @lombok.Data
    @lombok.Builder
    public static class DocumentFieldValueResponse {
        private Long id;
        private Long templateFieldId;
        private String fieldKey;
        private String label;
        private Boolean required;
        private String value;
        
        public static DocumentFieldValueResponse from(DocumentFieldValue fieldValue) {
            return DocumentFieldValueResponse.builder()
                    .id(fieldValue.getId())
                    .templateFieldId(fieldValue.getTemplateField().getId())
                    .fieldKey(fieldValue.getTemplateField().getFieldKey())
                    .label(fieldValue.getTemplateField().getLabel())
                    .required(fieldValue.getTemplateField().getRequired())
                    .value(fieldValue.getValue())
                    .build();
        }
    }
}
