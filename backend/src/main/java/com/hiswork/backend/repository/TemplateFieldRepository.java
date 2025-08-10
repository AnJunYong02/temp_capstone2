package com.hiswork.backend.repository;

import com.hiswork.backend.domain.TemplateField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TemplateFieldRepository extends JpaRepository<TemplateField, Long> {
    
    /**
     * 특정 템플릿의 모든 필드 조회
     */
    List<TemplateField> findByTemplateIdOrderByCreatedAt(Long templateId);
    
    /**
     * 특정 템플릿에서 fieldKey로 필드 조회
     */
    Optional<TemplateField> findByTemplateIdAndFieldKey(Long templateId, String fieldKey);
    
    /**
     * 특정 템플릿의 필수 필드들만 조회
     */
    @Query("SELECT tf FROM TemplateField tf WHERE tf.template.id = :templateId AND tf.required = true ORDER BY tf.createdAt")
    List<TemplateField> findRequiredFieldsByTemplateId(@Param("templateId") Long templateId);
    
    /**
     * 특정 템플릿의 필드 개수 조회
     */
    long countByTemplateId(Long templateId);
    
    /**
     * 템플릿 삭제 시 관련 필드들 모두 삭제
     */
    void deleteByTemplateId(Long templateId);
}
