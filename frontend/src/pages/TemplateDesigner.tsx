import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTemplateStore } from '../stores/templateStore';
import PdfViewer, { type CoordinateField } from '../components/PdfViewer';
import axios from 'axios';

const TemplateDesigner: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentTemplate, getTemplate, updateTemplate } = useTemplateStore();

  const [fields, setFields] = useState<CoordinateField[]>([]);
  const [selectedField, setSelectedField] = useState<CoordinateField | null>(null);
  const [assignedEmailInput, setAssignedEmailInput] = useState('');
  const [addMode, setAddMode] = useState<'text' | 'table'>('text');
  const [isAddingField, setIsAddingField] = useState(false); // 필드 추가 모드 상태
  const [isAddingTable, setIsAddingTable] = useState(false);
  
  // 텍스트 입력 모달 상태
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [pendingTextField, setPendingTextField] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [textFieldLabel, setTextFieldLabel] = useState('');
  
  // 표 생성 모달 상태
  const [showTableModal, setShowTableModal] = useState(false);
  const [pendingTableField, setPendingTableField] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [modalTableRows, setModalTableRows] = useState<number>(3);
  const [modalTableCols, setModalTableCols] = useState<number>(3);

  useEffect(() => {
    if (id) getTemplate(parseInt(id));
  }, [id, getTemplate]);

  useEffect(() => {
    if (!currentTemplate) return;
    try {
      const parsed: CoordinateField[] = currentTemplate.coordinateFields ? JSON.parse(currentTemplate.coordinateFields) : [];
      // 좌표 정수화
      const normalized = parsed.map(f => ({
        ...f,
        x: Math.round(f.x),
        y: Math.round(f.y),
        width: Math.round(f.width),
        height: Math.round(f.height),
        isTemplateField: true
      }));
      setFields(normalized);
    } catch {
      setFields([]);
    }
  }, [currentTemplate]);

  const pdfImageUrl = useMemo(() => {
    if (!currentTemplate?.pdfImagePath) return '';
    const filename = currentTemplate.pdfImagePath.split('/').pop();
    return `http://localhost:8080/api/files/pdf-template-images/${filename}`;
  }, [currentTemplate]);

  const addFieldAt = (x: number, y: number, width?: number, height?: number) => {
    // 필드 추가 모드가 아닐 때는 필드 생성하지 않음
    if (!isAddingField || !width || !height) {
      return;
    }

    if (addMode === 'table') {
      // 표 생성 모달 표시
      setPendingTableField({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      });
      setShowTableModal(true);
      setIsAddingField(false); // 필드 추가 모드 해제
      return;
    }

    // 텍스트 필드 생성 모달 표시
    setPendingTextField({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    });
    setTextFieldLabel(''); // 초기화
    setShowTextInputModal(true);
    setIsAddingField(false); // 필드 추가 모드 해제
  };

  const handleFieldSelect = (f: CoordinateField | null) => setSelectedField(f);

  // 텍스트 필드 생성 확인
  const handleTextFieldConfirm = () => {
    if (!pendingTextField) return;
    
    const newField: CoordinateField = {
      id: `field_${Date.now()}`,
      x: pendingTextField.x,
      y: pendingTextField.y,
      width: pendingTextField.width,
      height: pendingTextField.height,
      label: textFieldLabel || '새 필드',
      type: 'text',
      value: '',
      fontSize: 12,
      fontColor: '#000000',
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
      location_column: idx + 1
    }));

    const newField: CoordinateField = {
      id: `table_${Date.now()}`,
      x: pendingTableField.x,
      y: pendingTableField.y,
      width: pendingTableField.width,
      height: pendingTableField.height,
      label: '표',
      type: 'table',
      value: '',
      fontSize: 12,
      fontColor: '#000000',
      required: false,
      rows: rows,
      columnsCount: cols,
      columns,
      tableId: `tbl_${Date.now()}`
    } as any;
    
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

  const handleFieldChange = (prop: keyof CoordinateField, value: any) => {
    if (!selectedField) return;
    const next = fields.map(f => {
      if (f.id !== selectedField.id) return f;
      const nextVal = ['x','y','width','height'].includes(prop as string) ? Math.round(value) : value;
      return { ...f, [prop]: nextVal } as CoordinateField;
    });
    setFields(next);
    setSelectedField({ ...selectedField, [prop]: ['x','y','width','height'].includes(prop as string) ? Math.round(value) : value });
  };

  const saveTemplateFields = async () => {
    if (!currentTemplate) return;
    try {
      await updateTemplate(currentTemplate.id, {
        name: currentTemplate.name,
        description: currentTemplate.description,
        isPublic: currentTemplate.isPublic,
        pdfFilePath: currentTemplate.pdfFilePath,
        pdfImagePath: currentTemplate.pdfImagePath,
        coordinateFields: JSON.stringify(fields)
      });
      alert('템플릿 필드가 저장되었습니다.');
      // 설계 화면은 포크한 사용자만 접근하도록 유도 (템플릿 목록로 복귀)
      navigate('/templates');
    } catch (e) {
      alert('템플릿 저장에 실패했습니다.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">템플릿 디자이너</h1>
        <div className="space-x-2">
          <button onClick={() => navigate('/templates')} className="btn btn-secondary">취소</button>
          <button onClick={saveTemplateFields} className="btn btn-primary">저장</button>
        </div>
      </div>

      {!currentTemplate ? (
        <div className="text-gray-500">템플릿을 불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <PdfViewer
              pdfImageUrl={pdfImageUrl}
              coordinateFields={fields}
              onCoordinateFieldsChange={setFields}
              editable={true}
              showFieldUI={true}
              scale={1}
              onFieldSelect={handleFieldSelect}
              selectedFieldId={selectedField?.id || null}
              onAddField={(x,y,width,height) => addFieldAt(x,y,width,height)}
              isAddingField={isAddingField}
            />
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow border">
              <div className="px-4 py-3 border-b"><h3 className="font-semibold">필드 속성</h3></div>
              <div className="p-4 space-y-4">
                {/* 항상 표시되는 추가 모드 패널 */}
                <div className="space-y-3 border rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">추가 모드</span>
                    <div className="space-x-2">
                      <button 
                        className={`px-2 py-1 text-xs rounded ${addMode==='text' && isAddingField ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} 
                        onClick={()=>{
                          setAddMode('text'); 
                          setIsAddingTable(false); 
                          setIsAddingField(!isAddingField || addMode !== 'text'); // 토글 또는 활성화
                        }}
                      >
                        {addMode === 'text' && isAddingField ? '텍스트 추가 중...' : '텍스트'}
                      </button>
                      <button 
                        className={`px-2 py-1 text-xs rounded ${addMode==='table' && isAddingField ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} 
                        onClick={()=>{
                          setAddMode('table'); 
                          setIsAddingTable(true); 
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

                {selectedField ? (
                  <>
                    {selectedField.type === 'table' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">행 수</label>
                            <input
                              type="number"
                              min={1}
                              className="input"
                              value={(selectedField as any).rows || 3}
                              onChange={e => {
                                const nextVal = Math.max(1, parseInt(e.target.value || '1'));
                                handleFieldChange('rows' as any, nextVal);
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">열 수</label>
                            <input
                              type="number"
                              min={1}
                              className="input"
                              value={(selectedField as any).columnsCount || (selectedField as any).columns?.length || 1}
                              onChange={e => {
                                const count = Math.max(1, parseInt(e.target.value || '1'));
                                const existing = (selectedField as any).columns || [];
                                const nextCols = Array.from({ length: count }, (_, i) => existing[i] || {
                                  title: `컬럼${i + 1}`,
                                  width: Math.floor((selectedField.width || 400) / count),
                                  width_ratio: '1',
                                  location_column: String(i)
                                });
                                // update both columnsCount and columns
                                const nextFields = fields.map(f => f.id === selectedField.id ? ({ ...f, columnsCount: count, columns: nextCols } as any) : f);
                                setFields(nextFields);
                                setSelectedField(prev => prev ? ({ ...(prev as any), columnsCount: count, columns: nextCols }) : prev);
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-2">컬럼 설정</label>
                          <div className="space-y-2 max-h-56 overflow-auto">
                            {((selectedField as any).columns || []).map((col: any, idx: number) => (
                              <div key={idx} className="grid grid-cols-6 gap-2 items-center">
                                <span className="text-xs text-gray-500 col-span-1">{idx + 1}</span>
                                <input
                                  className="input col-span-3"
                                  value={col.title}
                                  onChange={e => {
                                    const nextCols = ([...((selectedField as any).columns || [])] as any[]);
                                    nextCols[idx] = { ...nextCols[idx], title: e.target.value };
                                    const nextFields = fields.map(f => f.id === selectedField.id ? ({ ...f, columns: nextCols } as any) : f);
                                    setFields(nextFields);
                                    setSelectedField(prev => prev ? ({ ...(prev as any), columns: nextCols }) : prev);
                                  }}
                                />
                                <input
                                  type="number"
                                  className="input col-span-2"
                                  value={col.width}
                                  onChange={e => {
                                    const w = Math.max(20, parseInt(e.target.value || '20'));
                                    const nextCols = ([...((selectedField as any).columns || [])] as any[]);
                                    nextCols[idx] = { ...nextCols[idx], width: w };
                                    const nextFields = fields.map(f => f.id === selectedField.id ? ({ ...f, columns: nextCols } as any) : f);
                                    setFields(nextFields);
                                    setSelectedField(prev => prev ? ({ ...(prev as any), columns: nextCols }) : prev);
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">폭(px)을 수정해 열 너비를 조정할 수 있습니다.</p>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">라벨</label>
                      <input className="input" value={selectedField.label} onChange={e=>handleFieldChange('label', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">타입</label>
                      <select className="input" value={selectedField.type} onChange={e=>handleFieldChange('type', e.target.value as CoordinateField['type'])}>
                        <option value="text">text</option>
                        <option value="textarea">textarea</option>
                        <option value="date">date</option>
                        <option value="number">number</option>
                        <option value="signature">signature</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">X</label>
                        <input type="number" className="input" value={Math.round(selectedField.x)} onChange={e=>handleFieldChange('x', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Y</label>
                        <input type="number" className="input" value={Math.round(selectedField.y)} onChange={e=>handleFieldChange('y', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">W</label>
                        <input type="number" className="input" value={Math.round(selectedField.width)} onChange={e=>handleFieldChange('width', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">H</label>
                        <input type="number" className="input" value={Math.round(selectedField.height)} onChange={e=>handleFieldChange('height', Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input id="required" type="checkbox" checked={!!selectedField.required} onChange={e=>handleFieldChange('required', e.target.checked)} />
                      <label htmlFor="required" className="text-sm">필수</label>
                    </div>
                    {selectedField.type !== 'signature' && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">지정 편집자 이메일</label>
                        <input className="input" value={selectedField.assignedUserEmail || ''} onChange={e=>handleFieldChange('assignedUserEmail', e.target.value)} placeholder="예: editor@example.com" />
                        <p className="text-xs text-gray-500 mt-1">지정 시 해당 이메일 사용자만 이 필드를 편집할 수 있습니다.</p>
                      </div>
                    )}
                    <div className="pt-2">
                      <button className="w-full text-red-600 border border-red-300 rounded py-2" onClick={()=>{
                        setFields(prev=>prev.filter(f=>f.id!==selectedField.id));
                        setSelectedField(null);
                      }}>삭제</button>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">좌측 PDF를 클릭해 필드를 추가하세요.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

export default TemplateDesigner;


