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
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewFieldModalOpen, setIsNewFieldModalOpen] = useState(false);
  const [newFieldPosition, setNewFieldPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [step, setStep] = useState<'upload' | 'edit'>('upload');

  // 필드 드래그 앤 드롭 상태
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [resizingField, setResizingField] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preventClick, setPreventClick] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);

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
    
    // PDF 파일을 Object URL로 변환하여 미리보기
    const objectUrl = URL.createObjectURL(file);
    setPdfImageUrl(objectUrl);
  };

  const handlePdfClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 'edit') return;
    
    // preventClick이 true이거나 드래그 관련 상태가 있으면 완전히 차단
    if (preventClick || draggingField || resizingField || isDragging) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 새 필드 생성을 위한 위치 저장 및 모달 열기
    setNewFieldPosition({ x: Math.round(x), y: Math.round(y) });
    setIsNewFieldModalOpen(true);
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
  const handleMouseUp = (event?: React.MouseEvent) => {
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
  };

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
            required: field.required
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
      // 성공 시 템플릿 목록으로 이동
      navigate('/templates');
    } catch (error: any) {
      console.error('PDF 템플릿 업로드 실패:', error);
      setError(error.response?.data?.error || 'PDF 템플릿 업로드에 실패했습니다.');
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
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingField, resizingField]);

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
          <div className="bg-white rounded-lg shadow-sm border p-2 h-full">
            <div 
              className="relative bg-gray-100 h-full overflow-auto"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {/* PDF 미리보기 - 150 DPI 기준 고정 크기 (DocumentEditor.tsx와 동일) */}
              <div 
                className="relative bg-white shadow-sm border mx-auto cursor-crosshair"
                onClick={handlePdfClick}
                style={{
                  width: '1240px', // A4 150 DPI 너비 (8.27 * 150)
                  height: '1754px', // A4 150 DPI 높이 (11.69 * 150)
                  maxWidth: '100%'
                }}
              >
                {pdfImageUrl ? (
                  <iframe 
                    src={`${pdfImageUrl}#view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                    className="absolute inset-0 w-full h-full border-none pointer-events-none"
                    title="PDF Preview"
                    onLoad={() => {
                      console.log('📐 템플릿 PDF iframe 로드 완료:', {
                        containerSize: { width: 1240, height: 1754 }
                      });
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
                
                {/* 필드 오버레이 */}
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className={`absolute border-2 group select-none ${
                      draggingField === field.id 
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
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </div>
                    
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
        </div>

        {/* 우측 필드 관리 패널 */}
        <div className="w-80 bg-white border-l">
          <div className="p-6 space-y-6">
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
    </div>
  );
};

export default TemplateUploadPdf;
