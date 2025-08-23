import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  logCoordinateConversion
} from '../utils/coordinateUtils';
import { debugTemplateField, runCoordinateTests } from '../utils/coordinateDebugger';

// 필드 타입 정의
interface TemplateField {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  type?: 'text' | 'table';
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

// 새 필드 추가 모달 컴포넌트
interface NewFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: TemplateField) => void;
  initialPosition: { x: number; y: number };
}

const NewFieldModal: React.FC<NewFieldModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPosition
}) => {
  const [label, setLabel] = useState('');
  const [required, setRequired] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setLabel('');
      setRequired(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (label.trim()) {
      // 고유한 ID 생성 (timestamp + random string)
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const autoId = `field_${timestamp}_${randomStr}`;

      const newField: TemplateField = {
        id: autoId,
        label: label.trim(),
        x: initialPosition.x,
        y: initialPosition.y,
        width: 150,
        height: 30,
        page: 1,
        required
      };

      onSave(newField);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">새 필드 추가</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              필드명 *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="예: 성명, 날짜, 서명 등"
              autoFocus
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="newRequired"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="newRequired" className="ml-2 text-sm text-gray-700">
              필수 필드
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">페이지:</span>
              <span className="ml-2 font-medium">1</span>
            </div>
            <div>
              <span className="text-gray-600">위치:</span>
              <span className="ml-2 font-medium">({initialPosition.x}, {initialPosition.y})</span>
            </div>
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
            disabled={!label.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
};

// 필드 편집 모달 컴포넌트
interface FieldEditModalProps {
  field: TemplateField | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: TemplateField) => void;
  onDelete: () => void;
}

const FieldEditModal: React.FC<FieldEditModalProps> = ({
  field,
  isOpen,
  onClose,
  onSave,
  onDelete
}) => {
  const [editField, setEditField] = useState<TemplateField | null>(field);

  React.useEffect(() => {
    setEditField(field);
  }, [field]);

  if (!isOpen || !editField) return null;

  const handleSave = () => {
    if (editField.label.trim() && editField.id.trim()) {
      onSave(editField);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">필드 편집</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              필드명 *
            </label>
            <input
              type="text"
              value={editField.label}
              onChange={(e) => {
                const label = e.target.value;
                // 기존 필드의 경우 ID는 변경하지 않음
                setEditField({ ...editField, label });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="예: 성명, 날짜, 서명 등"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="editRequired"
              checked={editField.required}
              onChange={(e) => setEditField({ ...editField, required: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="editRequired" className="ml-2 text-sm text-gray-700">
              필수 필드
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">페이지:</span>
              <span className="ml-2 font-medium">{editField.page}</span>
            </div>
            <div>
              <span className="text-gray-600">위치:</span>
              <span className="ml-2 font-medium">({editField.x}, {editField.y})</span>
            </div>
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
            onClick={() => { onDelete(); onClose(); }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            삭제
          </button>
          <button
            onClick={handleSave}
            disabled={!editField.label.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

const TemplateUploadPdf: React.FC = () => {
  const navigate = useNavigate();
  
  // 기본 업로드 상태
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // PDF 미리보기 및 필드 관리
  const [pdfImageUrl, setPdfImageUrl] = useState<string | null>(null);
  const [pdfImageDataUrl, setPdfImageDataUrl] = useState<string | null>(null); // 변환된 이미지 데이터
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewFieldModalOpen, setIsNewFieldModalOpen] = useState(false);
  const [newFieldPosition, setNewFieldPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [step, setStep] = useState<'upload' | 'edit'>('upload');
  
  // 필드 추가 관련 상태
  const [addMode, setAddMode] = useState<'text' | 'table'>('text');
  const [isAddingField, setIsAddingField] = useState(false); // 필드 추가 모드 상태
  
  // 텍스트 입력 모달 상태
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [pendingTextField, setPendingTextField] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [textFieldLabel, setTextFieldLabel] = useState('');
  
  // 표 생성 모달 상태
  const [showTableModal, setShowTableModal] = useState(false);
  const [pendingTableField, setPendingTableField] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [modalTableRows, setModalTableRows] = useState<number>(3);
  const [modalTableCols, setModalTableCols] = useState<number>(3);
  
  // 성공 메시지 상태
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // 표 컬럼 리사이즈 관련 상태
  const [isResizingTableColumn, setIsResizingTableColumn] = useState(false);
  const [resizingTableFieldId, setResizingTableFieldId] = useState<string | null>(null);
  const [resizingColumnIndex, setResizingColumnIndex] = useState<number>(-1);
  const [tableResizeStartX, setTableResizeStartX] = useState<number>(0);
  
  // 표 행 높이 리사이즈 관련 상태
  const [isResizingTableRow, setIsResizingTableRow] = useState(false);
  const [resizingRowIndex, setResizingRowIndex] = useState<number>(-1);
  const [tableResizeStartY, setTableResizeStartY] = useState<number>(0);

  // 필드 드래그 앤 드롭 상태
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [resizingField, setResizingField] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preventClick, setPreventClick] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  
  // 텍스트 박스 드래그 생성을 위한 상태
  const [isCreatingField, setIsCreatingField] = useState(false);
  const [fieldDragStart, setFieldDragStart] = useState<{ x: number; y: number } | null>(null);
  const [fieldDragCurrent, setFieldDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('PDF 파일만 업로드할 수 있습니다.');
      return;
    }
    setSelectedFile(file);
    setError(null);
    
    // 파일명에서 템플릿 이름 자동 설정
    if (!templateName) {
      const nameWithoutExtension = file.name.replace(/\.pdf$/i, '');
      setTemplateName(nameWithoutExtension);
    }

    // 편집 단계로 이동
    setStep('edit');
    
    // 좌표 변환 시스템 테스트 실행
    setTimeout(() => {
      runCoordinateTests();
    }, 500);
    
    try {
      // PDF를 FormData로 백엔드에 전송하여 이미지로 변환
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/api/pdf/convert-to-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'blob'
      });
      
      // 변환된 이미지를 URL로 생성
      const imageBlob = new Blob([response.data], { type: 'image/png' });
      const imageUrl = URL.createObjectURL(imageBlob);
      setPdfImageDataUrl(imageUrl);
      
      console.log('📐 PDF 이미지 변환 완료:', { imageUrl });
    } catch (error) {
      console.error('PDF 이미지 변환 실패:', error);
      // 실패 시 기존 방식 사용
      const objectUrl = URL.createObjectURL(file);
      setPdfImageUrl(objectUrl);
    }
  };

  const handlePdfClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 'edit') return;
    
    // preventClick이 true이거나 드래그 관련 상태가 있으면 완전히 차단
    if (preventClick || draggingField || resizingField || isDragging || isCreatingField) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 필드 추가 모드가 아닐 때는 기존 방식 (새 필드 모달)
    if (!isAddingField) {
      setNewFieldPosition({ x: Math.round(x), y: Math.round(y) });
      setIsNewFieldModalOpen(true);
      return;
    }
  };

  // 마우스 다운으로 드래그 시작
  const handlePdfMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 'edit') return;
    
    // preventClick이 true이거나 드래그 관련 상태가 있으면 완전히 차단
    if (preventClick || draggingField || resizingField || isDragging) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    // 필드 추가 모드일 때만 드래그 생성 시작
    if (isAddingField) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      setIsCreatingField(true);
      setFieldDragStart({ x, y });
      setFieldDragCurrent({ x, y });
      event.preventDefault();
    }
  };

  const handleNewFieldSave = (field: TemplateField) => {
    // 디버깅: 필드 생성 정보 출력
    debugTemplateField(field, 'creation');
    
    // 새 필드 추가
    setFields(prev => [...prev, field]);
  };

  const handleFieldEdit = (field: TemplateField) => {
    // 기존 필드 업데이트
    setFields(prev => {
      const existingIndex = prev.findIndex(f => f.id === field.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = field;
        return updated;
      }
      return prev;
    });
  };

  const handleFieldDelete = () => {
    if (selectedField) {
      setFields(prev => prev.filter(f => f.id !== selectedField.id));
    }
  };

  // 텍스트 필드 생성 확인
  const handleTextFieldConfirm = () => {
    if (!pendingTextField) return;
    
    const newField: TemplateField = {
      id: `field_${Date.now()}`,
      label: textFieldLabel || '새 필드',
      x: pendingTextField.x,
      y: pendingTextField.y,
      width: pendingTextField.width,
      height: pendingTextField.height,
      page: 1,
      required: false
    };
    
    setFields(prev => [...prev, newField]);
    setShowTextInputModal(false);
    setPendingTextField(null);
    setTextFieldLabel('');
  };

  // 표 생성 확인
  const handleTableConfirm = () => {
    if (!pendingTableField) return;
    
    const cols = Math.max(1, modalTableCols);
    const rows = Math.max(1, modalTableRows);
    
    // 각 칸의 크기를 동일하게 설정
    const columnWidth = Math.floor(pendingTableField.width / cols);
    const rowHeight = Math.floor((pendingTableField.height - 30) / rows); // 헤더 높이 30px 제외
    
    const columns = Array.from({ length: cols }, (_, idx) => ({
      title: `컬럼${idx + 1}`,
      width: columnWidth,
      height: rowHeight,
      width_ratio: String(columnWidth),
      location_column: String(idx + 1)
    }));

    const newField: TemplateField = {
      id: `table_${Date.now()}`,
      label: '표',
      x: pendingTableField.x,
      y: pendingTableField.y,
      width: pendingTableField.width,
      height: pendingTableField.height,
      page: 1,
      required: false,
      type: 'table',
      rows: rows,
      columnsCount: cols,
      columns,
      tableId: `tbl_${Date.now()}`
    };
    
    setFields(prev => [...prev, newField]);
    setShowTableModal(false);
    setPendingTableField(null);
  };

  // 모달 취소
  const handleTextFieldCancel = () => {
    setShowTextInputModal(false);
    setPendingTextField(null);
    setTextFieldLabel('');
  };

  const handleTableCancel = () => {
    setShowTableModal(false);
    setPendingTableField(null);
  };

  // 필드 클릭 처리 (편집 모달 열기)
  const handleFieldClick = (field: TemplateField, event: React.MouseEvent) => {
    event.stopPropagation(); // 이벤트 전파 방지
    event.preventDefault();
    
    // 드래그 중이거나 preventClick 상태면 모달 열지 않음
    if (preventClick || isDragging) {
      return;
    }
    
    setSelectedField(field);
    setIsEditModalOpen(true);
  };

  // 필드 드래그 시작
  const handleFieldMouseDown = (field: TemplateField, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    // 마우스 다운 위치 저장
    setMouseDownPos({ x: event.clientX, y: event.clientY });
    
    setDraggingField(field.id);
    setDragStart({
      x: event.clientX - field.x,
      y: event.clientY - field.y
    });
    setIsDragging(false); // 드래그 시작 시점에는 false로 설정
    setPreventClick(false); // 초기에는 false로 설정
  };

  // 필드 리사이즈 시작
  const handleResizeMouseDown = (field: TemplateField, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    // 마우스 다운 위치 저장 (리사이즈용)
    setMouseDownPos({ x: event.clientX, y: event.clientY });
    
    setResizingField(field.id);
    setResizeStart({
      x: event.clientX,
      y: event.clientY,
      width: field.width,
      height: field.height
    });
    setPreventClick(false); // 초기에는 false로 설정
  };

  // 마우스 이동 처리
  const handleMouseMove = (event: React.MouseEvent) => {
    // 필드 드래그 생성 중일 때 현재 위치 업데이트
    if (isCreatingField && fieldDragStart) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setFieldDragCurrent({ x, y });
      return;
    }

    if (draggingField && dragStart && mouseDownPos) {
      const newX = event.clientX - dragStart.x;
      const newY = event.clientY - dragStart.y;
      
      // 마우스가 5픽셀 이상 움직였으면 드래그로 인식
      const moveDistance = Math.sqrt(
        Math.pow(event.clientX - mouseDownPos.x, 2) + 
        Math.pow(event.clientY - mouseDownPos.y, 2)
      );
      
      if (moveDistance > 5) {
        setIsDragging(true);
        setPreventClick(true);
      }
      
      setFields(prev => prev.map(field => 
        field.id === draggingField 
          ? { ...field, x: Math.max(0, newX), y: Math.max(0, newY) }
          : field
      ));
    }
    
    if (resizingField && resizeStart && mouseDownPos) {
      const deltaX = event.clientX - resizeStart.x;
      const deltaY = event.clientY - resizeStart.y;
      
      // 리사이즈도 마우스가 5픽셀 이상 움직였으면 드래그로 인식
      const moveDistance = Math.sqrt(
        Math.pow(event.clientX - mouseDownPos.x, 2) + 
        Math.pow(event.clientY - mouseDownPos.y, 2)
      );
      
      if (moveDistance > 5) {
        setIsDragging(true);
        setPreventClick(true);
      }
      
      setFields(prev => prev.map(field => 
        field.id === resizingField 
          ? { 
              ...field, 
              width: Math.max(50, resizeStart.width + deltaX),
              height: Math.max(20, resizeStart.height + deltaY)
            }
          : field
      ));
    }
  };

  // 마우스 업 처리
  const handleMouseUp = React.useCallback((event?: React.MouseEvent) => {
    // 필드 드래그 생성 완료
    if (isCreatingField && fieldDragStart && fieldDragCurrent) {
      const startX = Math.min(fieldDragStart.x, fieldDragCurrent.x);
      const startY = Math.min(fieldDragStart.y, fieldDragCurrent.y);
      const width = Math.abs(fieldDragCurrent.x - fieldDragStart.x);
      const height = Math.abs(fieldDragCurrent.y - fieldDragStart.y);
      
      // 최소 크기 확인 후 필드 생성
      if (width > 30 && height > 20) {
        if (addMode === 'table') {
          // 표 생성 모달 표시
          setPendingTableField({
            x: startX,
            y: startY,
            width: width,
            height: height
          });
          setShowTableModal(true);
        } else {
          // 텍스트 필드 생성 모달 표시
          setPendingTextField({
            x: startX,
            y: startY,
            width: width,
            height: height
          });
          setTextFieldLabel(''); // 초기화
          setShowTextInputModal(true);
        }
        setIsAddingField(false); // 필드 추가 모드 해제
      }
      
      // 드래그 상태 초기화
      setIsCreatingField(false);
      setFieldDragStart(null);
      setFieldDragCurrent(null);
      return;
    }

    // 드래그 또는 리사이즈 중이었다면 이벤트 차단
    if (draggingField || resizingField) {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }
    }
    
    // 상태 초기화
    setDraggingField(null);
    setDragStart(null);
    setResizingField(null);
    setResizeStart(null);
    setMouseDownPos(null);
    
    // 드래그가 있었다면 잠시 후 상태 초기화
    if (isDragging || preventClick) {
      setTimeout(() => {
        setIsDragging(false);
        setPreventClick(false);
      }, 300);
    } else {
      setIsDragging(false);
      setPreventClick(false);
    }
  }, [isCreatingField, fieldDragStart, fieldDragCurrent, addMode, draggingField, resizingField, isDragging, preventClick]);

  // 표 컬럼 리사이즈 시작
  const handleTableColumnResizeStart = (fieldId: string, columnIndex: number, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setIsResizingTableColumn(true);
    setResizingTableFieldId(fieldId);
    setResizingColumnIndex(columnIndex);
    setTableResizeStartX(event.clientX);
  };

  // 표 컬럼 리사이즈 처리
  const handleTableColumnResize = React.useCallback((event: MouseEvent) => {
    if (!isResizingTableColumn || !resizingTableFieldId || resizingColumnIndex === -1) return;

    const deltaX = event.clientX - tableResizeStartX;
    const field = fields.find(f => f.id === resizingTableFieldId);
    if (!field || !field.columns) return;

    const newColumns = [...field.columns];
    const currentColumn = newColumns[resizingColumnIndex];
    const nextColumn = newColumns[resizingColumnIndex + 1];
    
    if (currentColumn && nextColumn) {
      const minWidth = 30;
      const newCurrentWidth = Math.max(minWidth, currentColumn.width + deltaX);
      const newNextWidth = Math.max(minWidth, nextColumn.width - deltaX);
      
      // 최소 너비 조건을 만족하는 경우에만 업데이트
      if (newCurrentWidth >= minWidth && newNextWidth >= minWidth) {
        newColumns[resizingColumnIndex] = {
          ...currentColumn,
          width: newCurrentWidth,
          width_ratio: String(newCurrentWidth)
        };
        newColumns[resizingColumnIndex + 1] = {
          ...nextColumn,
          width: newNextWidth,
          width_ratio: String(newNextWidth)
        };

        setFields(prev => prev.map(f => 
          f.id === resizingTableFieldId 
            ? { ...f, columns: newColumns }
            : f
        ));
        
        setTableResizeStartX(event.clientX);
      }
    }
  }, [isResizingTableColumn, resizingTableFieldId, resizingColumnIndex, tableResizeStartX, fields]);

  // 표 컬럼 리사이즈 종료
  const handleTableColumnResizeEnd = React.useCallback(() => {
    setIsResizingTableColumn(false);
    setResizingTableFieldId(null);
    setResizingColumnIndex(-1);
    setTableResizeStartX(0);
  }, []);

  // 표 행 높이 리사이즈 시작
  const handleTableRowResizeStart = (fieldId: string, rowIndex: number, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setIsResizingTableRow(true);
    setResizingTableFieldId(fieldId);
    setResizingRowIndex(rowIndex);
    setTableResizeStartY(event.clientY);
  };

  // 표 행 높이 리사이즈 처리
  const handleTableRowResize = React.useCallback((event: MouseEvent) => {
    if (!isResizingTableRow || !resizingTableFieldId || resizingRowIndex === -1) return;

    const deltaY = event.clientY - tableResizeStartY;
    const field = fields.find(f => f.id === resizingTableFieldId);
    if (!field || !field.columns) return;

    const newColumns = [...field.columns];
    const minHeight = 20;
    const newHeight = Math.max(minHeight, (newColumns[0]?.height || 30) + deltaY);
    
    // 모든 컬럼의 높이를 동일하게 조정
    newColumns.forEach((col, index) => {
      newColumns[index] = { ...col, height: newHeight };
    });

    setFields(prev => prev.map(f => 
      f.id === resizingTableFieldId 
        ? { ...f, columns: newColumns }
        : f
    ));
    
    setTableResizeStartY(event.clientY);
  }, [isResizingTableRow, resizingTableFieldId, resizingRowIndex, tableResizeStartY, fields]);

  // 표 행 높이 리사이즈 종료
  const handleTableRowResizeEnd = React.useCallback(() => {
    setIsResizingTableRow(false);
    setResizingTableFieldId(null);
    setResizingRowIndex(-1);
    setTableResizeStartY(0);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !templateName.trim()) {
      setError('PDF 파일과 템플릿 이름을 입력해주세요.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', templateName.trim());
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      // coordinateFields를 JSON 문자열로 변환하여 전송 (픽셀값 그대로)
      if (fields.length > 0) {
        const coordinateFields = fields.map(field => {
          logCoordinateConversion(
            '픽셀값 직접 전송',
            { x: field.x, y: field.y, width: field.width, height: field.height },
            { x: field.x, y: field.y, width: field.width, height: field.height },
            field.label
          );

          return {
            id: field.id,
            label: field.label,
            x: Math.round(field.x), // 정수로 전송
            y: Math.round(field.y), 
            width: Math.round(field.width),
            height: Math.round(field.height),
            page: field.page,
            required: field.required,
            type: field.type || 'text',
            ...(field.type === 'table' ? { 
              tableId: field.tableId, 
              rows: field.rows, 
              columnsCount: field.columnsCount, 
              columns: field.columns 
            } : {})
          };
        });

        formData.append('coordinateFields', JSON.stringify(coordinateFields));
      }

      const response = await axios.post(
        'http://localhost:8080/api/templates/upload-pdf',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('PDF 템플릿 업로드 성공:', response.data);
      
      // 성공 메시지 표시
      setSuccessMessage('템플릿이 성공적으로 생성되었습니다!');
      
      // 2초 후 템플릿 디자이너로 이동
      setTimeout(() => {
        const templateId = response.data.template?.id;
        if (templateId) {
          navigate(`/templates/${templateId}`);
        } else {
          navigate('/templates');
        }
      }, 2000);
    } catch (error) {
      console.error('PDF 템플릿 업로드 실패:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error && 
        error.response && typeof error.response === 'object' && 'data' in error.response &&
        error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data
        ? String(error.response.data.error)
        : 'PDF 템플릿 업로드에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const goBackToUpload = () => {
    setStep('upload');
    setFields([]);
    if (pdfImageUrl) {
      URL.revokeObjectURL(pdfImageUrl);
    }
    setPdfImageUrl(null);
  };

  // PDF Object URL 정리를 위한 useEffect
  useEffect(() => {
    return () => {
      if (pdfImageUrl) {
        URL.revokeObjectURL(pdfImageUrl);
      }
    };
  }, [pdfImageUrl]);

  // 전역 마우스 이벤트 등록
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggingField || resizingField) {
        handleMouseUp();
      }
      if (isResizingTableColumn) {
        handleTableColumnResizeEnd();
      }
      if (isResizingTableRow) {
        handleTableRowResizeEnd();
      }
    };

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (isResizingTableColumn) {
        handleTableColumnResize(event);
      }
      if (isResizingTableRow) {
        handleTableRowResize(event);
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [draggingField, resizingField, handleMouseUp, isResizingTableColumn, handleTableColumnResize, handleTableColumnResizeEnd, isResizingTableRow, handleTableRowResize, handleTableRowResizeEnd]);

  if (step === 'upload') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📄 PDF 템플릿 업로드
            </h1>
            <p className="text-gray-600">
              PDF 파일을 업로드하여 새로운 템플릿을 만들어보세요.
            </p>
          </div>

          <div className="space-y-6">
            {/* PDF 파일 업로드 영역 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                PDF 파일 *
              </label>
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-400 bg-blue-50'
                    : selectedFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="text-green-600 text-4xl">✅</div>
                    <div className="text-sm font-medium text-green-700">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-green-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setStep('upload');
                      }}
                      className="mt-2 text-xs text-red-600 hover:text-red-800"
                    >
                      제거
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-gray-400 text-4xl">📄</div>
                    <div className="text-sm text-gray-600">
                      PDF 파일을 드래그 앤 드롭하거나 클릭하여 선택하세요
                    </div>
                    <div className="text-xs text-gray-500">
                      최대 10MB까지 업로드 가능
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 안내 사항 */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">📋 안내사항</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• PDF 파일은 최대 10MB까지 업로드할 수 있습니다.</li>
                <li>• 업로드 후 PDF 위를 클릭하여 입력 필드를 추가할 수 있습니다.</li>
                <li>• 템플릿은 문서 생성 시 기본 양식으로 사용됩니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 편집 단계 UI
  return (
    <div className="min-h-screen flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              템플릿 필드 편집
            </h1>
            <p className="text-sm text-gray-600">
              PDF 위를 클릭하여 새 필드 추가 | 기존 필드 클릭으로 편집 | 드래그로 이동 | 모서리 드래그로 크기 조절
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={goBackToUpload}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              ← 뒤로가기
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* PDF 미리보기 영역 */}
        <div className="flex-1 p-4 bg-gray-50">
          <div className="relative bg-gray-100 h-full overflow-auto flex justify-center items-start p-4">
            {/* PDF 컨테이너 - DocumentEditor와 동일한 구조 */}
            <div 
              className="relative bg-white shadow-sm border"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseDown={handlePdfMouseDown}
              onClick={handlePdfClick}
              style={{
                width: '1240px',
                height: '1754px',
                minWidth: '1240px', // 최소 크기를 원본 크기로 고정
                minHeight: '1754px', // 최소 높이도 원본 크기로 고정
                flexShrink: 0, // 컨테이너가 줄어들지 않도록 설정
                cursor: isAddingField ? 'crosshair' : 'default'
              }}
            >
              {/* PDF 배경 이미지 - DocumentEditor와 동일한 방식 */}
              {(pdfImageDataUrl || pdfImageUrl) ? (
                <img 
                  src={pdfImageDataUrl || pdfImageUrl || ''}
                  alt="PDF Preview"
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    width: '1240px',
                    height: '1754px',
                    objectFit: 'fill'
                  }}
                  onError={() => {
                    console.error('PDF 이미지 로드 실패');
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📄</div>
                    <div>PDF 미리보기</div>
                    <div className="text-sm mt-2">클릭하여 필드 추가</div>
                  </div>
                </div>
              )}

              {/* 드래그 중 필드 미리보기 */}
              {isCreatingField && fieldDragStart && fieldDragCurrent && (
                (() => {
                  const startX = Math.min(fieldDragStart.x, fieldDragCurrent.x);
                  const startY = Math.min(fieldDragStart.y, fieldDragCurrent.y);
                  const width = Math.abs(fieldDragCurrent.x - fieldDragStart.x);
                  const height = Math.abs(fieldDragCurrent.y - fieldDragStart.y);
                  
                  // 최소 크기 제한
                  if (width > 10 && height > 10) {
                    return (
                      <div
                        className="absolute border-2 border-dashed border-blue-500 bg-blue-100 bg-opacity-30 pointer-events-none"
                        style={{
                          left: startX,
                          top: startY,
                          width: width,
                          height: height
                        }}
                      >
                        <div className="text-xs text-blue-700 font-medium p-1">
                          {addMode === 'table' ? '📊 표' : '📝 텍스트'} ({Math.round(width)} × {Math.round(height)})
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()
              )}
                
              {/* 필드 오버레이 */}
              {fields.map((field) => (
                <div
                  key={field.id}
                  className={`absolute border-2 group select-none ${
                    field.type === 'table' 
                      ? 'border-dashed border-blue-400 bg-blue-50'
                      : draggingField === field.id 
                      ? 'border-red-500 bg-red-100' 
                      : resizingField === field.id
                      ? 'border-green-500 bg-green-100'
                      : 'border-blue-500 bg-blue-100'
                  } bg-opacity-30 hover:bg-opacity-50 transition-colors`}
                  style={{
                    left: field.x,
                    top: field.y,
                    width: field.width,
                    height: field.height,
                    cursor: draggingField === field.id ? 'grabbing' : 'grab'
                  }}
                  onMouseDown={(e) => handleFieldMouseDown(field, e)}
                  onClick={(e) => handleFieldClick(field, e)}
                >
                  <div className="text-xs text-blue-700 font-medium p-1 truncate pointer-events-none">
                    {field.type === 'table' ? '📊 ' : ''}{field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </div>
                  
                  {/* 표 필드인 경우 컬럼 분할선과 드래그 핸들 표시 */}
                  {field.type === 'table' && field.columns && (
                    <>
                      {/* 컬럼 헤더 표시 */}
                      <div className="absolute top-0 left-0 w-full h-6 bg-blue-100 border-b border-blue-300 flex">
                        {field.columns.map((col, colIndex) => {
                          return (
                            <div
                              key={colIndex}
                              className="relative flex items-center justify-center text-xs text-blue-800 border-r border-blue-300 last:border-r-0"
                              style={{ 
                                width: col.width,
                                minWidth: '20px'
                              }}
                            >
                              <span className="truncate px-1">{col.title}</span>
                              
                              {/* 컬럼 리사이즈 핸들 (마지막 컬럼 제외) */}
                              {colIndex < field.columns!.length - 1 && (
                                <div
                                  className="absolute right-0 top-0 w-1 h-full bg-blue-400 cursor-col-resize opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                                  onMouseDown={(e) => handleTableColumnResizeStart(field.id, colIndex, e)}
                                  style={{ right: '-0.5px' }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* 행 가이드라인 및 높이 리사이즈 핸들 */}
                      {Array.from({ length: (field.rows || 1) }, (_, rowIndex) => {
                        // 각 행의 높이를 컬럼 정보에서 가져오거나 기본값 사용
                        const rowHeight = field.columns?.[0]?.height || 28;
                        const cumulativeHeight = 24 + (rowIndex + 1) * rowHeight;
                        
                        return (
                          <div key={`row-${rowIndex}`}>
                            {/* 행 구분선 (마지막 행 제외) */}
                            {rowIndex < (field.rows || 1) - 1 && (
                              <div
                                className="absolute left-0 w-full border-t border-blue-200"
                                style={{ 
                                  top: cumulativeHeight,
                                  height: '1px'
                                }}
                              />
                            )}
                            
                            {/* 행 높이 리사이즈 핸들 (각 행 하단) */}
                            <div
                              className="absolute left-0 w-full h-1 bg-blue-400 cursor-row-resize opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                              style={{ 
                                top: cumulativeHeight - 0.5,
                                zIndex: 20
                              }}
                              onMouseDown={(e) => handleTableRowResizeStart(field.id, rowIndex, e)}
                            />
                          </div>
                        );
                      })}
                    </>
                  )}
                  
                  {/* 리사이즈 핸들 */}
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleResizeMouseDown(field, e)}
                    style={{
                      background: 'linear-gradient(-45deg, transparent 30%, #3b82f6 30%, #3b82f6 70%, transparent 70%)'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 우측 필드 관리 패널 */}
        <div className="w-80 bg-white border-l">
          <div className="p-6 space-y-6">
            {/* 추가 모드 패널 */}
            <div className="space-y-3 border rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">추가 모드</span>
                <div className="space-x-2">
                  <button 
                    className={`px-2 py-1 text-xs rounded ${addMode==='text' && isAddingField ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} 
                    onClick={()=>{
                      setAddMode('text'); 
                      setIsAddingField(!isAddingField || addMode !== 'text'); // 토글 또는 활성화
                    }}
                  >
                    {addMode === 'text' && isAddingField ? '텍스트 추가 중...' : '텍스트'}
                  </button>
                  <button 
                    className={`px-2 py-1 text-xs rounded ${addMode==='table' && isAddingField ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} 
                    onClick={()=>{
                      setAddMode('table'); 
                      setIsAddingField(!isAddingField || addMode !== 'table'); // 토글 또는 활성화
                    }}
                  >
                    {addMode === 'table' && isAddingField ? '표 추가 중...' : '표'}
                  </button>
                </div>
              </div>
              
              {/* 텍스트 모드 안내 */}
              {addMode === 'text' && (
                <div className="text-xs text-gray-600">
                  {isAddingField ? (
                    <p className="text-green-600 font-medium">📝 PDF에서 드래그하여 텍스트 박스 크기를 설정하고 생성하세요.</p>
                  ) : (
                    <p>텍스트 버튼을 클릭한 후 PDF에서 드래그하여 생성하세요.</p>
                  )}
                </div>
              )}
              
              {addMode === 'table' && (
                <div className="text-xs text-gray-600">
                  {isAddingField ? (
                    <p className="text-green-600 font-medium">📋 PDF에서 드래그하여 표 크기를 설정하고 생성하세요.</p>
                  ) : (
                    <p>표 버튼을 클릭한 후 PDF에서 드래그하여 생성하세요.</p>
                  )}
                </div>
              )}
            </div>

            {/* 템플릿 정보 */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">템플릿 정보</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  템플릿 이름 *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 근무일지 템플릿"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="템플릿 설명"
                />
              </div>
            </div>

            {/* 선택된 표 필드 편집 */}
            {selectedField && selectedField.type === 'table' && selectedField.columns && (
              <div className="space-y-4 border rounded p-3">
                <h3 className="font-medium text-gray-900">📊 표 컬럼 편집</h3>
                <div className="space-y-3">
                  {selectedField.columns.map((column, index) => (
                    <div key={index} className="border rounded p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">컬럼 {index + 1}</span>
                        <span className="text-xs text-gray-500">{Math.round(column.width)}×{Math.round(column.height || 30)}px</span>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">제목</label>
                        <input
                          type="text"
                          value={column.title}
                          onChange={(e) => {
                            const newColumns = [...selectedField.columns!];
                            newColumns[index] = { ...newColumns[index], title: e.target.value };
                            const updatedField = { ...selectedField, columns: newColumns };
                            setSelectedField(updatedField);
                            setFields(prev => prev.map(f => f.id === selectedField.id ? updatedField : f));
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">너비 (px)</label>
                          <input
                            type="number"
                            min={30}
                            value={Math.round(column.width)}
                            onChange={(e) => {
                              const newWidth = parseInt(e.target.value) || 30;
                              const newColumns = [...selectedField.columns!];
                              newColumns[index] = { 
                                ...newColumns[index], 
                                width: newWidth,
                                width_ratio: String(newWidth)
                              };
                              const updatedField = { ...selectedField, columns: newColumns };
                              setSelectedField(updatedField);
                              setFields(prev => prev.map(f => f.id === selectedField.id ? updatedField : f));
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">높이 (px)</label>
                          <input
                            type="number"
                            min={20}
                            value={Math.round(column.height || 30)}
                            onChange={(e) => {
                              const newHeight = parseInt(e.target.value) || 30;
                              const newColumns = [...selectedField.columns!];
                              newColumns[index] = { 
                                ...newColumns[index], 
                                height: newHeight
                              };
                              const updatedField = { ...selectedField, columns: newColumns };
                              setSelectedField(updatedField);
                              setFields(prev => prev.map(f => f.id === selectedField.id ? updatedField : f));
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">💡 팁: 표 위의 컬럼 경계선을 드래그해서 너비를 조정할 수도 있습니다.</p>
              </div>
            )}

            {/* 필드 목록 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">필드 목록</h3>
                <span className="text-sm text-gray-500">
                  {fields.length}개
                </span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {fields.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">
                    PDF를 클릭하여 필드를 추가하세요
                  </div>
                ) : (
                  fields.map((field) => (
                    <div
                      key={field.id}
                      className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedField(field);
                        setIsEditModalOpen(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          ({field.x}, {field.y})
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {field.id}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 성공 메시지 */}
            {successMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-600 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {successMessage}
                </p>
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* 저장 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={uploading || !templateName.trim()}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>업로드 중...</span>
                </div>
              ) : (
                '템플릿 생성'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 새 필드 추가 모달 */}
      <NewFieldModal
        isOpen={isNewFieldModalOpen}
        onClose={() => setIsNewFieldModalOpen(false)}
        onSave={handleNewFieldSave}
        initialPosition={newFieldPosition}
      />

      {/* 필드 편집 모달 */}
      <FieldEditModal
        field={selectedField}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedField(null);
        }}
        onSave={handleFieldEdit}
        onDelete={handleFieldDelete}
      />

      {/* 텍스트 입력 모달 */}
      {showTextInputModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">텍스트 필드 생성</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  필드 라벨
                </label>
                <input
                  type="text"
                  value={textFieldLabel}
                  onChange={(e) => setTextFieldLabel(e.target.value)}
                  placeholder="예: 이름, 날짜, 주소 등"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              {pendingTextField && (
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  <p>위치: ({pendingTextField.x}, {pendingTextField.y})</p>
                  <p>크기: {pendingTextField.width} × {pendingTextField.height}px</p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleTextFieldCancel}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleTextFieldConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={!textFieldLabel.trim()}
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 표 생성 모달 */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">표 생성</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    행 수
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={modalTableRows}
                    onChange={(e) => setModalTableRows(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    열 수
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={modalTableCols}
                    onChange={(e) => setModalTableCols(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {pendingTableField && (
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  <p>위치: ({pendingTableField.x}, {pendingTableField.y})</p>
                  <p>크기: {pendingTableField.width} × {pendingTableField.height}px</p>
                  <p className="mt-1 text-xs">각 칸 크기: {Math.floor(pendingTableField.width / modalTableCols)} × {Math.floor((pendingTableField.height - 30) / modalTableRows)}px</p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleTableCancel}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleTableConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateUploadPdf;
