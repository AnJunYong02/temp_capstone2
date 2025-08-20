import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import axios from 'axios';
import { 
  logCoordinateConversion 
} from '../utils/coordinateUtils';
import { debugTemplateField } from '../utils/coordinateDebugger';
import DocumentPreviewModal from '../components/DocumentPreviewModal';

// 간단한 debounce 유틸 함수
const createDebounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// 텍스트에 최적화된 폰트 크기 계산
const calculateOptimalFontSize = (text: string, maxWidth: number, maxHeight: number): string => {
  if (!text || maxWidth <= 0 || maxHeight <= 0) return '10px';
  
  // 기본 폰트 크기에서 시작
  let fontSize = 12;
  const minFontSize = 8;
  const maxFontSize = 16;
  
  // 텍스트 길이에 따른 기본 조정
  const textLength = text.length;
  if (textLength > 20) fontSize = 10;
  if (textLength > 40) fontSize = 9;
  if (textLength > 60) fontSize = 8;
  
  // 셀 크기에 따른 조정
  const heightBasedSize = Math.floor(maxHeight * 0.6); // 높이의 60%
  const widthBasedSize = Math.floor(maxWidth / Math.max(1, textLength * 0.6)); // 너비 기반 추정
  
  fontSize = Math.min(fontSize, heightBasedSize, widthBasedSize);
  fontSize = Math.max(minFontSize, Math.min(maxFontSize, fontSize));
  
  return `${fontSize}px`;
};

// CoordinateField 타입 정의 (PdfViewer에서 가져오지 않고 직접 정의)
interface CoordinateField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'table';
  value?: string;
  required?: boolean;
  // 표 전용 속성
  tableId?: string;
  rows?: number;
  columnsCount?: number;
  columns?: Array<{
    title: string;
    width: number;
    height?: number;
    width_ratio?: string;
    location_column: string;
  }>;
}

// 템플릿 필드 타입 정의
interface TemplateField {
  id: number;
  fieldKey: string;
  label: string;
  fieldType: string;
  width: number;
  height: number;
  required: boolean;
  x: number; // coordinateX -> x로 변경
  y: number; // coordinateY -> y로 변경
}

const DocumentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDocument, loading, getDocument, updateDocumentSilently, clearCurrentDocument } = useDocumentStore();

  // 템플릿 필드 기반 입력 시스템 상태
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  
  // CoordinateFields 상태를 별도로 관리 (리렌더링 최적화)
  const [coordinateFields, setCoordinateFields] = useState<CoordinateField[]>([]);
  const [tableDataMap, setTableDataMap] = useState<Record<string, string>>({});
  const [tableFontSizeMap, setTableFontSizeMap] = useState<Record<string, number>>({});

  // 저장된 표 데이터를 tableDataMap에 로드
  useEffect(() => {
    if (currentDocument?.data?.["table data"]) {
      const savedTableData = currentDocument.data["table data"];
      const newTableDataMap: Record<string, string> = {};
      const newTableFontSizeMap: Record<string, number> = {};
      
      savedTableData.forEach((item: any) => {
        if (item.tableId && item.location_row && item.location_column && item.value) {
          const key = `${item.tableId}:${item.location_row}:${item.location_column}`;
          newTableDataMap[key] = item.value;
          newTableFontSizeMap[key] = item["font-size"] ? parseInt(item["font-size"]) : 10;
        }
      });
      
      console.log('📋 저장된 표 데이터 로드:', {
        savedTableData,
        newTableDataMap,
        newTableFontSizeMap
      });
      
      setTableDataMap(newTableDataMap);
      setTableFontSizeMap(newTableFontSizeMap);
    }
  }, [currentDocument?.data]);
  
  // 저장 상태 관리
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // 저장 관련 refs
  const pendingSaves = useRef<Map<number, string>>(new Map());
  const saveTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // 템플릿 필드가 로드되면 coordinateFields 초기화
  useEffect(() => {
    if (Array.isArray(templateFields) && templateFields.length > 0) {
      console.log('📄 [편집단계] 템플릿 필드가 로드됨, coordinateFields 초기화:', {
        documentId: id,
        fieldsCount: templateFields.length,
        rawTemplateFields: templateFields
      });
      
      // 템플릿 필드 기반으로 coordinateFields 초기화 (픽셀값 직접 사용)
      const initialFields = templateFields
        .filter(field => field.x !== undefined && field.y !== undefined)
        .map(field => {
          // 픽셀 좌표를 그대로 사용 (변환 없음)
          const pixelCoords = {
            x: field.x,
            y: field.y,
            width: field.width || 100,
            height: field.height || 30
          };
          
          console.log('🎯 [편집단계] 필드 좌표 처리:', {
            fieldId: field.id,
            label: field.label,
            원본_템플릿필드_좌표: { x: field.x, y: field.y, width: field.width, height: field.height },
            최종_픽셀좌표: pixelCoords
          });
          
          logCoordinateConversion(
            '픽셀값 직접 사용',
            pixelCoords,
            pixelCoords,
            field.label
          );

          // 디버깅: 편집 단계에서의 필드 정보 출력
          const fieldForDebug = {
            id: field.id,
            label: field.label,
            x: pixelCoords.x,
            y: pixelCoords.y,
            width: pixelCoords.width,
            height: pixelCoords.height,
            required: field.required
          };
          debugTemplateField(fieldForDebug, 'editing');

          return {
            id: field.id.toString(),
            label: field.label,
            x: pixelCoords.x,
            y: pixelCoords.y,
            width: pixelCoords.width,
            height: pixelCoords.height,
            type: field.type || (field.fieldType?.toLowerCase() === 'date' ? 'date' : 'text') as 'text' | 'date' | 'table',
            value: '', // 빈 값으로 시작
            required: field.required,
            // 표 필드 속성들 추가
            ...(field.type === 'table' ? {
              tableId: field.tableId,
              rows: field.rows,
              columnsCount: field.columnsCount,
              columns: field.columns
            } : {})
          };
        });
      
      console.log('🎯 [편집단계] 최종 coordinateFields 설정:', initialFields);
      console.log('🎯 [편집단계] 표 필드 확인:', initialFields.filter(f => f.type === 'table'));
      setCoordinateFields(initialFields);
    }
  }, [templateFields, id]);

  // CoordinateFields 초기화 (문서별 독립적 관리)
  useEffect(() => {
    console.log('🔄 CoordinateFields 초기화:', {
      documentId: id,
      currentDocumentFields: currentDocument?.data?.coordinateFields?.length || 0,
      currentDocumentId: currentDocument?.id,
      tableInitFields: currentDocument?.data?.["table init Fields"]?.length || 0
    });
    
    // 문서 ID가 다르면 필드 구조는 유지하되 값만 초기화
    if (currentDocument && id && currentDocument.id !== parseInt(id)) {
      console.log('🧹 다른 문서로 변경됨, coordinateFields 값만 초기화');
      setCoordinateFields(prev => prev.map(field => ({ ...field, value: '' })));
      return;
    }
    
    // 템플릿 필드가 없고 기존 문서 데이터가 있는 경우에만 사용
    if ((!Array.isArray(templateFields) || templateFields.length === 0) && 
        currentDocument?.data?.coordinateFields && 
        Array.isArray(currentDocument.data.coordinateFields)) {
      // 기존 문서 데이터 기반으로 설정 (이 문서의 저장된 값 사용)
      console.log('💾 문서 데이터 기반으로 coordinateFields 설정:', {
        documentId: id,
        fieldsCount: currentDocument.data.coordinateFields.length
      });
      const processedFields = currentDocument.data.coordinateFields.map((field: any) => ({
        id: field.id.toString(),
        label: field.label || `필드 ${field.id}`,
        x: field.x,
        y: field.y,
        width: field.width || 100,
        height: field.height || 20,
        type: (field.type || 'text') as CoordinateField['type'],
        value: field.value || '', // 이 문서에 저장된 값 사용
        required: field.required || false,
        // 표 필드 속성들 추가
        ...(field.type === 'table' ? {
          tableId: field.tableId,
          rows: field.rows,
          columnsCount: field.columnsCount,
          columns: field.columns
        } : {})
      }));
      setCoordinateFields(processedFields);
    }
  }, [currentDocument?.data?.coordinateFields, currentDocument?.id, id, templateFields]);

  // 디바운스된 문서 업데이트 함수
  const debouncedUpdateDocument = useCallback(
    createDebounce(async (documentId: number, data: any) => {
      const success = await updateDocumentSilently(documentId, data);
      if (success) {
        setLastSaved(new Date());
      }
    }, 1000),
    [updateDocumentSilently]
  );

  // 표 데이터 저장 함수
  const saveTableData = useCallback(async (tableId: string, row: number, col: number, value: string, fontSize?: number) => {
    if (!id || !currentDocument) return;

    try {
      // 현재 문서 데이터 가져오기
      const currentData = currentDocument.data || {};
      const existingTableData = currentData["table data"] || [];
      
      // 기존 데이터에서 해당 위치의 데이터 제거
      const filteredTableData = existingTableData.filter(
        (item: any) => !(item.tableId === tableId && 
                        item.location_row === String(row) && 
                        item.location_column === String(col))
      );
      
      // 값이 비어있지 않으면 새 데이터 추가
      const updatedTableData = [...filteredTableData];
      if (value.trim()) {
        // 해당 셀의 크기 정보 찾기
        const tableField = coordinateFields.find(f => f.type === 'table' && (f.tableId === tableId || f.id === tableId));
        const columnInfo = tableField?.columns?.find(c => c.location_column === String(col));
        
        updatedTableData.push({
          tableId,
          value: value.trim(),
          location_column: String(col),
          location_row: String(row),
          width: columnInfo?.width ? String(Math.round(columnInfo.width)) : "100",
          height: columnInfo?.height ? String(Math.round(columnInfo.height)) : "30",
          "font-size": String(fontSize || 10)
        });
      }

      // 문서 데이터 업데이트
      const newData = {
        ...currentData,
        "table data": updatedTableData
      };

      console.log('💾 표 데이터 저장:', {
        tableId,
        row,
        col,
        value,
        updatedTableData
      });

      await debouncedUpdateDocument(parseInt(id), { data: newData });
    } catch (error) {
      console.error('표 데이터 저장 실패:', error);
    }
  }, [id, currentDocument, debouncedUpdateDocument]);

  // 디바운스된 표 데이터 저장 함수
  const debouncedSaveTableData = useMemo(
    () => createDebounce(saveTableData, 800),
    [saveTableData]
  );

  // 문서 필드 값 저장
  const saveDocumentFieldValue = useCallback(async (templateFieldId: number, value: string) => {
    if (!id) return;

    try {
      console.log('💾 필드 값 저장 시작:', { 
        documentId: id, 
        templateFieldId, 
        value,
        timestamp: new Date().toISOString()
      });
      
      // 백엔드 API는 단일 객체를 받음 (배열이 아님)
      await axios.post(`/api/documents/${id}/field-values`, {
        templateFieldId,
        value
      });
      
      console.log('💾 필드 값 저장 성공:', {
        documentId: id,
        templateFieldId,
        value
      });
      
      // 자동 저장 성공 시 시간 업데이트
      setLastSaved(new Date());
    } catch (error) {
      console.error('문서 필드 값 저장 실패:', {
        documentId: id,
        templateFieldId,
        value,
        error
      });
    }
  }, [id]);

  // 수동 저장 함수
  const handleManualSave = useCallback(async () => {
    if (!id || !currentDocument) return;
    
    setIsSaving(true);
    try {
      // 대기 중인 모든 필드 값 즉시 저장
      const promises: Promise<any>[] = [];
      
      // 템플릿 필드 값 저장
      if (pendingSaves.current.size > 0) {
        Array.from(pendingSaves.current.entries()).forEach(([templateFieldId, value]) => {
          promises.push(saveDocumentFieldValue(templateFieldId, value));
        });
        pendingSaves.current.clear();
      }
      
      // 좌표/표 필드 저장 (템플릿 필드가 없는 경우)
      if (Array.isArray(templateFields) === false || templateFields.length === 0) {
        // 필요한 데이터만 포함하여 저장
        const tableInitFields = coordinateFields
          .filter(f => f.type === 'table')
          .map(f => ({
            type: 'table',
            tableId: f.tableId || f.id,
            x: Math.round(f.x),
            y: Math.round(f.y),
            height: Math.round(f.height),
            width: Math.round(f.width),
            columns: (f.columns || []).map(c => ({
              title: c.title,
              width: String(Math.round(c.width)),
              width_ratio: c.width_ratio || '1',
              location_column: c.location_column
            }))
          }));

        const tableDataArray = Object.entries(tableDataMap).map(([key, value]) => {
          const [tableId, r, c] = key.split(':');
          return { value, location_column: c, location_row: r, tableId };
        });

        const updatedData: any = {
          coordinateFields: coordinateFields.map(field => ({
            id: field.id,
            label: field.label,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            type: field.type,
            value: field.value,
            required: field.required,
            ...(field.type === 'table' ? { tableId: field.tableId || field.id, rows: field.rows, columnsCount: field.columnsCount, columns: field.columns } : {})
          }))
        };

        if (tableInitFields.length > 0) updatedData['table init Fields'] = tableInitFields;
        if (tableDataArray.length > 0) updatedData['table data'] = tableDataArray;

        promises.push(updateDocumentSilently(parseInt(id), { data: updatedData }));
      }
      
      // 모든 저장 작업 완료 대기
      await Promise.all(promises);
      
      // 모든 타이머 클리어
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      saveTimeouts.current.clear();
      
      setLastSaved(new Date());
    } catch (error) {
      console.error('수동 저장 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [id, currentDocument, templateFields, coordinateFields, saveDocumentFieldValue, updateDocumentSilently]);

  // 안정된 핸들러 ref (리렌더링 방지)
  const stableHandlersRef = useRef({
    saveDocumentFieldValue,
    debouncedUpdateDocument
  });

  // 핸들러 ref 업데이트
  useEffect(() => {
    stableHandlersRef.current.saveDocumentFieldValue = saveDocumentFieldValue;
    stableHandlersRef.current.debouncedUpdateDocument = debouncedUpdateDocument;
  }, [saveDocumentFieldValue, debouncedUpdateDocument]);

  // PDF 필드 값 변경 핸들러 (최적화 - 안정된 참조)
  // 개별 CoordinateField 값 변경 핸들러 (간소화)
  const handleCoordinateFieldChange = useCallback((fieldId: string, value: string) => {
    if (!id || !currentDocument) return;

    console.log('🔧 좌표 필드 값 변경:', {
      documentId: id,
      fieldId,
      value,
      timestamp: new Date().toISOString()
    });

    // 즉시 로컬 coordinateFields 상태 업데이트 (리렌더링 방지)
    setCoordinateFields(prev => {
      const updated = prev.map(field => 
        field.id === fieldId 
          ? { ...field, value } 
          : field
      );
      console.log('🔧 coordinateFields 로컬 업데이트:', {
        documentId: id,
        fieldId,
        value,
        allFields: updated.map(f => ({ id: f.id, label: f.label, value: f.value }))
      });
      return updated;
    });

    // 템플릿 필드가 있는 경우
    if (Array.isArray(templateFields) && templateFields.length > 0) {
      const templateFieldId = parseInt(fieldId);
      
      console.log('🔧 템플릿 필드 모드:', {
        documentId: id,
        templateFieldId,
        value
      });
      
      // 서버 저장은 디바운스 적용
      pendingSaves.current.set(templateFieldId, value);
      const existingTimeout = saveTimeouts.current.get(templateFieldId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      const newTimeout = setTimeout(() => {
        const valueToSave = pendingSaves.current.get(templateFieldId);
        if (valueToSave !== undefined) {
          console.log('💾 디바운스된 템플릿 필드 저장:', {
            documentId: id,
            templateFieldId,
            valueToSave
          });
          stableHandlersRef.current.saveDocumentFieldValue(templateFieldId, valueToSave);
          pendingSaves.current.delete(templateFieldId);
          saveTimeouts.current.delete(templateFieldId);
        }
      }, 1000);
      
      saveTimeouts.current.set(templateFieldId, newTimeout);
      return;
    }

    console.log('🔧 좌표 필드 모드 (템플릿 필드 없음):', {
      documentId: id,
      fieldId,
      value
    });

    // 템플릿 필드가 없는 경우 - 전체 업데이트 (디바운스 적용)
    const updatedFields = coordinateFields.map(field => 
      field.id === fieldId 
        ? { ...field, value } 
        : field
    );
    
    // 필요한 데이터만 포함하여 저장 (빈 값 제외)
    const updatedData = {
      coordinateFields: updatedFields
    } as any;
    
    stableHandlersRef.current.debouncedUpdateDocument(parseInt(id!), { data: updatedData });
  }, [id, currentDocument, templateFields, coordinateFields]);

  // 템플릿 필드 로드
  const loadTemplateFields = useCallback(async () => {
    if (!currentDocument?.templateId) {
      console.log('🔧 템플릿 ID가 없어서 템플릿 필드 로드 스킵');
      setTemplateFields([]);
      return;
    }

    try {
      console.log('🔧 [편집단계] 템플릿 필드 로드 시작:', {
        documentId: currentDocument.id,
        templateId: currentDocument.templateId
      });
      
      // 템플릿 필드 로드 전에 이전 값들 초기화
      
      const response = await axios.get(`/api/templates/${currentDocument.templateId}/fields`);
      
      console.log('🔧 [편집단계] 템플릿 필드 API 응답:', {
        documentId: currentDocument.id,
        templateId: currentDocument.templateId,
        responseData: response.data,
        isArray: Array.isArray(response.data),
        fieldsCount: Array.isArray(response.data) ? response.data.length : 0
      });
      
      if (Array.isArray(response.data)) {
        console.log('🔧 [편집단계] 템플릿 필드 로드 성공, 각 필드 상세:', 
          response.data.map(field => ({
            id: field.id,
            label: field.label,
            fieldKey: field.fieldKey,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            fieldType: field.fieldType
          }))
        );
        setTemplateFields(response.data);
      } else {
        console.warn('템플릿 필드 응답이 배열이 아닙니다:', response.data);
        setTemplateFields([]);
      }
    } catch (error) {
      console.error('템플릿 필드 로드 실패:', {
        documentId: currentDocument.id,
        templateId: currentDocument.templateId,
        error
      });
      setTemplateFields([]);
    }
  }, [currentDocument?.templateId, currentDocument?.id]); // currentDocument.id도 의존성에 추가

  // 문서 필드 값 로드
  const loadDocumentFieldValues = useCallback(async () => {
    if (!id || !Array.isArray(templateFields) || templateFields.length === 0) {
      console.log('📥 필드 값 로드 스킵:', { 
        hasId: !!id, 
        hasTemplateFields: Array.isArray(templateFields) && templateFields.length > 0 
      });
      return;
    }

    try {
      console.log('📥 필드 값 로드 시작:', {
        documentId: id,
        templateFieldsCount: templateFields.length,
        templateFieldIds: templateFields.map(tf => tf.id)
      });
      
      const response = await axios.get(`/api/documents/${id}/field-values`);
      const fieldValues = response.data;
      console.log('📥 서버에서 받은 필드 값:', {
        documentId: id,
        fieldValues,
        fieldValuesType: Array.isArray(fieldValues) ? 'array' : typeof fieldValues,
        fieldValuesLength: Array.isArray(fieldValues) ? fieldValues.length : 'N/A'
      });
      
      // coordinateFields 업데이트 - 템플릿 필드 정보에 저장된 값 추가
      const updated = templateFields.map(templateField => {
        const fieldValue = Array.isArray(fieldValues) ? 
          fieldValues.find((fv: any) => fv.templateFieldId === templateField.id) : 
          null;
        const value = fieldValue ? (fieldValue.value || '') : '';
        
        console.log('📥 필드 값 매핑:', {
          templateFieldId: templateField.id,
          templateFieldLabel: templateField.label,
          foundFieldValue: !!fieldValue,
          value: value
        });
        
        // 픽셀 좌표를 그대로 사용 (변환 없음)
        const pixelCoords = {
          x: templateField.x,
          y: templateField.y,
          width: templateField.width || 100,
          height: templateField.height || 30
        };
        
        return {
          id: templateField.id.toString(),
          label: templateField.label || `필드 ${templateField.id}`,
          x: pixelCoords.x,
          y: pixelCoords.y,
          width: pixelCoords.width,
          height: pixelCoords.height,
          type: 'text' as 'text' | 'date',
          value: value,
          required: templateField.required || false
        };
      });
      
      console.log('📥 업데이트된 coordinateFields:', {
        documentId: id,
        updated: updated.map(f => ({ id: f.id, label: f.label, value: f.value, x: f.x, y: f.y }))
      });
      setCoordinateFields(updated);
    } catch (error) {
      console.error('문서 필드 값 로드 실패:', {
        documentId: id,
        error
      });
      // 오류 시에도 템플릿 필드 기반으로 coordinateFields 설정 (값은 빈 상태)
      setCoordinateFields(templateFields.map(templateField => {
        const pixelCoords = {
          x: templateField.x,
          y: templateField.y,
          width: templateField.width || 100,
          height: templateField.height || 30
        };
        
        return {
          id: templateField.id.toString(),
          label: templateField.label || `필드 ${templateField.id}`,
          x: pixelCoords.x,
          y: pixelCoords.y,
          width: pixelCoords.width,
          height: pixelCoords.height,
          type: 'text' as 'text' | 'date',
          value: '',
          required: templateField.required || false
        };
      }));
    }
  }, [id, templateFields]);

  // 초기 데이터 로드
  useEffect(() => {
    if (id) {
      // 페이지 방문 시 항상 최신 문서 데이터를 로드
      console.log('📄 문서 로드 시작:', id);
      
      // 상태 초기화 - 문서 변경 시 이전 상태 완전히 초기화
      setTemplateFields([]);
      // coordinateFields는 필드 구조 유지, 값만 초기화
      setCoordinateFields(prev => prev.map(field => ({ ...field, value: '' })));
      
      getDocument(parseInt(id));
    }
  }, [id, getDocument]);

  // 문서가 변경될 때마다 상태 완전 초기화
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 또는 문서 변경 시 상태 초기화
      console.log('🧹 문서 에디터 상태 초기화:', { documentId: id });
      setTemplateFields([]);
      // coordinateFields는 필드 구조 유지, 값만 초기화
      setCoordinateFields(prev => prev.map(field => ({ ...field, value: '' })));
      setIsSaving(false);
      setLastSaved(null);
      
      // DocumentStore 상태도 초기화
      clearCurrentDocument();
      
      // 대기 중인 저장 작업 취소
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      saveTimeouts.current.clear();
      pendingSaves.current.clear();
    };
  }, [id, clearCurrentDocument]); // id가 변경될 때마다 초기화

  useEffect(() => {
    if (currentDocument) {
      loadTemplateFields();
    }
  }, [currentDocument, loadTemplateFields]);

  useEffect(() => {
    if (templateFields.length > 0) {
      loadDocumentFieldValues();
    }
  }, [templateFields, loadDocumentFieldValues]);

  // 키보드 단축키 (Ctrl+S / Cmd+S로 저장)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleManualSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleManualSave]);

  // 컴포넌트 언마운트 시 상태 정리
  useEffect(() => {
    return () => {
      // 타이머 정리
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      saveTimeouts.current.clear();
      pendingSaves.current.clear();
      
      // 상태 초기화
      setTemplateFields([]);
      setCoordinateFields([]);
      setIsSaving(false);
      setLastSaved(null);
    };
  }, []);

  // PDF 뷰어 렌더링 (CSS Transform 스케일링 적용)
  const renderPdfViewer = useMemo(() => {
    if (!currentDocument?.template?.pdfImagePath) return null;
    
    // PDF 이미지 파일 경로 (.png 파일 사용)
    const imageFileName = currentDocument.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
    const pdfImageUrl = `/uploads/pdf-templates/${imageFileName}`;
    
    return (
      <div className="relative bg-gray-100 h-full overflow-auto flex justify-center items-start p-4">
        {/* PDF 컨테이너 - 고정 크기 */}
        <div 
          className="relative bg-white shadow-sm border"
          style={{
            width: '1240px',
            height: '1754px',
            minWidth: '1240px', // 최소 크기를 원본 크기로 고정
            minHeight: '1754px', // 최소 높이도 원본 크기로 고정
            flexShrink: 0 // 컨테이너가 줄어들지 않도록 설정
          }}
        >
          {/* PDF 배경 이미지 */}
          <img 
            src={pdfImageUrl}
            alt="PDF Preview"
            className="absolute inset-0"
            style={{
              width: '1240px',
              height: '1754px',
              objectFit: 'fill'
            }}
            onError={() => {
              console.error('PDF 이미지 로드 실패:', pdfImageUrl);
            }}
          />
          
          {/* 필드 컨테이너 - 퍼센트 기반 위치 */}
          <div className="absolute inset-0"
          >
            {/* 필드 오버레이 - 퍼센트 기반 위치 */}
            {coordinateFields.map((field) => {
              console.log('🎯 편집 화면 - 필드 렌더링:', {
                id: field.id,
                label: field.label,
                x: field.x,
                y: field.y,
                width: field.width,
                height: field.height,
                value: field.value
              });
              
              // 퍼센트 기반 위치 계산
              // const leftPercent = (field.x / 1240) * 100;
              // const topPercent = (field.y / 1754) * 100.5;
              // const widthPercent = (field.width / 1240) * 100.5;
              // const heightPercent = (field.height / 1754) * 100.5;

              // 픽셀값 직접 사용
              const leftPercent = field.x;
              const topPercent = field.y;
              const widthPercent = field.width;
              const heightPercent = field.height;

              if (field.type === 'table') {
                const tableId = field.tableId || field.id;
                const rows = field.rows || 3;
                const cols = field.columnsCount || (field.columns?.length || 1);
                
                // 컬럼 정보가 없는 경우 기본 컬럼 생성
                let columns = field.columns || [];
                if (columns.length === 0) {
                  const defaultColumnWidth = Math.floor(widthPercent / cols);
                  columns = Array.from({ length: cols }, (_, i) => ({
                    title: `컬럼${i + 1}`,
                    width: defaultColumnWidth,
                    width_ratio: String(defaultColumnWidth),
                    location_column: String(i + 1)
                  }));
                  console.log('⚠️ 기본 컬럼 생성:', columns);
                }
                
                const headerHeight = 30; // 헤더 높이 고정
                // 컬럼에 height 정보가 있으면 사용, 없으면 균등 분할
                const hasColumnHeights = columns.some(col => col.height && col.height > 0);
                const cellHeight = hasColumnHeights 
                  ? (columns[0]?.height || 30) 
                  : Math.max(25, (heightPercent - headerHeight) / Math.max(1, rows));
                
                // 실제 표 높이 계산 (헤더 + 모든 행)
                const actualTableHeight = headerHeight + rows * cellHeight;
                
                console.log('🔍 표 필드 렌더링 디버그:', {
                  fieldId: field.id,
                  tableId,
                  rows,
                  cols,
                  columns,
                  tableDataMapKeys: Object.keys(tableDataMap),
                  tableDataMapValues: tableDataMap
                });
                
                return (
                  <div
                    key={field.id}
                    className="absolute border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-40"
                    style={{
                      left: `${leftPercent}px`,
                      top: `${topPercent}px`,
                      width: `${widthPercent}px`,
                      height: `${actualTableHeight}px`, // 동적 높이 사용
                      zIndex: 10
                    }}
                    title={`표 영역 (${tableId})`}
                  >
                    {/* 컬럼 헤더 */}
                    <div className="absolute top-0 left-0 w-full h-6 bg-blue-100 border-b border-blue-300 flex">
                      {columns.map((col, colIndex) => {
                        // 컬럼 너비 계산 (최소 30px 보장)
                        const colWidth = Math.max(30, col.width || Math.floor(widthPercent / cols));
                        console.log('🔍 컬럼 헤더 렌더링:', {
                          colIndex,
                          title: col.title,
                          originalWidth: col.width,
                          calculatedWidth: colWidth
                        });
                        
                        return (
                          <div
                            key={colIndex}
                            className="flex items-center justify-center text-xs text-blue-800 border-r border-blue-300 last:border-r-0"
                            style={{ width: colWidth }}
                          >
                            <span className="truncate px-1">{col.title}</span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* 표 데이터 셀 */}
                    {Array.from({ length: rows }).map((_, ri) => (
                      <div key={`row-${ri}`} className="absolute left-0 flex" style={{ 
                        top: headerHeight + ri * cellHeight, 
                        height: cellHeight 
                      }}>
                        {columns.map((col, ci) => {
                          const rowIndex = ri + 1; // 1부터 시작
                          const colIndex = ci + 1; // 1부터 시작
                          const colWidth = Math.max(30, col.width || Math.floor(widthPercent / cols));
                          
                          // 실시간 입력 데이터 또는 저장된 데이터에서 셀 값 찾기
                          const inputKey = `${tableId}:${rowIndex}:${colIndex}`;
                          const inputValue = tableDataMap[inputKey];
                          const customFontSize = tableFontSizeMap[inputKey];
                          
                          // 우선순위: 실시간 입력 > 저장된 데이터
                          let cellValue = inputValue;
                          if (!cellValue) {
                            const savedTableData = currentDocument?.data?.["table data"] || [];
                            const cellData = savedTableData.find((item: any) => 
                              item.tableId === tableId && 
                              item.location_row === String(rowIndex) && 
                              item.location_column === String(colIndex)
                            );
                            cellValue = cellData?.value || '';
                          }
                          
                          console.log('🔍 셀 데이터 디버그:', {
                            tableId,
                            rowIndex,
                            colIndex,
                            inputKey,
                            inputValue,
                            cellValue,
                            hasInputValue: !!inputValue,
                            hasSavedValue: !!cellValue
                          });
                          
                          return (
                            <div
                              key={`cell-${ci}`}
                              className="flex items-center justify-center border-r border-blue-200 last:border-r-0 px-1 py-1"
                              style={{ 
                                width: colWidth,
                                height: cellHeight,
                                backgroundColor: cellValue ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                                overflow: 'hidden'
                              }}
                            >
                              {cellValue && (
                                <div 
                                  className="w-full h-full flex items-center justify-center text-center leading-tight"
                                  style={{
                                    fontSize: customFontSize ? `${customFontSize}px` : calculateOptimalFontSize(cellValue, colWidth - 8, cellHeight - 4),
                                    wordBreak: 'break-all',
                                    overflowWrap: 'break-word',
                                    hyphens: 'auto'
                                  }}
                                >
                                  {cellValue}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    
                    {/* 행 구분선 */}
                    {Array.from({ length: rows - 1 }).map((_, ri) => (
                      <div
                        key={`line-${ri}`}
                        className="absolute left-0 w-full border-t border-blue-200"
                        style={{ top: headerHeight + (ri + 1) * cellHeight }}
                      />
                    ))}
                  </div>
                );
              }
              return (
                <div
                  key={field.id}
                  className="absolute border-2 bg-blue-100 bg-opacity-30 hover:bg-opacity-50 transition-colors border-blue-500 flex flex-col justify-center cursor-pointer"
                  style={{
                    left: `${leftPercent}px`,
                    top: `${topPercent}px`,
                    width: `${widthPercent}px`,
                    height: `${heightPercent}px`,
                  }}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 필드를 찾아서 편집 상태로 설정
                    const templateField = templateFields.find(tf => tf.id.toString() === field.id);
                    if (templateField) {
                      // 우측 패널에서 해당 필드로 포커스 이동
                      const input = document.querySelector(`input[data-field-id="${field.id}"]`) as HTMLInputElement;
                      if (input) {
                        input.focus();
                        input.select();
                      }
                    }
                  }}
                >
                  {field.value ? (
                    <div className="text-xs text-gray-900 p-1 truncate font-medium bg-white bg-opacity-80 rounded text-center">
                      {field.value}
                    </div>
                  ) : (
                    <div className="text-xs text-blue-700 font-medium p-1 truncate text-center">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }, [currentDocument?.template?.pdfImagePath, coordinateFields, templateFields, tableDataMap, tableFontSizeMap]);

  // 디버깅: 전체 상태 출력
  useEffect(() => {
    console.log('🔍 전체 상태 디버깅:', {
      documentId: id,
      coordinateFieldsCount: coordinateFields.length,
      tableFields: coordinateFields.filter(f => f.type === 'table'),
      tableDataMapSize: Object.keys(tableDataMap).length,
      tableDataMap: tableDataMap,
      savedTableData: currentDocument?.data?.["table data"] || []
    });
  }, [coordinateFields, tableDataMap, currentDocument?.data, id]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">문서를 불러오는 중...</div>;
  }

  if (!currentDocument) {
    return <div className="flex items-center justify-center h-64">문서를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* 헤더 - 고정 위치 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b px-6 py-4 flex justify-between items-center w-full">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{currentDocument.data?.title || '문서 편집'}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">문서 편집</p>
            {lastSaved && (
              <span className="text-xs text-green-600">
                • 마지막 저장: {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {isSaving && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                    <animate attributeName="stroke-dashoffset" dur="1s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                  </circle>
                </svg>
                저장 중...
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            미리보기
          </button>
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
              isSaving 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                    <animate attributeName="stroke-dashoffset" dur="1s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                  </circle>
                </svg>
                저장 중
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                저장
              </>
            )}
          </button>
          <button
            onClick={() => navigate('/documents')}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            돌아가기
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 - 헤더 아래 고정 레이아웃 */}
      <div className="fixed top-24 left-0 right-0 bottom-0 flex w-full">
        {/* 왼쪽 패널 - PDF 뷰어 */}
        <div className="flex-1 bg-gray-100 overflow-auto flex justify-center items-start p-4">
          {renderPdfViewer || (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">PDF 파일이 없습니다.</p>
            </div>
          )}
        </div>

        {/* 오른쪽 패널 - 필드 목록 (고정 너비, 고정 위치) */}
        <div className="w-80 bg-white border-l overflow-y-auto flex-shrink-0 h-full">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-medium text-gray-900">문서 필드</h2>
            <p className="text-sm text-gray-500 mt-1">
              {coordinateFields.length}개 필드
            </p>
          </div>
          
          <div className="p-4 space-y-4">
            {coordinateFields.filter(f=>f.type!== 'table').map((field) => (
              <div key={field.id} className="border rounded-lg p-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'date' ? (
                  <input
                    type="date"
                    value={field.value || ''}
                    data-field-id={field.id}
                    onChange={(e) => handleCoordinateFieldChange(field.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <input
                    type="text"
                    value={field.value || ''}
                    data-field-id={field.id}
                    onChange={(e) => handleCoordinateFieldChange(field.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`${field.label} 입력`}
                  />
                )}
              </div>
            ))}

            {/* 표 데이터 입력 */}
            {coordinateFields.filter(f=>f.type==='table').map((tbl) => {
              const rows = tbl.rows || 3;
              const cols = tbl.columnsCount || (tbl.columns?.length || 1);
              const headers = (tbl.columns || []).map(c=>c.title);
              const tableKey = tbl.tableId || tbl.id;
              
              console.log('🔍 우측 패널 표 렌더링 디버그:', {
                tableId: tableKey,
                rows,
                cols,
                headers,
                columns: tbl.columns,
                fieldType: tbl.type
              });
              return (
                <div key={`tbl-${tableKey}`} className="border rounded-lg p-3">
                  <div className="font-medium text-gray-800 mb-2">표 입력</div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-xs border">
                      <thead>
                        <tr className="bg-gray-50">
                          {Array.from({ length: cols }).map((_, ci) => (
                            <th key={`h-${ci}`} className="border px-2 py-1 text-left">{headers[ci] || `컬럼${ci+1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: rows }).map((_, ri) => (
                          <tr key={`r-${ri}`}>
                            {Array.from({ length: cols }).map((_, ci) => {
                              // 1부터 시작하는 인덱스로 변경
                              const rowIndex = ri + 1;
                              const colIndex = ci + 1;
                              const key = `${tableKey}:${rowIndex}:${colIndex}`;
                              const val = tableDataMap[key] || '';
                              const fontSize = tableFontSizeMap[key] || 10;
                              
                              return (
                                <td key={`c-${ci}`} className="border px-1 py-1">
                                  <div className="space-y-1">
                                    <input
                                      type="text"
                                      value={val}
                                      onChange={(e) => {
                                        const newValue = e.target.value;
                                        console.log('📝 표 데이터 입력:', {
                                          tableKey,
                                          rowIndex,
                                          colIndex,
                                          key,
                                          newValue,
                                          currentTableDataMap: tableDataMap
                                        });
                                        
                                        setTableDataMap(prev => {
                                          const updated = { ...prev, [key]: newValue };
                                          console.log('📝 tableDataMap 업데이트:', updated);
                                          return updated;
                                        });
                                        
                                        // 디바운스된 저장 함수 호출
                                        debouncedSaveTableData(tableKey, rowIndex, colIndex, newValue, fontSize);
                                      }}
                                      className="w-full px-1 py-1 border border-gray-300 rounded text-xs"
                                      placeholder={`${rowIndex}-${colIndex}`}
                                    />
                                    <div className="flex items-center gap-1">
                                      <label className="text-xs text-gray-500">크기:</label>
                                      <input
                                        type="number"
                                        min={8}
                                        max={20}
                                        value={fontSize}
                                        onChange={(e) => {
                                          const newFontSize = parseInt(e.target.value) || 10;
                                          setTableFontSizeMap(prev => ({ ...prev, [key]: newFontSize }));
                                          
                                          // 값이 있으면 폰트 크기도 함께 저장
                                          if (val.trim()) {
                                            debouncedSaveTableData(tableKey, rowIndex, colIndex, val, newFontSize);
                                          }
                                        }}
                                        className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                                      />
                                      <span className="text-xs text-gray-400">px</span>
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            
            {coordinateFields.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>표시할 필드가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 미리보기 모달 */}
      {currentDocument?.template?.pdfImagePath && (
        <DocumentPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          pdfImageUrl={`/uploads/pdf-templates/${currentDocument.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || ''}`}
          coordinateFields={coordinateFields}
          documentTitle={currentDocument.template.name || '문서'}
        />
      )}
    </div>
  );
};

export default DocumentEditor;
