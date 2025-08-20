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
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [tableRowsInput, setTableRowsInput] = useState<number>(3);
  const [tableColsInput, setTableColsInput] = useState<number>(3);
  const [tableHeaderInput, setTableHeaderInput] = useState<string>('컬럼1,컬럼2,컬럼3');

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

  const addFieldAt = (x: number, y: number) => {
    if (addMode === 'table' && isAddingTable) {
      const columnsTitles = tableHeaderInput.split(',').map(s => s.trim()).filter(Boolean);
      const cols = Math.max(1, tableColsInput);
      const rows = Math.max(1, tableRowsInput);
      const normalizedTitles = Array.from({ length: cols }, (_, i) => columnsTitles[i] || `컬럼${i + 1}`);
      const defaultWidth = 400;
      const defaultHeight = 30 + rows * 28;
      const columnWidth = Math.floor(defaultWidth / cols);
      const columns = normalizedTitles.map((title, idx) => ({
        title,
        width: columnWidth,
        width_ratio: '1',
        location_column: String(idx)
      }));

      const newField: CoordinateField = {
        id: `table_${Date.now()}`,
        x: Math.round(x),
        y: Math.round(y),
        width: defaultWidth,
        height: defaultHeight,
        label: '표',
        type: 'table',
        value: '',
        fontSize: 12,
        fontColor: '#000000',
        required: false,
        // @ts-ignore - table 전용 속성
        rows: rows,
        columnsCount: cols,
        columns,
        tableId: `tbl_${Date.now()}`
      } as any;
      setFields(prev => [...prev, newField]);
      setIsAddingTable(false);
      setAddMode('text');
      return;
    }

    const newField: CoordinateField = {
      id: `field_${Date.now()}`,
      x: Math.round(x),
      y: Math.round(y),
      width: 120,
      height: 30,
      label: '새 필드',
      type: 'text',
      value: '',
      fontSize: 12,
      fontColor: '#000000',
      required: false
    };
    setFields(prev => [...prev, newField]);
  };

  const handleFieldSelect = (f: CoordinateField | null) => setSelectedField(f);

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
              onAddField={(x,y) => addFieldAt(x,y)}
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
                      <button className={`px-2 py-1 text-xs rounded ${addMode==='text' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={()=>{setAddMode('text'); setIsAddingTable(false);}}>텍스트</button>
                      <button className={`px-2 py-1 text-xs rounded ${addMode==='table' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={()=>{setAddMode('table'); setIsAddingTable(true);}}>표</button>
                    </div>
                  </div>
                  {addMode === 'table' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">행 수</label>
                          <input type="number" min={1} className="input" value={tableRowsInput} onChange={e=>setTableRowsInput(parseInt(e.target.value||'1'))} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">열 수</label>
                          <input type="number" min={1} className="input" value={tableColsInput} onChange={e=>setTableColsInput(parseInt(e.target.value||'1'))} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">1행 헤더(콤마로 구분)</label>
                        <input className="input" value={tableHeaderInput} onChange={e=>setTableHeaderInput(e.target.value)} />
                      </div>
                      <p className="text-xs text-gray-500">좌측 PDF 원하는 위치를 클릭하면 표가 추가됩니다.</p>
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
    </div>
  );
};

export default TemplateDesigner;


