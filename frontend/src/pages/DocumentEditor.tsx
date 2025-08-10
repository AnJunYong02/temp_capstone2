import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import PdfViewer, { type CoordinateField } from '../components/PdfViewer';
import axios from 'axios';

// 템플릿 필드 타입 정의
interface TemplateField {
  id: number;
  fieldKey: string;
  label: string;
  required: boolean;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// 문서 필드 값 타입 정의
interface DocumentFieldValue {
  id?: number;
  templateFieldId: number;
  value: string;
  fieldKey?: string; // 하위 호환성을 위한 추가
}

const DocumentEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentDocument, loading, error, getDocument, clearCurrentDocument } = useDocumentStore();

  // 편집 모드 상태
  const [showPreview, setShowPreview] = useState(false);

  // 템플릿 필드 기반 입력 시스템 상태
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [documentFieldValues, setDocumentFieldValues] = useState<Map<number, string>>(new Map());
  const [showTemplateFieldPanel, setShowTemplateFieldPanel] = useState(true);

  // 저장 디바운스 관련
  const pendingSaves = useRef<Map<number, string>>(new Map());
  const saveTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // 템플릿 필드를 CoordinateField로 변환
  const convertTemplateFieldsToCoordinateFields = useCallback(() => {
    if (!Array.isArray(templateFields) || templateFields.length === 0) return [];
    
    return templateFields
      .filter(field => field.x !== null && field.y !== null)
      .map(field => {
        const value = documentFieldValues.get(field.id) || '';
        return {
          id: field.id.toString(),
          label: field.label,
          x: field.x,
          y: field.y,
          width: field.width || 100,
          height: field.height || 20,
          type: 'text' as const,
          value: value,
          required: field.required
        };
      });
  }, [templateFields, documentFieldValues]);

  // 실시간 CoordinateField 생성
  const coordinateFields = useMemo(() => {
    return convertTemplateFieldsToCoordinateFields();
  }, [convertTemplateFieldsToCoordinateFields]);

  // 문서 완성도 계산
  const documentCompletion = useMemo(() => {
    if (!Array.isArray(templateFields) || templateFields.length === 0) {
      return { completedCount: 0, totalCount: 0, percentage: 0, isComplete: true };
    }

    const requiredFields = templateFields.filter(field => field.required);
    const allFields = templateFields;
    
    const completedRequired = requiredFields.filter(field => {
      const value = documentFieldValues.get(field.id);
      return value && value.trim().length > 0;
    }).length;
    
    const completedAll = allFields.filter(field => {
      const value = documentFieldValues.get(field.id);
      return value && value.trim().length > 0;
    }).length;

    const isComplete = completedRequired === requiredFields.length;
    const percentage = allFields.length > 0 ? Math.round((completedAll / allFields.length) * 100) : 0;

    return {
      completedCount: completedAll,
      totalCount: allFields.length,
      requiredCompletedCount: completedRequired,
      requiredTotalCount: requiredFields.length,
      percentage,
      isComplete
    };
  }, [templateFields, documentFieldValues]);

  // 템플릿 필드 로드
  const loadTemplateFields = useCallback(async () => {
    if (!currentDocument?.template?.id) return;

    try {
      const response = await axios.get(`/api/templates/${currentDocument.template.id}/fields`);
      const fields = response.data as TemplateField[];
      // 배열인지 확인하고 설정
      if (Array.isArray(fields)) {
        setTemplateFields(fields);
      } else {
        console.error('템플릿 필드 응답이 배열이 아닙니다:', fields);
        setTemplateFields([]);
      }
    } catch (error) {
      console.error('템플릿 필드 로드 실패:', error);
      setTemplateFields([]);
    }
  }, [currentDocument?.template?.id]);

  // 문서 필드 값 로드
  const loadDocumentFieldValues = useCallback(async () => {
    if (!id || !Array.isArray(templateFields) || templateFields.length === 0) return;

    try {
      const response = await axios.get(`/api/documents/${id}/field-values`);
      const fieldValues = response.data as DocumentFieldValue[];
      
      // 응답이 배열인지 확인
      if (!Array.isArray(fieldValues)) {
        console.error('문서 필드 값 응답이 배열이 아닙니다:', fieldValues);
        return;
      }
      
      const valueMap = new Map<number, string>();
      fieldValues.forEach(fv => {
        if (fv.templateFieldId) {
          valueMap.set(fv.templateFieldId, fv.value || '');
        } else if (fv.fieldKey) {
          const templateField = templateFields.find(tf => tf.fieldKey === fv.fieldKey);
          if (templateField) {
            valueMap.set(templateField.id, fv.value || '');
          }
        }
      });
      
      setDocumentFieldValues(valueMap);
    } catch (error) {
      console.error('문서 필드 값 로드 실패:', error);
    }
  }, [id, templateFields]);

  // 문서 필드 값 저장 (디바운스 적용)
  const saveDocumentFieldValue = useCallback(async (templateFieldId: number, value: string) => {
    if (!id) return;

    try {
      await axios.post(`/api/documents/${id}/field-values`, [{
        templateFieldId,
        value
      }]);
    } catch (error) {
      console.error('문서 필드 값 저장 실패:', error);
    }
  }, [id]);

  // 필드 값 변경 핸들러 (디바운스)
  const handleFieldValueChange = useCallback((templateFieldId: number, value: string) => {
    // 즉시 UI 업데이트
    setDocumentFieldValues(prev => new Map(prev.set(templateFieldId, value)));
    
    // 대기 중인 저장 설정
    pendingSaves.current.set(templateFieldId, value);
    
    // 기존 타이머 클리어
    const existingTimeout = saveTimeouts.current.get(templateFieldId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // 새 타이머 설정 (1초 디바운스)
    const newTimeout = setTimeout(() => {
      const valueToSave = pendingSaves.current.get(templateFieldId);
      if (valueToSave !== undefined) {
        saveDocumentFieldValue(templateFieldId, valueToSave);
        pendingSaves.current.delete(templateFieldId);
        saveTimeouts.current.delete(templateFieldId);
      }
    }, 1000);
    
    saveTimeouts.current.set(templateFieldId, newTimeout);
  }, [saveDocumentFieldValue]);

  // 모든 대기 중인 값 즉시 저장
  const saveAllPendingValues = useCallback(async () => {
    const promises = Array.from(pendingSaves.current.entries()).map(([templateFieldId, value]) => {
      return saveDocumentFieldValue(templateFieldId, value);
    });
    
    // 모든 타이머 클리어
    saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
    saveTimeouts.current.clear();
    pendingSaves.current.clear();
    
    await Promise.all(promises);
  }, [saveDocumentFieldValue]);

  // PDF 필드 값 변경 핸들러
  const handleCoordinateFieldsChange = useCallback((fields: CoordinateField[]) => {
    fields.forEach(field => {
      const templateFieldId = parseInt(field.id);
      const currentValue = documentFieldValues.get(templateFieldId) || '';
      
      if (currentValue !== field.value) {
        handleFieldValueChange(templateFieldId, field.value || '');
      }
    });
  }, [documentFieldValues, handleFieldValueChange]);

  // PDF 다운로드 핸들러
  const handleDownloadPdf = async () => {
    if (!id) return;
    
    await saveAllPendingValues();
    
    try {
      const response = await axios.get(`/api/documents/${id}/download-pdf`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // 한글 파일명 설정
      const disposition = response.headers['content-disposition'];
      let filename = `문서_${id}.pdf`;
      if (disposition) {
        const filenameMatch = disposition.match(/filename\*=UTF-8''(.+)|filename="(.+)"/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1] || filenameMatch[2]);
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF 다운로드 실패:', error);
    }
  };

  // 미리보기 모달 토글
  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  // 컴포넌트 마운트시 초기화
  useEffect(() => {
    if (id) {
      getDocument(parseInt(id));
      
      return () => {
        // 페이지 이동시 모든 대기 중인 값 저장
        saveAllPendingValues();
        clearCurrentDocument();
      };
    }
  }, [id, getDocument, clearCurrentDocument, saveAllPendingValues]);

  // 템플릿 필드 로드
  useEffect(() => {
    if (currentDocument?.template?.id) {
      loadTemplateFields();
    }
  }, [currentDocument?.template?.id, loadTemplateFields]);

  // 문서 필드 값 로드
  useEffect(() => {
    if (templateFields.length > 0) {
      loadDocumentFieldValues();
    }
  }, [templateFields, loadDocumentFieldValues]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">오류: {error}</div>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">문서를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/documents')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← 문서 목록으로
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {currentDocument.template?.name || '문서 편집'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* 진행도 표시 */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">진행도:</span>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                documentCompletion.isComplete 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {documentCompletion.percentage}%
                ({documentCompletion.completedCount}/{documentCompletion.totalCount})
              </div>
            </div>
            
            {/* 미리보기 버튼 */}
            <button
              onClick={togglePreview}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {showPreview ? '편집으로 돌아가기' : '미리보기'}
            </button>
            
            {/* PDF 다운로드 버튼 */}
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              PDF 다운로드
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 템플릿 필드 입력 패널 */}
        {showTemplateFieldPanel && !showPreview && (
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">필드 입력</h3>
              <button
                onClick={() => setShowTemplateFieldPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {Array.isArray(templateFields) && templateFields.map(field => (
                <div key={field.id} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <textarea
                    value={documentFieldValues.get(field.id) || ''}
                    onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder={field.required ? '필수 입력 필드입니다' : '선택 입력 필드입니다'}
                  />
                </div>
              ))}
              
              {(!Array.isArray(templateFields) || templateFields.length === 0) && (
                <div className="text-center text-gray-500 py-8">
                  템플릿 필드가 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* PDF 뷰어 */}
        <div className="flex-1 relative">
          {currentDocument.template?.pdfImagePath && (
            <PdfViewer
              pdfImageUrl={`http://localhost:8080/${currentDocument.template.pdfImagePath}`}
              coordinateFields={coordinateFields}
              onCoordinateFieldsChange={handleCoordinateFieldsChange}
              editable={!showPreview}
              showFieldUI={!showPreview}
            />
          )}
          
          {/* 우측 하단 패널 접기 버튼 */}
          {!showTemplateFieldPanel && !showPreview && (
            <button
              onClick={() => setShowTemplateFieldPanel(true)}
              className="absolute bottom-4 left-4 bg-blue-600 text-white p-2 rounded-lg shadow-lg hover:bg-blue-700"
              title="필드 입력 패널 열기"
            >
              📝
            </button>
          )}
        </div>
      </div>

      {/* 미리보기 모달 */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold">문서 미리보기</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  documentCompletion.isComplete 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  완성도: {documentCompletion.percentage}%
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDownloadPdf}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  PDF 다운로드
                </button>
                <button
                  onClick={togglePreview}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {currentDocument.template?.pdfImagePath && (
                <PdfViewer
                  pdfImageUrl={`http://localhost:8080/${currentDocument.template.pdfImagePath}`}
                  coordinateFields={coordinateFields}
                  onCoordinateFieldsChange={() => {}} // 미리보기에서는 편집 불가
                  editable={false}
                  showFieldUI={true}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentEditor;
