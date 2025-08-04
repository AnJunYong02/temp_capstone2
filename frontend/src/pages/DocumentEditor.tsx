import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDocumentStore, type Document, type DocumentData } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import PdfViewer, { type CoordinateField } from '../components/PdfViewer';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  name: string;
  position: string;
}

const DocumentEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentDocument, loading, error, getDocument, updateDocument, clearCurrentDocument } = useDocumentStore();
  const { user: currentUser } = useAuthStore();


  


  // PDF 기반 문서 편집을 위한 state
  const [coordinateData, setCoordinateData] = useState<Record<string, any>>({});
  const [coordinateFields, setCoordinateFields] = useState<CoordinateField[]>([]);
  const [selectedCoordinateField, setSelectedCoordinateField] = useState<CoordinateField | null>(null);
  
  // 편집 모드 상태 (검토 준비 단계에서는 편집 불가)
  const [isEditing, setIsEditing] = useState(false);
  const [userManuallySetMode, setUserManuallySetMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // 서명 필드 편집 모드 (검토 준비 단계에서도 가능)
  const [isSignatureFieldEditing, setIsSignatureFieldEditing] = useState(false);

  // 검토자 관련 상태
  const [selectedReviewers, setSelectedReviewers] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);

  // 서명 필드 관련 상태
  const [signatureFields, setSignatureFields] = useState<Array<{
    id: string;
    reviewerEmail: string;
    reviewerName: string;
    x: number;
    y: number;
    width: number;
    height: number;
    signatureData?: string;
  }>>([]);
  const [editingSignatureField, setEditingSignatureField] = useState<{
    id: string;
    reviewerEmail: string;
    reviewerName: string;
    x: number;
    y: number;
    width: number;
    height: number;
    signatureData?: string;
  } | null>(null);
  const [isAddingSignatureField, setIsAddingSignatureField] = useState(false);
  const [currentSignatureReviewer, setCurrentSignatureReviewer] = useState<User | null>(null);

  // 검토 요청 관련 상태
  const [showReviewRequestModal, setShowReviewRequestModal] = useState(false);
  
  // 필드 생성 버튼 관련 상태
  const [showAddFieldButton, setShowAddFieldButton] = useState(false);
  const [addFieldPosition, setAddFieldPosition] = useState<{ x: number; y: number } | null>(null);
  
  // 저장되지 않은 변경사항이 있는지 확인하는 함수
  const hasUnsavedChanges = useCallback(() => {
    if (!currentDocument) return false;
    
    // 1. 추가된 필드가 있는지 확인 (템플릿 필드 외의 필드)
    const templateCoordinateFields = currentDocument.template?.coordinateFields ? JSON.parse(currentDocument.template.coordinateFields) : [];
    const templateFieldIds = new Set(templateCoordinateFields.map((field: any) => field.id) || []);
    const hasAdditionalFields = coordinateFields.some(field => !templateFieldIds.has(field.id));
    
    // 2. 필드 값이 변경되었는지 확인
    const hasValueChanges = Object.keys(coordinateData).some(fieldId => {
      const savedValue = currentDocument.data?.coordinateData?.[fieldId] || '';
      const currentValue = coordinateData[fieldId] || '';
      return savedValue !== currentValue;
    });
    
    // 3. 서명 필드가 추가되었는지 확인
    const hasSignatureFields = signatureFields.length > 0;
    
    return hasAdditionalFields || hasValueChanges || hasSignatureFields;
  }, [currentDocument, coordinateFields, coordinateData, signatureFields]);

  // 안전한 페이지 이동 함수 (저장되지 않은 변경사항 확인)
  const safeNavigate = (to: string) => {
    if (hasUnsavedChanges()) {
      const shouldLeave = window.confirm('저장되지 않은 변경사항이 있습니다. 페이지를 나가시겠습니까?');
      if (!shouldLeave) {
        return false; // 페이지 이동 취소
      }
      // 사용자가 나가기를 선택한 경우 필드 상태 초기화
      resetAllFieldStates();
    }
    navigate(to);
    return true;
  };
  
  // 모든 필드 상태를 초기화하는 함수
  const resetAllFieldStates = useCallback(() => {
    console.log('🧹 모든 필드 상태 초기화 시작');
    
    // 모든 필드 관련 상태 초기화
    setCoordinateFields([]);
    setCoordinateData({});
    setSignatureFields([]);
    setSelectedReviewers([]);
    setSelectedCoordinateField(null);
    setEditingSignatureField(null);
    setIsSignatureFieldEditing(false);
    setIsAddingSignatureField(false);
    setCurrentSignatureReviewer(null);
    setShowReviewRequestModal(false);
    setUserManuallySetMode(false);
    setIsEditing(false);
    
    // 검색 관련 상태도 초기화
    setSearchResults([]);
    setIsSearching(false);
    
    console.log('🧹 모든 필드 상태 초기화 완료');
  }, []);
  
  // 서명 위치 선택 핸들러
  const handleSignaturePositionSelect = (field: CoordinateField) => {
    console.log('🎯 서명 위치 선택됨:', {
      field: field,
      currentSignatureReviewer: currentSignatureReviewer?.name,
      isAddingSignatureField: isAddingSignatureField
    });
    
    if (currentSignatureReviewer) {
      // 서명 필드 추가
      const newSignatureField = {
        id: `signature_${Date.now()}`,
        reviewerEmail: currentSignatureReviewer.email,
        reviewerName: currentSignatureReviewer.name,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height
      };
      
      console.log('➕ 새 서명 필드 생성:', newSignatureField);
      
      setSignatureFields(prev => [...prev, newSignatureField]);
      setIsAddingSignatureField(false);
      setCurrentSignatureReviewer(null);
      
      alert(`${currentSignatureReviewer.name}님의 서명 필드가 추가되었습니다.`);
    }
  };

  // 서명 필드 추가 시작
  const startSignatureFieldAddition = (reviewer: User) => {
    console.log('🔧 서명 필드 추가 시작:', {
      reviewer: reviewer.name,
      isAddingSignatureField: true
    });
    setCurrentSignatureReviewer(reviewer);
    setIsAddingSignatureField(true);
  };

  // 서명 필드 제거
  const removeSignatureField = (reviewerEmail: string) => {
    setSignatureFields(prev => prev.filter(field => field.reviewerEmail !== reviewerEmail));
  };
  
  // 서명 위치 선택 시작
  const startSignaturePositionSelection = (reviewer: User) => {
    setCurrentSignatureReviewer(reviewer);
    setIsAddingSignatureField(true);
  };

  // 검토자 제거
  const removeReviewer = (userId: number) => {
    const reviewer = selectedReviewers.find(r => r.id === userId);
    if (reviewer) {
      // 해당 검토자의 서명 필드도 제거
      setSignatureFields(prev => prev.filter(field => field.reviewerEmail !== reviewer.email));
    }
    setSelectedReviewers(selectedReviewers.filter(reviewer => reviewer.id !== userId));
  };

  // 서명 필드 편집 시작 (클릭만으로 편집 모드 진입)
  const startSignatureFieldEdit = (signatureField: {
    id: string;
    reviewerEmail: string;
    reviewerName: string;
    x: number;
    y: number;
    width: number;
    height: number;
    signatureData?: string;
  }) => {
    setEditingSignatureField(signatureField);
    setIsSignatureFieldEditing(true);
  };

  // 서명 필드 편집 완료 (자동으로 편집 모드 종료)
  const finishSignatureFieldEdit = () => {
    setEditingSignatureField(null);
    setIsSignatureFieldEditing(false);
  };

  // 서명 필드 위치/크기 변경
  const updateSignatureField = (fieldId: string, updates: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>) => {
    setSignatureFields(prev => {
      const updated = prev.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      );
      return updated;
    });
  };
  
  // 편집 완료 함수
  const handleCompleteEditing = async () => {
    if (!currentDocument) return;
    
    try {
      // authStore에서 토큰 가져오기
      const { token } = useAuthStore.getState();
      console.log('🔄 편집 완료 요청:', {
        documentId: currentDocument.id,
        documentStatus: currentDocument.status,
        hasToken: !!token,
        token: token ? `${token.substring(0, 20)}...` : null
      });
      
      const response = await axios.post(
        `http://localhost:8080/api/documents/${currentDocument.id}/complete-editing`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('✅ 편집 완료 성공:', response.data);
      alert('📋 편집이 완료되었습니다! 이제 검토 요청을 할 수 있습니다.');
      
      // 문서 상태 새로고침
      getDocument(currentDocument.id);
      setIsEditing(false);
      
      // 편집 완료 시 모든 필드 상태 초기화
      resetAllFieldStates();
    } catch (error) {
      console.error('❌ 편집 완료 실패:', error);
      
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
        console.error('상세 오류:', {
          status: error.response?.status,
          data: error.response?.data,
          message: errorMessage
        });
        alert(`편집 완료에 실패했습니다: ${errorMessage}`);
      } else {
        alert('편집 완료에 실패했습니다.');
      }
    }
  };

  useEffect(() => {
    if (id) {
      getDocument(parseInt(id));
    }
    
    // 컴포넌트 언마운트 시 모든 상태 초기화
    return () => {
      console.log('🚪 DocumentEditor 컴포넌트 언마운트 - 상태 초기화');
      clearCurrentDocument();
      resetAllFieldStates();
    };
  }, [id, getDocument, clearCurrentDocument]);

  useEffect(() => {
    // 문서 ID가 변경될 때마다 모든 필드 상태를 완전히 초기화
    console.log('🔄 문서 ID 변경 감지 - 모든 필드 상태 초기화');
    
    // 1. 전역 문서 상태 초기화
    clearCurrentDocument();
    
    // 2. 즉시 모든 필드 상태 초기화
    setCoordinateFields([]);
    setCoordinateData({});
    setSignatureFields([]);
    setSelectedCoordinateField(null);
    setEditingSignatureField(null);
    setIsSignatureFieldEditing(false);
    setIsAddingSignatureField(false);
    setCurrentSignatureReviewer(null);
    setShowReviewRequestModal(false);
    setUserManuallySetMode(false);
    setIsEditing(false);
    
    // 3. 검색 관련 상태도 초기화
    setSearchResults([]);
    setIsSearching(false);
    
    console.log('🧹 모든 필드 상태 초기화 완료');
  }, [id, clearCurrentDocument]); // 문서 ID와 clearCurrentDocument 의존성으로 설정

  // currentDocument가 로드된 후 필드 데이터 설정
  useEffect(() => {
    if (currentDocument) {
      console.log('📄 문서 데이터 로드 시작:', currentDocument.id);
      console.log('📄 문서 데이터:', {
        template: currentDocument.template,
        data: currentDocument.data,
        templateCoordinateFields: currentDocument.template?.coordinateFields
      });
      
      let templateFields: CoordinateField[] = [];
      let allFields: CoordinateField[] = [];
      let allCoordinateData: Record<string, any> = {};
      
      // 템플릿 필드 로드 (있는 경우에만)
      if (currentDocument.template?.coordinateFields) {
        try {
          const templateCoordinateFields = JSON.parse(currentDocument.template.coordinateFields);
          templateFields = templateCoordinateFields.map((field: any) => ({
            ...field,
            value: currentDocument.data?.coordinateData?.[field.id] || ''
          }));
        } catch (error) {
          console.error('템플릿 필드 파싱 오류:', error);
        }
      }
      
      // 저장된 추가 필드들 로드
      const savedAdditionalFields = currentDocument.data?.coordinateFields || [];
      const templateFieldIds = new Set(templateFields.map(field => field.id));
      
      // 템플릿에 없는 필드들만 추가 (중복 방지)
      const uniqueAdditionalFields = savedAdditionalFields.filter(field => !templateFieldIds.has(field.id));
      
      // 서명 필드들을 coordinateFields에 추가
      const savedSignatureFields = currentDocument.data?.signatureFields || [];
      const signatures = currentDocument.data?.signatures || {};
      
      const signatureFieldsAsCoordinateFields: CoordinateField[] = savedSignatureFields.map(signatureField => ({
        id: signatureField.id,
        x: signatureField.x,
        y: signatureField.y,
        width: signatureField.width,
        height: signatureField.height,
        label: `${signatureField.reviewerName} 서명`,
        type: 'signature' as const,
        value: '',
        reviewerEmail: signatureField.reviewerEmail,
        signatureData: signatures[signatureField.reviewerEmail]
      }));
      
      allFields = [...templateFields, ...uniqueAdditionalFields, ...signatureFieldsAsCoordinateFields];
      
      // 필드 설정
      setCoordinateFields(allFields);
      
      // coordinateData 설정 (모든 필드의 데이터 포함)
      
      // 템플릿 필드의 데이터
      templateFields.forEach(field => {
        allCoordinateData[field.id] = currentDocument.data?.coordinateData?.[field.id] || '';
      });
      
      // 추가 필드의 데이터
      uniqueAdditionalFields.forEach(field => {
        allCoordinateData[field.id] = currentDocument.data?.coordinateData?.[field.id] || '';
      });
      
      setCoordinateData(allCoordinateData);
      
      // 서명 필드 설정
      setSignatureFields(currentDocument.data?.signatureFields || []);
      
      console.log('✅ 문서 데이터 로드 완료:', {
        documentId: currentDocument.id,
        templateName: currentDocument.templateName,
        templateFieldsCount: templateFields.length,
        additionalFieldsCount: uniqueAdditionalFields.length,
        signatureFieldsCount: signatureFieldsAsCoordinateFields.length,
        totalFieldsCount: allFields.length,
        coordinateDataKeys: Object.keys(allCoordinateData),
        templateFieldIds: Array.from(templateFieldIds),
        savedAdditionalFieldIds: savedAdditionalFields.map(f => f.id),
        signatureFieldIds: signatureFieldsAsCoordinateFields.map(f => f.id),
        allFields: allFields.map(f => ({ id: f.id, label: f.label, type: f.type }))
      });
    }
  }, [currentDocument]); // currentDocument 객체 자체를 의존성으로 설정

  // 편집 모드 자동 제어 (검토 준비 단계에서는 문서 편집 불가, 하지만 서명 필드 편집은 가능)
  useEffect(() => {
    if (userManuallySetMode) return; // 사용자가 수동으로 설정한 경우 무시
    
    if (currentDocument?.status === 'READY_FOR_REVIEW') {
      setIsEditing(false); // 검토 준비 단계에서는 문서 편집 불가
      // 서명 필드 편집 모드는 유지 (초기화하지 않음)
    } else if (currentDocument?.status === 'EDITING') {
      setIsEditing(true); // 편집 단계에서는 편집 가능
    } else {
      setIsEditing(false); // 기타 상태에서는 편집 불가
    }
  }, [currentDocument?.status, userManuallySetMode]);

  // 편집 모드 수동 토글 (검토 준비 단계에서는 문서 편집 불가, 하지만 서명 필드 편집은 가능)
  const toggleEditingMode = () => {
    console.log('🔄 편집 모드 토글 시도:', { 
      currentStatus: currentDocument?.status, 
      isCurrentlyEditing: isEditing 
    });
    
    if (currentDocument?.status === 'READY_FOR_REVIEW') {
      alert('검토 준비 단계에서는 문서 필드 편집이 불가능합니다. 서명 필드만 편집할 수 있습니다.');
      return;
    }
    
    // 편집 모드에서 읽기 모드로 전환할 때 저장하지 않은 변경사항 확인
    if (isEditing) {
      console.log('📝 편집 모드에서 읽기 모드로 전환 시도');
      
      // 저장되지 않은 변경사항이 있는지 확인
      const hasFieldChanges = coordinateFields.some(field => {
        const originalValue = currentDocument?.data?.coordinateFields?.find(
          originalField => originalField.id === field.id
        )?.value || '';
        return field.value !== originalValue;
      });
      
      if (hasFieldChanges) {
        const shouldSave = window.confirm(
          '저장하지 않은 변경사항이 있습니다. 저장하시겠습니까?\n\n' +
          '취소를 누르면 변경사항이 손실됩니다.'
        );
        
        if (shouldSave) {
          handleSave().then(() => {
            setUserManuallySetMode(true);
            setIsEditing(false);
          }).catch(() => {
            // 저장 실패 시 편집 모드 유지
            return;
          });
        } else {
          // 저장하지 않고 읽기 모드로 전환
          setUserManuallySetMode(true);
          setIsEditing(false);
        }
      } else {
        // 변경사항이 없으면 바로 읽기 모드로 전환
        setUserManuallySetMode(true);
        setIsEditing(false);
      }
    } else {
      // 읽기 모드에서 편집 모드로 전환
      console.log('✏️ 읽기 모드에서 편집 모드로 전환');
      setUserManuallySetMode(true);
      setIsEditing(true);
    }
  };

  // coordinateData 변경 시 coordinateFields의 value 동기화 (성능 최적화를 위해 제거)
  // useEffect(() => {
  //   setCoordinateFields(prev => prev.map(field => ({
  //     ...field,
  //     value: coordinateData[field.id] || ''
  //   })));
  // }, [coordinateData]);

  // 검색어 변경 시 디바운싱된 검색 실행
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearchQuery) {
        searchUsers(userSearchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);
  // 페이지 이동 시 상태 초기화
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        console.log('⚠️ 저장되지 않은 변경사항 감지 - 사용자 확인 요청');
        const message = '저장되지 않은 변경사항이 있습니다. 페이지를 나가시겠습니까?';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      console.log('🧹 컴포넌트 언마운트 - 모든 필드 상태 초기화');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      resetAllFieldStates();
    };
  }, []); // 의존성 배열을 비워서 한 번만 실행되도록 수정

  // React Router 페이지 이동 감지 및 확인
  useEffect(() => {
    const handleLocationChange = () => {
      if (hasUnsavedChanges()) {
        console.log('⚠️ 저장되지 않은 변경사항 감지 - 페이지 이동 확인 요청');
        const shouldLeave = window.confirm('저장되지 않은 변경사항이 있습니다. 페이지를 나가시겠습니까?');
        
        if (!shouldLeave) {
          // 페이지 이동을 취소하고 현재 페이지에 머무름
          window.history.pushState(null, '', location.pathname);
          return;
        }
        
        // 사용자가 나가기를 선택한 경우 필드 상태 초기화
        console.log('✅ 사용자가 페이지 이동을 선택 - 필드 상태 초기화');
        resetAllFieldStates();
      }
    };

    // 페이지 이동 이벤트 리스너 추가
    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []); // 의존성 배열을 비워서 한 번만 실행되도록 수정

  // 필드 변경 핸들러 (새 필드 생성 시 coordinateData도 초기화)
  const handleCoordinateFieldsChange = (fields: CoordinateField[]) => {
    setCoordinateFields(fields);
    
    // 새로 추가된 필드들에 대해서만 coordinateData에 빈 값 추가
    const newCoordinateData = { ...coordinateData };
    fields.forEach(field => {
      if (!(field.id in newCoordinateData)) {
        newCoordinateData[field.id] = field.value || '';
      }
    });
    
    // 삭제된 필드는 coordinateData에서도 제거
    const fieldIds = new Set(fields.map(f => f.id));
    Object.keys(newCoordinateData).forEach(id => {
      if (!fieldIds.has(id)) {
        delete newCoordinateData[id];
      }
    });
    
    setCoordinateData(newCoordinateData);
  };

  // 필드 선택 핸들러
  const handleFieldSelect = (field: CoordinateField | null) => {
    setSelectedCoordinateField(field);
  };

  // 선택된 필드 속성 업데이트
  const handleFieldPropertyChange = (property: keyof CoordinateField, value: any) => {
    if (!selectedCoordinateField) return;

    const updatedFields = coordinateFields.map(field => 
      field.id === selectedCoordinateField.id 
        ? { ...field, [property]: value }
        : field
    );
    
    setCoordinateFields(updatedFields);
    setSelectedCoordinateField({ ...selectedCoordinateField, [property]: value });

    // value 속성이 변경된 경우 coordinateData도 함께 업데이트
    if (property === 'value') {
      setCoordinateData(prev => ({
        ...prev,
        [selectedCoordinateField.id]: value
      }));
    }
  };

  // 현재 사용자의 검토 요청 권한 확인
  const canRequestReview = () => {
    if (!currentDocument || !currentUser) return false;
    
    // 현재 사용자의 역할 확인
    const userTask = currentDocument.tasks?.find(task => task.assignedUserEmail === currentUser.email);
    
    // 생성자 또는 편집자만 검토 요청 가능
    return userTask && (userTask.role === 'CREATOR' || userTask.role === 'EDITOR');
  };

  // 사용자 검색 함수
  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get(`http://localhost:8080/api/users/search?query=${encodeURIComponent(query)}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('사용자 검색 실패:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 검토자 추가
  const addReviewer = (user: User) => {
    if (!selectedReviewers.some(reviewer => reviewer.id === user.id)) {
      setSelectedReviewers([...selectedReviewers, user]);
    }
    setUserSearchQuery('');
    setSearchResults([]);
    setShowUserSearch(false);
  };

  // 검토 요청 핸들러
  const handleSubmitForReview = () => {
    if (!canRequestReview()) {
      alert('검토 요청 권한이 없습니다.');
      return;
    }
    
    if (selectedReviewers.length === 0) {
      alert('검토자를 추가해주세요.');
      return;
    }
    
    // 모든 검토자에게 서명 필드가 있는지 확인
    const reviewersWithoutSignature = selectedReviewers.filter(
      reviewer => !signatureFields.some(field => field.reviewerEmail === reviewer.email)
    );
    
    if (reviewersWithoutSignature.length > 0) {
      alert(`다음 검토자들의 서명 필드를 추가해주세요: ${reviewersWithoutSignature.map(r => r.name).join(', ')}`);
      return;
    }
    
    setShowReviewRequestModal(true);
  };

  // 검토 요청 실행
  const executeReviewRequest = async () => {
    if (!currentDocument || selectedReviewers.length === 0) {
      alert('검토자를 선택해주세요.');
      return;
    }

    // 사용자 권한 확인
    if (!currentUser) {
      alert('사용자 정보를 찾을 수 없습니다.');
      return;
    }

    // 현재 사용자가 생성자 또는 편집자인지 확인
    const userTask = currentDocument.tasks?.find(task => task.assignedUserEmail === currentUser.email);
    const canAssignReviewer = userTask && (userTask.role === 'CREATOR' || userTask.role === 'EDITOR');
    
    if (!canAssignReviewer) {
      alert('검토자를 할당할 권한이 없습니다. 생성자 또는 편집자만 가능합니다.');
      return;
    }

    try {
      console.log('📋 검토 요청 시작:', {
        documentId: currentDocument.id,
        currentUser: currentUser.email,
        userRole: userTask?.role,
        selectedReviewers: selectedReviewers.map(r => ({ email: r.email, name: r.name })),
        signatureFieldsCount: signatureFields.length,
        signatureFields: signatureFields
      });
      
      // 모든 검토자에게 검토 요청
      for (const reviewer of selectedReviewers) {
        await axios.post(`http://localhost:8080/api/documents/${currentDocument.id}/assign-reviewer`, {
          reviewerEmail: reviewer.email
        });
      }
      
      // 서명 필드 정보도 함께 저장
      const updatedData = {
        ...currentDocument.data,
        signatureFields: signatureFields
      };
      
      console.log('💾 서명 필드 저장 시도:', {
        originalData: currentDocument.data,
        updatedData: updatedData,
        signatureFields: signatureFields
      });
      
      await updateDocument(currentDocument.id, { data: updatedData });
      
      console.log('✅ 검토 요청 완료');
      
      alert('검토 요청이 완료되었습니다.');
      setShowReviewRequestModal(false);
      setSelectedReviewers([]);
      setSignatureFields([]);
      
      // 문서 상태 새로고침
      if (id) {
        getDocument(parseInt(id));
      }
    } catch (error) {
      console.error('❌ 검토 요청 실패:', error);
      alert('검토 요청에 실패했습니다.');
    }
  };

  const handleSave = async () => {
    if (!currentDocument) return;

    // COMPLETED 상태에서는 PDF 다운로드
    if (currentDocument.status === 'COMPLETED') {
      try {
        const token = useAuthStore.getState().token;
        const response = await axios.get(
          `http://localhost:8080/api/documents/${currentDocument.id}/download-pdf`,
          {
            responseType: 'blob',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        // PDF 파일 다운로드
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${currentDocument.templateName}_${currentDocument.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // 성공 메시지 표시
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        successDiv.textContent = '✅ PDF 다운로드가 시작되었습니다';
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
          document.body.removeChild(successDiv);
        }, 3000);
      } catch (error) {
        console.error('PDF 다운로드 실패:', error);
        alert('PDF 다운로드에 실패했습니다.');
      }
      return;
    }

    // 기존 문서 데이터 저장 로직 (EDITING 상태에서만)
    try {
      // 템플릿의 기본 필드 ID들을 가져오기
      const templateCoordinateFields = currentDocument.template?.coordinateFields ? JSON.parse(currentDocument.template.coordinateFields) : [];
      const templateFieldIds = new Set(templateCoordinateFields.map((field: any) => field.id) || []);
      
      // 사용자가 추가한 필드들만 필터링 (템플릿 필드가 아닌 것들)
      const additionalFields = coordinateFields.filter(field => !templateFieldIds.has(field.id));
      
      // 필드 정의와 데이터를 모두 저장
      const data: DocumentData = { 
        coordinateData,
        coordinateFields: additionalFields, // 사용자가 추가한 필드만 저장
        signatureFields // 서명 필드도 함께 저장
      };

      console.log('💾 저장할 데이터:', {
        templateFieldsCount: templateFieldIds.size,
        additionalFieldsCount: additionalFields.length,
        totalFieldsCount: coordinateFields.length,
        coordinateDataKeys: Object.keys(coordinateData),
        signatureFieldsCount: signatureFields.length
      });

      await updateDocument(currentDocument.id, { data });
      
      // 성공 메시지 표시
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successDiv.textContent = '✅ 저장되었습니다';
      document.body.appendChild(successDiv);
      
      setTimeout(() => {
        document.body.removeChild(successDiv);
      }, 3000);
    } catch (error) {
      alert('문서 저장에 실패했습니다.');
    }
  };

  // PDF 이미지 URL 생성
  const getPdfImageUrl = (doc: Document) => {
    console.log('🔍 PDF 이미지 URL 생성:', {
      template: doc.template,
      pdfImagePath: doc.template?.pdfImagePath
    });
    
    if (!doc.template?.pdfImagePath) {
      console.warn('⚠️ PDF 이미지 경로가 없습니다');
      return '';
    }
    
    const filename = doc.template.pdfImagePath.split('/').pop();
    const url = `http://localhost:8080/api/files/pdf-template-images/${filename}`;
    
    console.log('📄 생성된 PDF 이미지 URL:', {
      originalPath: doc.template.pdfImagePath,
      filename: filename,
      url: url
    });
    
    return url;
  };

  // 서명 필드 선택 (클릭만으로 편집 모드 진입)
  const handleSignatureFieldSelect = (signatureField: {
    id: string;
    reviewerEmail: string;
    reviewerName: string;
    x: number;
    y: number;
    width: number;
    height: number;
    signatureData?: string;
  } | null) => {
    if (signatureField) {
      setEditingSignatureField(signatureField);
      setIsSignatureFieldEditing(true); // 서명 필드 편집 모드 활성화 (문서 편집 모드와 독립적)
    } else {
      setEditingSignatureField(null);
      setIsSignatureFieldEditing(false);
    }
  };

  // 필드 생성 버튼 클릭 처리
  const handleAddField = (x: number, y: number) => {
    if (!isEditing) return;
    
    // PDF 좌표를 화면 좌표로 변환
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const screenX = x * rect.width / canvas.width;
      const screenY = y * rect.height / canvas.height;
      
      setAddFieldPosition({ x: screenX, y: screenY });
      setShowAddFieldButton(true);
    }
  };

  // 필드 생성 버튼에서 필드 추가
  const handleAddFieldFromButton = (fieldType: 'text' | 'textarea' | 'date' | 'number') => {
    if (!addFieldPosition) return;
    
    const newField: CoordinateField = {
      id: `field_${Date.now()}`,
      x: addFieldPosition.x,
      y: addFieldPosition.y,
      width: 120,
      height: 30,
      label: `${fieldType} 필드`,
      type: fieldType,
      value: '',
      fontSize: 12,
      fontColor: '#000000'
    };

    setCoordinateFields(prev => [...prev, newField]);
    setShowAddFieldButton(false);
    setAddFieldPosition(null);
  };

  // 필드 생성 버튼 숨기기
  const hideAddFieldButton = () => {
    setShowAddFieldButton(false);
    setAddFieldPosition(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">문서를 불러오는 중...</div>
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg">
        {/* 문서 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {currentDocument.templateName}
              </h1>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                <span>상태: <span className={`font-medium ${
                  currentDocument.status === 'COMPLETED' ? 'text-green-600' :
                  currentDocument.status === 'REJECTED' ? 'text-red-600' :
                  currentDocument.status === 'REVIEWING' ? 'text-blue-600' :
                  'text-yellow-600'
                }`}>{currentDocument.status}</span></span>
                <span>생성일: {new Date(currentDocument.createdAt).toLocaleDateString()}</span>
              </div>
              
              {/* 검토 준비 단계 안내 메시지 */}
              {currentDocument.status === 'READY_FOR_REVIEW' && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  �� 검토 준비 단계: 서명 필드만 편집할 수 있습니다. 검토자를 추가하고 서명 필드를 배치해주세요.
                </div>
              )}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setShowPreview(true)}
                className="btn bg-purple-600 text-white hover:bg-purple-700 text-sm"
              >
                📄 미리보기
              </button>
              
              {/* 편집/읽기 모드 토글 버튼 */}
              <button
                onClick={toggleEditingMode}
                className={`btn text-sm ${
                  isEditing 
                    ? 'bg-orange-600 text-white hover:bg-orange-700' 
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
                disabled={currentDocument.status === 'READY_FOR_REVIEW' || currentDocument.status === 'COMPLETED'}
              >
                {isEditing ? '👁️ 읽기모드로 전환' : '📝 편집모드로 전환'}
              </button>
              
              {currentDocument.status === 'EDITING' && (
                <>
                  {/* 저장 버튼은 편집모드에서만 표시 */}
                  {isEditing && (
                    <button
                      onClick={handleSave}
                      className="btn btn-primary text-sm"
                    >
                      💾 저장
                    </button>
                  )}
                  
                  {/* 편집 완료 버튼은 읽기모드에서만 표시 */}
                  {!isEditing && (
                    <button
                      onClick={handleCompleteEditing}
                      className="btn bg-green-600 text-white hover:bg-green-700 text-sm"
                    >
                      ✅ 편집 완료
                    </button>
                  )}
                </>
              )}

              {/* COMPLETED 상태에서 문서 저장 버튼 */}
              {currentDocument.status === 'COMPLETED' && (
                <button
                  onClick={handleSave}
                  className="btn btn-primary text-sm"
                >
                  📄 PDF 다운로드
                </button>
              )}
              
              {/* 검토 요청 버튼 */}
              {currentDocument && ['READY_FOR_REVIEW', 'REVIEWING'].includes(currentDocument.status) && canRequestReview() && (
                <button
                  onClick={handleSubmitForReview}
                  className="btn bg-yellow-600 text-white hover:bg-yellow-700 text-sm"
                >
                  📋 검토 요청
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 문서 내용 - PDF 뷰어 */}
        <div className="px-6 py-6">
          <div className={`grid grid-cols-1 gap-6 ${currentDocument.status === 'COMPLETED' ? '' : 'lg:grid-cols-4'}`}>
            {/* PDF 뷰어 영역 */}
            <div className={currentDocument.status === 'COMPLETED' ? 'w-full' : 'lg:col-span-3'}>
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    PDF 문서 편집
                  </h2>
                  <p className="text-sm text-gray-600 mb-2">
                    현재 상태: {currentDocument.status} | 편집 모드: {isEditing ? 'ON' : 'OFF'}
                  </p>
                  {/* <p className="text-sm text-gray-600 mb-6">
                    {isEditing 
                      ? "📝 편집모드: 드래그하여 새 필드를 생성하고, 오른쪽 패널에서 값과 속성을 편집하세요" 
                      : "👁️ 읽기모드: 필드 배경/테두리 없이 깔끔하게 값만 표시됩니다. 필드를 클릭하여 선택할 수 있습니다."
                    }
                  </p> */}
                  
                  {isEditing && coordinateFields.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        💡 현재 {coordinateFields.length}개의 필드가 있습니다. 
                        <br />• 클릭: 필드 선택
                        <br />• 드래그: 필드 이동
                        <br />• 빈 공간 클릭: 필드 생성 버튼
                        <br />• 오른쪽 하단 핸들: 크기 조절
                        <br />• 패널: 값과 속성 편집
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-center relative">
                  <PdfViewer
                    key={`pdf-viewer-${currentDocument?.id || 'no-document'}`} // 문서 ID를 key로 사용하여 문서 변경 시 컴포넌트 완전 재마운트
                    pdfImageUrl={getPdfImageUrl(currentDocument)}
                    coordinateFields={coordinateFields}
                    coordinateData={coordinateData}
                    onCoordinateFieldsChange={handleCoordinateFieldsChange}
                    editable={isEditing} // 일반 필드 편집은 문서 편집 모드에서만
                    showFieldUI={isEditing || isSignatureFieldEditing || isAddingSignatureField} // 일반 필드 UI와 서명 필드 UI는 편집 모드에서만 표시
                    scale={1}
                    selectedFieldId={selectedCoordinateField?.id || null}
                    onFieldSelect={handleFieldSelect}
                    onAddField={handleAddField}
                    isAddingSignatureField={isAddingSignatureField}
                    onSignaturePositionSelect={handleSignaturePositionSelect}
                    signatureFields={(() => {
                      // 현재 편집 중인 서명 필드들과 저장된 서명 필드들을 합침
                      const currentSignatureFields = signatureFields;
                      const savedSignatureFields = currentDocument.data?.signatureFields || [];
                      const signatures = currentDocument.data?.signatures || {};
                      
                      console.log('📄 서명 필드 데이터 로드:', {
                        currentSignatureFields: currentSignatureFields.length,
                        savedSignatureFields: savedSignatureFields.length,
                        signatures: Object.keys(signatures),
                        currentDocumentData: currentDocument.data
                      });
                      
                      // 현재 편집 중인 서명 필드들을 우선으로 하고, 저장된 서명 필드들을 추가
                      const allSignatureFields = [...currentSignatureFields];
                      
                      // 저장된 서명 필드 중에서 현재 편집 중이 아닌 것들만 추가
                      savedSignatureFields.forEach(savedField => {
                        const isCurrentlyEditing = currentSignatureFields.some(
                          currentField => currentField.reviewerEmail === savedField.reviewerEmail
                        );
                        
                        if (!isCurrentlyEditing) {
                          const signatureData = signatures[savedField.reviewerEmail];
                          console.log(`📄 서명 필드 추가: ${savedField.reviewerName}`, {
                            reviewerEmail: savedField.reviewerEmail,
                            hasSignatureData: !!signatureData,
                            signatureDataLength: signatureData?.length || 0
                          });
                          
                          allSignatureFields.push({
                            ...savedField,
                            signatureData: signatureData
                          });
                        }
                      });
                      
                      console.log('📄 최종 서명 필드 목록:', allSignatureFields.map(f => ({
                        id: f.id,
                        reviewerName: f.reviewerName,
                        reviewerEmail: f.reviewerEmail,
                        hasSignatureData: !!f.signatureData
                      })));
                      
                      return allSignatureFields;
                    })()}
                    editingSignatureFieldId={editingSignatureField?.id || null}
                    onSignatureFieldUpdate={updateSignatureField}
                    onSignatureFieldSelect={handleSignatureFieldSelect}
                  />
                  
                  {/* 필드 생성 버튼 */}
                  {showAddFieldButton && addFieldPosition && (
                    <div 
                      className="absolute z-10 bg-white border border-gray-300 rounded-lg shadow-lg p-2"
                      style={{
                        left: `${addFieldPosition.x}px`,
                        top: `${addFieldPosition.y}px`,
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'auto'
                      }}
                    >
                      <div className="text-xs text-gray-600 mb-2 text-center">필드 추가</div>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => handleAddFieldFromButton('text')}
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          텍스트
                        </button>
                        <button
                          onClick={() => handleAddFieldFromButton('textarea')}
                          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          텍스트영역
                        </button>
                        <button
                          onClick={() => handleAddFieldFromButton('date')}
                          className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
                        >
                          날짜
                        </button>
                        <button
                          onClick={() => handleAddFieldFromButton('number')}
                          className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                        >
                          숫자
                        </button>
                      </div>
                      <button
                        onClick={hideAddFieldButton}
                        className="w-full mt-1 px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 속성 편집 패널 */}
            {currentDocument.status !== 'COMPLETED' && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-lg border">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">
                      🎨 필드 속성
                    </h3>
                  </div>

                  <div className="p-4">
                    {selectedCoordinateField ? (
                      <FieldPropertiesPanel
                        field={selectedCoordinateField}
                        onPropertyChange={handleFieldPropertyChange}
                        onDeleteField={() => {
                          const updatedFields = coordinateFields.filter(f => f.id !== selectedCoordinateField.id);
                          setCoordinateFields(updatedFields);
                          setSelectedCoordinateField(null);
                          
                          // coordinateData에서도 제거
                          const updatedData = { ...coordinateData };
                          delete updatedData[selectedCoordinateField.id];
                          setCoordinateData(updatedData);
                        }}
                        disabled={!isEditing}
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-4xl mb-2">👆</div>
                        <p className="text-sm">
                          필드를 선택하면<br />
                          속성을 편집할 수 있습니다
                        </p>
                        {!isEditing && (
                          <p className="text-xs text-gray-400 mt-2">
                            편집 모드에서만 속성 변경 가능
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 미리보기 모달 */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">📄 문서 미리보기</h2>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowPreview(false)}
                  className="btn btn-primary text-sm"
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="p-8">
              <div className="flex justify-center">
                <PdfViewer
                  pdfImageUrl={getPdfImageUrl(currentDocument)}
                  coordinateFields={coordinateFields}
                  onCoordinateFieldsChange={() => {}}
                  editable={false}
                  showFieldUI={false} // 미리보기에서는 일반 필드 UI 숨김
                  scale={1}
                  signatureFields={(() => {
                    const signatureFields = currentDocument.data?.signatureFields || [];
                    const signatures = currentDocument.data?.signatures || {};
                    
                    return signatureFields.map(field => ({
                      ...field,
                      signatureData: signatures[field.reviewerEmail]
                    }));
                  })()}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 검토자 관리 섹션 (READY_FOR_REVIEW 상태일 때만 표시) */}
      {currentDocument?.status === 'READY_FOR_REVIEW' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 검토자 관리</h3>
          
          {/* 선택된 검토자들 */}
          {selectedReviewers.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">선택된 검토자</h4>
              <div className="space-y-3">
                {selectedReviewers.map((reviewer) => {
                  const hasSignatureField = signatureFields.some(field => field.reviewerEmail === reviewer.email);
                  return (
                    <div key={reviewer.id} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">{reviewer.name.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="font-medium text-blue-800">{reviewer.name}</div>
                          <div className="text-sm text-blue-600">{reviewer.email}</div>
                          <div className="text-xs text-blue-500">{reviewer.position}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {hasSignatureField ? (
                          <>
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              ✅ 서명 필드 추가됨
                            </span>
                            <button
                              onClick={() => startSignatureFieldEdit(signatureFields.find(f => f.reviewerEmail === reviewer.email)!)}
                              className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                            >
                              ✏️ 편집
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startSignatureFieldAddition(reviewer)}
                            className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                          >
                            ✍️ 서명 필드 추가
                          </button>
                        )}
                        <button
                          onClick={() => removeReviewer(reviewer.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 검토자 검색 */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">검토자 추가</h4>
            <div className="relative">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  if (e.target.value.length >= 2) {
                    searchUsers(e.target.value);
                  } else {
                    setSearchResults([]);
                  }
                }}
                placeholder="이름 또는 이메일로 검색하세요 (2글자 이상)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {/* 검색 결과 드롭다운 */}
              {userSearchQuery.length >= 2 && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-3 text-center text-gray-500">
                      <div className="animate-spin inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
                      검색 중...
                    </div>
                  ) : (
                    searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => addReviewer(user)}
                        disabled={selectedReviewers.some(reviewer => reviewer.id === user.id)}
                        className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="font-medium text-gray-800">{user.name}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                        <div className="text-xs text-gray-500">{user.position}</div>
                        {selectedReviewers.some(reviewer => reviewer.id === user.id) && (
                          <div className="text-xs text-blue-600 mt-1">✓ 이미 선택됨</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 검토 요청 버튼 */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmitForReview}
              disabled={selectedReviewers.length === 0 || 
                selectedReviewers.some(reviewer => 
                  !signatureFields.some(field => field.reviewerEmail === reviewer.email)
                )}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              📋 검토 요청
            </button>
          </div>

          {/* 서명 필드 편집 완료 버튼 */}
          {editingSignatureField && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">
                    ✏️ {editingSignatureField.reviewerName} 서명 필드 편집 중
                  </h4>
                  <p className="text-xs text-yellow-600 mt-1">
                    PDF에서 서명 필드를 드래그하여 위치를 조정하거나, 우하단 핸들을 드래그하여 크기를 조정하세요.
                  </p>
                </div>
                <button
                  onClick={finishSignatureFieldEdit}
                  className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 text-sm"
                >
                  완료
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 검토 요청 확인 모달 */}
      {showReviewRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📋 검토 요청 확인</h2>
              <p className="text-gray-600 mb-6">
                선택된 {selectedReviewers.length}명의 검토자에게 검토를 요청하시겠습니까?
              </p>
              
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">검토자 목록:</h3>
                <div className="space-y-2">
                  {selectedReviewers.map((reviewer) => (
                    <div key={reviewer.id} className="flex items-center space-x-2 text-sm">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="font-medium">{reviewer.name}</span>
                      <span className="text-gray-500">({reviewer.email})</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowReviewRequestModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={executeReviewRequest}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 필드 속성 편집 패넌트 컴포넌트
interface FieldPropertiesPanelProps {
  field: CoordinateField;
  onPropertyChange: (property: keyof CoordinateField, value: any) => void;
  onDeleteField: () => void;
  disabled?: boolean;
}

const FieldPropertiesPanel: React.FC<FieldPropertiesPanelProps> = ({
  field,
  onPropertyChange,
  onDeleteField,
  disabled = false
}) => {
  return (
    <div className="space-y-6">
      {/* 라벨 이름 */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          📝 라벨 이름
        </label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => onPropertyChange('label', e.target.value)}
          disabled={disabled}
          placeholder="필드 라벨을 입력하세요"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
      </div>

      {/* 값 내용 */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          ✏️ 값 내용
        </label>
        <textarea
          value={field.value || ''}
          onChange={(e) => onPropertyChange('value', e.target.value)}
          disabled={disabled}
          placeholder="필드에 표시될 값을 입력하세요"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 resize-none"
        />
      </div>

      {/* 위치 및 크기 */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-3">
          📐 위치 및 크기
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">X 좌표</label>
            <input
              type="number"
              value={Math.round(field.x)}
              onChange={(e) => onPropertyChange('x', Number(e.target.value))}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Y 좌표</label>
            <input
              type="number"
              value={Math.round(field.y)}
              onChange={(e) => onPropertyChange('y', Number(e.target.value))}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">너비</label>
            <input
              type="number"
              value={Math.round(field.width)}
              onChange={(e) => onPropertyChange('width', Math.max(30, Number(e.target.value)))}
              disabled={disabled}
              min="30"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">높이</label>
            <input
              type="number"
              value={Math.round(field.height)}
              onChange={(e) => onPropertyChange('height', Math.max(20, Number(e.target.value)))}
              disabled={disabled}
              min="20"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 글자 크기 */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          🔠 글자 크기: {field.fontSize || 12}px
        </label>
        <div className="space-y-2">
          <input
            type="range"
            min="8"
            max="60"
            value={field.fontSize || 12}
            onChange={(e) => onPropertyChange('fontSize', Number(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>8px</span>
            <span>60px</span>
          </div>
        </div>
      </div>

      {/* 글자 색상 */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          🎨 글자 색상
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="color"
            value={field.fontColor || '#1F2937'}
            onChange={(e) => onPropertyChange('fontColor', e.target.value)}
            disabled={disabled}
            className="w-12 h-12 border-2 border-gray-300 rounded-lg cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex-1">
            <input
              type="text"
              value={field.fontColor || '#1F2937'}
              onChange={(e) => onPropertyChange('fontColor', e.target.value)}
              disabled={disabled}
              placeholder="#1F2937"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* 삭제 버튼 */}
      {!disabled && (
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={onDeleteField}
            className="w-full px-4 py-3 text-red-600 border-2 border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400 transition-all duration-200 font-medium"
          >
            🗑️ 필드 삭제
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentEditor; 