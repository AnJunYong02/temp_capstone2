import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const TemplateUploadPdf: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (file: File) => {
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

        <form onSubmit={handleSubmit} className="space-y-6">
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
                    onClick={() => setSelectedFile(null)}
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

          {/* 템플릿 이름 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              템플릿 이름 *
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="예: 근무일지 템플릿"
              required
            />
          </div>

          {/* 설명 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              설명 (선택사항)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="템플릿에 대한 설명을 입력하세요"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => navigate('/templates')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={uploading}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading || !selectedFile || !templateName.trim()}
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
        </form>

        {/* 안내 사항 */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">📋 안내사항</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• PDF 파일은 최대 10MB까지 업로드할 수 있습니다.</li>
            <li>• 업로드 후 편집 단계에서 클릭하여 입력 필드를 추가할 수 있습니다.</li>
            <li>• 템플릿은 문서 생성 시 기본 양식으로 사용됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TemplateUploadPdf; 