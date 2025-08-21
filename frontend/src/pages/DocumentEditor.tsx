import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import axios from 'axios';
import { 
  logCoordinateConversion 
} from '../utils/coordinateUtils';
import { debugTemplateField } from '../utils/coordinateDebugger';
import DocumentPreviewModal from '../components/DocumentPreviewModal';

// 테이블 셀 편집 모달 컴포넌트
interface TableCellEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  currentText: string;
  cellPosition: { row: number; col: number };
  tableName: string;
}

const TableCellEditModal: React.FC<TableCellEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentText,
  cellPosition,
  tableName
}) => {
  const [text, setText] = useState(currentText);

  React.useEffect(() => {
    if (isOpen) {
      setText(currentText);
    }
  }, [isOpen, currentText]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(text);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">테이블 셀 편집</h3>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <div><strong>테이블:</strong> {tableName}</div>
            <div><strong>위치:</strong> {cellPosition.row + 1}행 {cellPosition.col + 1}열</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              셀 내용
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="셀에 표시할 텍스트를 입력하세요"
              rows={3}
              autoFocus
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

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

// CoordinateField 타입 정의 (PdfViewer에서 가져오지 않고 직접 정의)
interface CoordinateField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  value?: string;
  required?: boolean;
  // 테이블 정보 추가
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][];
    columnWidths?: number[]; // 컬럼 너비 비율 추가
  };
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
  type?: 'field' | 'table'; // 필드 타입 추가
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][]; // 각 셀의 내용
    columnWidths?: number[]; // 컬럼 너비 비율 추가
  };
}

const DocumentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDocument, loading, getDocument, updateDocumentSilently, clearCurrentDocument } = useDocumentStore();

  // 템플릿 필드 기반 입력 시스템 상태
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  
  // CoordinateFields 상태를 별도로 관리 (리렌더링 최적화)
  const [coordinateFields, setCoordinateFields] = useState<CoordinateField[]>([]);
  
  // 저장 상태 관리
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // 테이블 셀 편집 상태
  const [isTableCellEditOpen, setIsTableCellEditOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    fieldKey: string;
    row: number;
    col: number;
  } | null>(null);

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

          console.log(`🎯 [편집단계] 필드 변환 상세 [${field.id}]:`, {
            fieldId: field.id,
            label: field.label,
            fieldType: field.fieldType,
            hasTableData: !!field.tableData,
            tableDataDetail: field.tableData,
            originalField: field
          });

          return {
            id: field.id.toString(),
            label: field.label,
            x: pixelCoords.x,
            y: pixelCoords.y,
            width: pixelCoords.width,
            height: pixelCoords.height,
            type: (field.fieldType?.toLowerCase() === 'date' ? 'date' : 'text') as 'text' | 'date',
            value: field.fieldType === 'table' && field.tableData 
              ? JSON.stringify({
                  rows: field.tableData.rows,
                  cols: field.tableData.cols,
                  cells: Array(field.tableData.rows).fill(null).map(() => 
                    Array(field.tableData!.cols).fill('')
                  )
                }) 
              : '', // 테이블인 경우 기본 빈 셀 배열 생성, 아니면 빈 값
            required: field.required,
            // 테이블 정보 추가
            ...(field.fieldType === 'table' && field.tableData && {
              tableData: field.tableData
            })
          };
        });
      
      console.log('🎯 [편집단계] 최종 coordinateFields 설정:', {
        fieldsCount: initialFields.length,
        tableFieldsCount: initialFields.filter(f => f.tableData).length,
        allFields: initialFields,
        tableFields: initialFields.filter(f => f.tableData)
      });
      setCoordinateFields(initialFields);
    }
  }, [templateFields, id]);

  // CoordinateFields 초기화 (문서별 독립적 관리)
  useEffect(() => {
    console.log('🔄 CoordinateFields 초기화:', {
      documentId: id,
      currentDocumentFields: currentDocument?.data?.coordinateFields?.length || 0,
      currentDocumentId: currentDocument?.id
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
      const processedFields = currentDocument.data.coordinateFields.map(field => ({
        id: field.id.toString(),
        label: field.label || `필드 ${field.id}`,
        x: field.x,
        y: field.y,
        width: field.width || 100,
        height: field.height || 20,
        type: 'text' as 'text' | 'date',
        value: field.value || '', // 이 문서에 저장된 값 사용
        required: field.required || false
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
      // coordinateFields 저장 방식으로 통일
      const updatedData = {
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
          // 테이블 정보도 보존
          ...(field.tableData && { tableData: field.tableData })
        }))
      };
      
      console.log('💾 수동 저장 - coordinateFields:', {
        documentId: id,
        fieldsCount: coordinateFields.length,
        tableFieldsCount: coordinateFields.filter(f => f.tableData).length,
        updatedData
      });
      
      await updateDocumentSilently(parseInt(id), { data: updatedData });
      
      // 모든 타이머 클리어
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      saveTimeouts.current.clear();
      pendingSaves.current.clear();
      
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

    // 템플릿 필드가 있는 경우도 coordinateFields 방식으로 저장
    console.log('🔧 좌표 필드 모드로 저장:', {
      documentId: id,
      fieldId,
      value,
      hasTemplateFields: Array.isArray(templateFields) && templateFields.length > 0
    });

    // coordinateFields 전체 업데이트 방식으로 통일
    const updatedFields = coordinateFields.map(field => 
      field.id === fieldId 
        ? { ...field, value } 
        : field
    );
    
    // 필요한 데이터만 포함하여 저장
    const updatedData = {
      coordinateFields: updatedFields
    };
    
    console.log('💾 coordinateFields 업데이트 저장:', {
      documentId: id,
      fieldId,
      value,
      updatedData
    });
    
    stableHandlersRef.current.debouncedUpdateDocument(parseInt(id!), { data: updatedData });
  }, [id, currentDocument, templateFields, coordinateFields]);

  // 테이블 셀 편집 핸들러
  const handleTableCellClick = useCallback((fieldKey: string, row: number, col: number, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    setEditingCell({ fieldKey, row, col });
    setIsTableCellEditOpen(true);
  }, []);

  const handleTableCellSave = useCallback((text: string) => {
    if (!editingCell) return;
    
    // coordinateFields에서 해당 테이블 필드 찾기
    setCoordinateFields(prev => prev.map(field => {
      if (field.id === editingCell.fieldKey) {
        // 기존 값을 JSON으로 파싱하여 테이블 데이터 추출
        try {
          const currentValue = field.value || '{}';
          const tableData = JSON.parse(currentValue);
          
          // cells 배열이 없으면 초기화
          if (!tableData.cells) {
            tableData.cells = [];
          }
          
          // columnWidths가 없으면 기본값 설정
          if (!tableData.columnWidths && tableData.cols) {
            tableData.columnWidths = Array(tableData.cols).fill(1 / tableData.cols);
          }
          
          // 해당 행이 없으면 생성
          while (tableData.cells.length <= editingCell.row) {
            tableData.cells.push([]);
          }
          
          // 해당 열이 없으면 생성
          while (tableData.cells[editingCell.row].length <= editingCell.col) {
            tableData.cells[editingCell.row].push('');
          }
          
          // 셀 값 업데이트
          tableData.cells[editingCell.row][editingCell.col] = text;
          
          // JSON 문자열로 변환하여 저장
          const updatedValue = JSON.stringify(tableData);
          
          console.log('🔧 테이블 셀 업데이트:', {
            fieldKey: editingCell.fieldKey,
            row: editingCell.row,
            col: editingCell.col,
            text,
            updatedValue
          });
          
          // 서버에도 저장 - coordinateFields 전체 업데이트
          const updatedFields = prev.map(f => 
            f.id === editingCell.fieldKey 
              ? { ...f, value: updatedValue }
              : f
          );
          
          // 문서 데이터 저장
          const updatedData = {
            coordinateFields: updatedFields
          };
          
          console.log('💾 테이블 데이터 서버 저장:', {
            documentId: id,
            fieldKey: editingCell.fieldKey,
            updatedData
          });
          
          // 디바운스된 업데이트로 서버에 저장
          stableHandlersRef.current.debouncedUpdateDocument(parseInt(id!), { data: updatedData });
          
          return { ...field, value: updatedValue };
        } catch (error) {
          console.error('테이블 데이터 파싱 실패:', error);
          return field;
        }
      }
      return field;
    }));
  }, [editingCell, handleCoordinateFieldChange]);

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
      
      // 템플릿 정보를 가져와서 coordinateFields에서 테이블 데이터 추출
      const templateResponse = await axios.get(`/api/templates/${currentDocument.templateId}`);
      const template = templateResponse.data;
      
      console.log('🔧 [편집단계] 템플릿 정보 로드:', {
        template,
        hasCoordinateFields: !!template.coordinateFields,
        coordinateFieldsType: typeof template.coordinateFields,
        coordinateFieldsValue: template.coordinateFields
      });

      let parsedFields: any[] = [];
      
      // coordinateFields에서 필드 정보 파싱
      if (template.coordinateFields) {
        try {
          parsedFields = typeof template.coordinateFields === 'string' 
            ? JSON.parse(template.coordinateFields)
            : template.coordinateFields;
            
          console.log('🔧 [편집단계] 파싱된 coordinate fields 상세:', {
            parsedFields,
            isArray: Array.isArray(parsedFields),
            fieldsCount: Array.isArray(parsedFields) ? parsedFields.length : 0,
            tableFields: parsedFields.filter(f => f.type === 'table')
          });
        } catch (error) {
          console.error('coordinateFields 파싱 실패:', error);
        }
      }
      
      // coordinateFields를 템플릿 필드 형태로 변환
      const convertedFields = parsedFields.map((field, index) => {
        const converted = {
          id: parseInt(field.id?.replace(/\D/g, '') || index.toString()), // ID에서 숫자만 추출
          fieldKey: field.id,
          label: field.label,
          fieldType: field.type === 'table' ? 'table' : 'text',
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          required: field.required || false,
          type: field.type || 'field',
          tableData: field.tableData
        };
        
        console.log(`🔧 [편집단계] 필드 변환 [${index}]:`, {
          original: field,
          converted,
          hasTableData: !!field.tableData,
          tableDataDetail: field.tableData
        });
        
        return converted;
      });

      console.log('🔧 [편집단계] 최종 변환된 템플릿 필드:', {
        convertedFields,
        tableFieldsCount: convertedFields.filter(f => f.tableData).length
      });
      setTemplateFields(convertedFields);
      
    } catch (error) {
      console.error('템플릿 필드 로드 실패:', {
        documentId: currentDocument.id,
        templateId: currentDocument.templateId,
        error
      });
      setTemplateFields([]);
    }
  }, [currentDocument?.templateId, currentDocument?.id]);

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
        templateFieldIds: templateFields.map(tf => tf.id),
        currentDocumentData: currentDocument?.data
      });
      
      // 문서 데이터에서 필드 값 추출 (coordinateFields 사용)
      let fieldValues: any[] = [];
      
      if (currentDocument?.data?.coordinateFields) {
        fieldValues = currentDocument.data.coordinateFields;
        console.log('📥 문서의 coordinateFields에서 필드 값 로드:', fieldValues);
      } else {
        console.log('📥 문서에 저장된 coordinateFields가 없음, 빈 값으로 초기화');
      }
      
      // coordinateFields 업데이트 - 템플릿 필드 정보에 저장된 값 추가
      const updated = templateFields.map(templateField => {
        // coordinateFields에서 해당 필드 찾기 (ID 또는 label 기준)
        const savedField = Array.isArray(fieldValues) ? 
          fieldValues.find((fv: any) => 
            fv.id === templateField.id.toString() || 
            fv.label === templateField.label
          ) : null;
        
        // 테이블 필드인 경우 기본값 처리
        let value = '';
        if (templateField.fieldType === 'table' && templateField.tableData) {
          if (savedField && savedField.value) {
            value = savedField.value;
          } else {
            // 테이블 필드의 기본값: 빈 셀 배열 + 컬럼 너비
            value = JSON.stringify({
              rows: templateField.tableData.rows,
              cols: templateField.tableData.cols,
              cells: Array(templateField.tableData.rows).fill(null).map(() => 
                Array(templateField.tableData!.cols).fill('')
              ),
              columnWidths: templateField.tableData.columnWidths || Array(templateField.tableData.cols).fill(1 / templateField.tableData.cols)
            });
          }
        } else {
          value = savedField ? (savedField.value || '') : '';
        }
        
        console.log('📥 필드 값 매핑:', {
          templateFieldId: templateField.id,
          templateFieldLabel: templateField.label,
          templateFieldType: templateField.fieldType,
          foundSavedField: !!savedField,
          value: value,
          hasTableData: !!templateField.tableData,
          tableData: templateField.tableData
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
          type: (templateField.fieldType?.toLowerCase() === 'date' ? 'date' : 'text') as 'text' | 'date',
          value: value,
          required: templateField.required || false,
          // 테이블 정보 보존
          ...(templateField.fieldType === 'table' && templateField.tableData && {
            tableData: templateField.tableData
          })
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
        
        // 테이블 필드인 경우 기본값 설정
        let defaultValue = '';
        if (templateField.fieldType === 'table' && templateField.tableData) {
          defaultValue = JSON.stringify({
            rows: templateField.tableData.rows,
            cols: templateField.tableData.cols,
            cells: Array(templateField.tableData.rows).fill(null).map(() => 
              Array(templateField.tableData!.cols).fill('')
            ),
            columnWidths: templateField.tableData.columnWidths || Array(templateField.tableData.cols).fill(1 / templateField.tableData.cols)
          });
        }
        
        return {
          id: templateField.id.toString(),
          label: templateField.label || `필드 ${templateField.id}`,
          x: pixelCoords.x,
          y: pixelCoords.y,
          width: pixelCoords.width,
          height: pixelCoords.height,
          type: (templateField.fieldType?.toLowerCase() === 'date' ? 'date' : 'text') as 'text' | 'date',
          value: defaultValue,
          required: templateField.required || false,
          // 테이블 정보 보존
          ...(templateField.fieldType === 'table' && templateField.tableData && {
            tableData: templateField.tableData
          })
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
                value: field.value,
                hasTableData: !!field.tableData,
                tableData: field.tableData,
                fieldType: field.type
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

              // 테이블 필드인지 확인
              let isTableField = false;
              let tableInfo = null;
              
              // 1. tableData 속성으로 확인
              if (field.tableData) {
                isTableField = true;
                tableInfo = field.tableData;
              } else {
                // 2. value를 파싱해서 테이블 데이터 확인
                try {
                  if (field.value && typeof field.value === 'string') {
                    const parsedValue = JSON.parse(field.value);
                    if (parsedValue.rows && parsedValue.cols && parsedValue.cells) {
                      isTableField = true;
                      tableInfo = {
                        rows: parsedValue.rows,
                        cols: parsedValue.cols,
                        columnWidths: parsedValue.columnWidths // 컬럼 너비 정보도 포함
                      };
                    }
                  }
                } catch (e) {
                  // JSON 파싱 실패 시 일반 필드로 처리
                }
              }
              
              console.log('🔍 테이블 필드 확인:', {
                fieldId: field.id,
                fieldLabel: field.label,
                isTableField,
                tableInfo,
                hasTableDataProperty: !!field.tableData,
                value: field.value
              });

              return (
                <div
                  key={field.id}
                  className={`absolute border-2 bg-opacity-30 hover:bg-opacity-50 transition-colors flex flex-col justify-center cursor-pointer ${
                    isTableField ? 'bg-purple-100 border-purple-500' : 'bg-blue-100 border-blue-500'
                  }`}
                  style={{
                    left: `${leftPercent}px`,
                    top: `${topPercent}px`,
                    width: `${widthPercent}px`,
                    height: `${heightPercent}px`,
                  }}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 테이블이 아닌 일반 필드인 경우
                    if (!isTableField) {
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
                    }
                  }}
                >
                  {isTableField && tableInfo ? (
                    // 테이블 렌더링
                    <div className="w-full h-full p-1">
                      <div className="text-xs font-medium mb-1 text-purple-700 truncate">
                        {field.label} ({tableInfo.rows}×{tableInfo.cols})
                        {field.required && <span className="text-red-500">*</span>}
                      </div>
                      <div 
                        className="grid gap-px bg-purple-300" 
                        style={{
                          gridTemplateColumns: tableInfo.columnWidths 
                            ? tableInfo.columnWidths.map((width: number) => `${width * 100}%`).join(' ')
                            : `repeat(${tableInfo.cols}, 1fr)`,
                          height: 'calc(100% - 20px)'
                        }}
                      >
                        {Array(tableInfo.rows).fill(null).map((_, rowIndex) =>
                          Array(tableInfo.cols).fill(null).map((_, colIndex) => {
                            let cellText = '';
                            try {
                              // 테이블 값 파싱 개선
                              let tableValue: any = {};
                              if (field.value) {
                                if (typeof field.value === 'string') {
                                  tableValue = JSON.parse(field.value);
                                } else {
                                  tableValue = field.value;
                                }
                              }
                              
                              cellText = tableValue.cells?.[rowIndex]?.[colIndex] || '';
                              
                              console.log(`🔍 테이블 셀 값 확인 [${rowIndex}][${colIndex}]:`, {
                                fieldId: field.id,
                                fieldLabel: field.label,
                                rawValue: field.value,
                                parsedTableValue: tableValue,
                                cellText: cellText
                              });
                            } catch (error) {
                              console.error(`테이블 값 파싱 실패 [${rowIndex}][${colIndex}]:`, {
                                fieldId: field.id,
                                rawValue: field.value,
                                error
                              });
                              cellText = '';
                            }
                            
                            return (
                              <div 
                                key={`${rowIndex}-${colIndex}`}
                                className="bg-white bg-opacity-70 border border-purple-200 hover:bg-opacity-90 cursor-pointer flex items-center justify-center text-xs p-1 transition-colors"
                                style={{ minHeight: '20px' }}
                                onClick={(e) => handleTableCellClick(field.id, rowIndex, colIndex, e)}
                                title={cellText || '클릭하여 편집'}
                              >
                                <span className="text-center text-purple-700 font-medium truncate leading-tight">
                                  {cellText}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : field.value ? (
                    // 일반 필드 - 값이 있는 경우
                    <div className="text-xs text-gray-900 p-1 truncate font-medium bg-white bg-opacity-80 rounded text-center">
                      {field.value}
                    </div>
                  ) : (
                    // 일반 필드 - 값이 없는 경우
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
  }, [currentDocument?.template?.pdfImagePath, coordinateFields, templateFields]);

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
            {coordinateFields.map((field) => (
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

      {/* 테이블 셀 편집 모달 */}
      <TableCellEditModal
        isOpen={isTableCellEditOpen}
        onClose={() => {
          setIsTableCellEditOpen(false);
          setEditingCell(null);
        }}
        onSave={handleTableCellSave}
        currentText={
          editingCell ? (() => {
            try {
              const field = coordinateFields.find(f => f.id === editingCell.fieldKey);
              if (field?.value) {
                const tableData = JSON.parse(field.value);
                return tableData.cells?.[editingCell.row]?.[editingCell.col] || '';
              }
            } catch {
              // JSON 파싱 실패 시 빈 문자열 반환
            }
            return '';
          })() : ''
        }
        cellPosition={editingCell ? { row: editingCell.row, col: editingCell.col } : { row: 0, col: 0 }}
        tableName={
          editingCell ? coordinateFields.find(f => f.id === editingCell.fieldKey)?.label || '' : ''
        }
      />
    </div>
  );
};

export default DocumentEditor;
