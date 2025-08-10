package com.hiswork.backend.repository;

import com.hiswork.backend.domain.DocumentFieldValue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentFieldValueRepository extends JpaRepository<DocumentFieldValue, Long> {
    
    /**
     * 특정 문서의 모든 필드 값 조회
     */
    List<DocumentFieldValue> findByDocumentIdOrderByTemplateFieldCreatedAt(Long documentId);
    
    /**
     * 특정 문서의 특정 템플릿 필드 값 조회
     */
    Optional<DocumentFieldValue> findByDocumentIdAndTemplateFieldId(Long documentId, Long templateFieldId);
    
    /**
     * 특정 문서의 필수 필드 값들만 조회
     */
    @Query("SELECT dfv FROM DocumentFieldValue dfv " +
           "WHERE dfv.document.id = :documentId " +
           "AND dfv.templateField.required = true " +
           "ORDER BY dfv.templateField.createdAt")
    List<DocumentFieldValue> findRequiredFieldValuesByDocumentId(@Param("documentId") Long documentId);
    
    /**
     * 특정 문서에서 값이 비어있지 않은 필수 필드 개수 조회
     */
    @Query("SELECT COUNT(dfv) FROM DocumentFieldValue dfv " +
           "WHERE dfv.document.id = :documentId " +
           "AND dfv.templateField.required = true " +
           "AND (dfv.value IS NOT NULL AND dfv.value != '')")
    long countFilledRequiredFieldsByDocumentId(@Param("documentId") Long documentId);
    
    /**
     * 특정 문서의 총 필수 필드 개수 조회
     */
    @Query("SELECT COUNT(tf) FROM TemplateField tf " +
           "WHERE tf.template.id = (SELECT d.template.id FROM Document d WHERE d.id = :documentId) " +
           "AND tf.required = true")
    long countRequiredFieldsByDocumentId(@Param("documentId") Long documentId);
    
    /**
     * 문서 삭제 시 관련 필드 값들 모두 삭제
     */
    void deleteByDocumentId(Long documentId);
    
    /**
     * 템플릿 필드 삭제 시 관련 필드 값들 모두 삭제
     */
    void deleteByTemplateFieldId(Long templateFieldId);
}
