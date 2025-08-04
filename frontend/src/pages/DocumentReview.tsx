import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore, type Document } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { SignatureModal } from '../components/SignatureModal';
import PdfViewer from '../components/PdfViewer';
import axios from 'axios';

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReject: (reason: string) => void;
}

const RejectModal: React.FC<RejectModalProps> = ({ isOpen, onClose, onReject }) => {
  const [reason, setReason] = useState('');

  const handleReject = () => {
    if (!reason.trim()) {
      alert('반려 사유를 입력해주세요.');
      return;
    }
    onReject(reason);
    setReason('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-800">❌ 문서 반려</h2>
          <p className="text-sm text-gray-600 mt-1">
            반려 사유를 입력해주세요
          </p>
        </div>

        <div className="p-6">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="반려 사유를 상세히 입력해주세요..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          
          <div className="flex space-x-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleReject}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              반려
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DocumentReview: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { user } = useAuthStore();

  // 모달 상태
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    if (id) {
      getDocument(parseInt(id));
    }
  }, [id, getDocument]);

  // 검토자 권한 확인
  const isReviewer = () => {
    if (!currentDocument || !user) return false;
    return currentDocument.tasks?.some(task => 
      task.role === 'REVIEWER' && 
      task.assignedUserEmail === user.email
    );
  };

  // 검토 가능한 상태인지 확인
  const canReview = () => {
    if (!currentDocument || !user) return false;
    return isReviewer() && (currentDocument.status === 'REVIEWING' || currentDocument.status === 'READY_FOR_REVIEW');
  };

  // 승인 핸들러
  const handleApprove = () => {
    if (!canReview()) {
      alert('검토 권한이 없거나 검토 가능한 상태가 아닙니다.');
      return;
    }
    setShowSignatureModal(true);
  };

  // 서명 저장 핸들러
  const handleSignatureSave = async (signatureData: string) => {
    if (!currentDocument || !user) return;
    
    try {
      const { token } = useAuthStore.getState();
      
      console.log('📝 서명 저장 시도:', {
        documentId: currentDocument.id,
        documentStatus: currentDocument.status,
        userEmail: user.email,
        signatureDataLength: signatureData?.length,
        token: token ? '있음' : '없음'
      });
      
      const requestBody = {
        signatureData,
        reviewerEmail: user.email
      };
      
      console.log('📤 요청 본문:', requestBody);
      
      const response = await axios.post(
        `http://localhost:8080/api/documents/${currentDocument.id}/approve`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ 응답 성공:', response.data);
      
      // 응답에서 직접 서명 데이터 확인
      console.log('🔍 응답에서 서명 데이터 확인:', {
        documentId: response.data.id,
        documentStatus: response.data.status,
        signatureFields: response.data.data?.signatureFields,
        signatures: response.data.data?.signatures,
        hasSignatureData: !!response.data.data?.signatures?.[user.email],
        allSignatures: response.data.data?.signatures
      });
      
      // 서명 저장 후 문서를 다시 로드하여 서명이 표시되도록 함
      const updatedDocument = await getDocument(Number(id));
      
      console.log('🔄 문서 재로드 후 서명 데이터 확인 (직접):', {
        documentId: updatedDocument?.id,
        documentStatus: updatedDocument?.status,
        signatureFields: updatedDocument?.data?.signatureFields,
        signatures: updatedDocument?.data?.signatures,
        hasSignatureData: !!updatedDocument?.data?.signatures?.[user.email],
        allSignatures: updatedDocument?.data?.signatures
      });
      
      alert('✅ 문서가 승인되었습니다! 서명이 문서에 추가되었습니다.');
      
      // 사용자가 직접 페이지를 이동할 수 있도록 자동 이동 제거
      // setTimeout(() => {
      //   navigate('/tasks');
      // }, 2000);
      
    } catch (error: any) {
      console.error('❌ 승인 실패:', error);
      console.error('❌ 에러 응답:', error.response?.data);
      console.error('❌ 에러 상태:', error.response?.status);
      console.error('❌ 에러 메시지:', error.message);
      alert(`승인 처리에 실패했습니다: ${error.response?.data?.error || error.message}`);
    }
  };

  // 반려 핸들러
  const handleReject = () => {
    if (!canReview()) {
      alert('검토 권한이 없거나 검토 가능한 상태가 아닙니다.');
      return;
    }
    setShowRejectModal(true);
  };

  // 반려 실행
  const executeReject = async (reason: string) => {
    if (!currentDocument || !user) return;
    
    try {
      const { token } = useAuthStore.getState();
      
      await axios.post(
        `http://localhost:8080/api/documents/${currentDocument.id}/reject`,
        {
          reason,
          reviewerEmail: user.email
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      alert('❌ 문서가 반려되었습니다.');
      setShowRejectModal(false);
      navigate('/tasks');
    } catch (error) {
      console.error('반려 실패:', error);
      alert('반려 처리에 실패했습니다.');
    }
  };

  // PDF 이미지 URL 생성
  const getPdfImageUrl = (document: Document) => {
    console.log('🔍 DocumentReview - PDF 이미지 URL 생성:', {
      template: document.template,
      pdfImagePath: document.template?.pdfImagePath
    });
    
    if (!document.template?.pdfImagePath) {
      console.warn('⚠️ DocumentReview - PDF 이미지 경로가 없습니다');
      return '';
    }
    
    const filename = document.template.pdfImagePath.split('/').pop();
    const url = `http://localhost:8080/api/files/pdf-template-images/${filename}`;
    
    console.log('📄 DocumentReview - 생성된 PDF 이미지 URL:', {
      originalPath: document.template.pdfImagePath,
      filename: filename,
      url: url
    });
    
    return url;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">문서를 찾을 수 없습니다.</div>
      </div>
    );
  }

  if (!isReviewer()) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500">이 문서의 검토자 권한이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg">
        {/* 문서 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                📋 {currentDocument.templateName} - 검토
              </h1>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                <span>상태: <span className="font-medium text-blue-600">{currentDocument.status}</span></span>
                <span>생성일: {new Date(currentDocument.createdAt).toLocaleDateString()}</span>
                <span>검토자: {user?.name}</span>
              </div>
              
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                {currentDocument.status === 'READY_FOR_REVIEW' 
                  ? '🔍 검토 준비 단계: 문서 내용을 확인하고 승인 또는 반려를 결정해주세요.'
                  : '🔍 검토 모드: 문서 내용을 확인하고 승인 또는 반려를 결정해주세요.'
                }
              </div>
            </div>

            {/* 검토 액션 버튼들 */}
            {canReview() && (
              <div className="flex space-x-3">
                <button
                  onClick={handleApprove}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  ✅ 승인
                </button>
                <button
                  onClick={handleReject}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  ❌ 반려
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 문서 내용 - PDF 뷰어 */}
        <div className="px-6 py-6">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              📄 검토할 문서
            </h2>
            <p className="text-sm text-gray-600">
              문서 내용을 확인하고 검토 의견을 결정해주세요
            </p>
          </div>

          <div className="flex justify-center">
            <PdfViewer
              pdfImageUrl={getPdfImageUrl(currentDocument)}
              coordinateFields={currentDocument.data?.coordinateFields || []}
              onCoordinateFieldsChange={() => {}}
              editable={false}
              scale={1}
              signatureFields={(() => {
                const signatureFields = currentDocument.data?.signatureFields || [];
                const signatures = currentDocument.data?.signatures || {};
                
                console.log('🔍 서명 필드 매핑 상세 분석:', {
                  documentId: currentDocument.id,
                  documentStatus: currentDocument.status,
                  signatureFieldsCount: signatureFields.length,
                  signaturesCount: Object.keys(signatures).length,
                  signatures: signatures,
                  signatureFields: signatureFields,
                  currentUserEmail: user?.email
                });
                
                const mappedFields = signatureFields.map(field => {
                  // 해당 검토자의 서명 데이터 찾기
                  const signatureData = signatures[field.reviewerEmail];
                  console.log(`🔍 서명 필드 매핑 - ${field.reviewerName} (${field.reviewerEmail}):`, {
                    fieldId: field.id,
                    hasSignatureData: !!signatureData,
                    signatureDataLength: signatureData?.length || 0,
                    signatureDataPreview: signatureData ? signatureData.substring(0, 50) + '...' : '없음'
                  });
                  
                  return {
                    ...field,
                    signatureData: signatureData
                  };
                });
                
                console.log('✅ 최종 매핑된 서명 필드:', mappedFields.map(field => ({
                  id: field.id,
                  reviewerEmail: field.reviewerEmail,
                  reviewerName: field.reviewerName,
                  hasSignatureData: !!field.signatureData,
                  signatureDataLength: field.signatureData?.length || 0
                })));
                
                return mappedFields;
              })()}
            />
          </div>
        </div>
      </div>

      {/* 서명 모달 */}
      {showSignatureModal && (
        <SignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onSave={handleSignatureSave}
          reviewerName={user?.name || '검토자'}
        />
      )}

      {/* 반려 모달 */}
      <RejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onReject={executeReject}
      />
    </div>
  );
};

export default DocumentReview; 