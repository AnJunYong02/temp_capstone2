import { create } from 'zustand';
import axios from 'axios';

export interface DocumentData {
  // 기본 필드
  title?: string;
  content?: string;
  createdAt?: string;
  signatures?: Record<string, string>; // 검토자별 서명 데이터 (email -> base64)
  // 필드 정의와 데이터
  coordinateFields?: any[]; // 사용자가 추가한 필드들
  signatureFields?: any[]; // 서명 필드들
}

export interface TaskInfo {
  id: number;
  role: string;
  assignedUserName: string;
  assignedUserEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateInfo {
  id: number;
  name: string;
  description?: string;
  isPublic?: boolean;
  pdfFilePath?: string;
  pdfImagePath?: string;
  coordinateFields?: string; // JSON 형태로 저장된 좌표 필드 정보
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: number;
  templateId: number;
  templateName?: string;
  data?: DocumentData;
  status: 'DRAFT' | 'EDITING' | 'READY_FOR_REVIEW' | 'REVIEWING' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  tasks?: TaskInfo[];
  template?: TemplateInfo;
}

export interface DocumentCreateRequest {
  templateId: number;
  editorEmail?: string;
}

export interface DocumentUpdateRequest {
  data: DocumentData;
}

interface DocumentStore {
  documents: Document[];
  currentDocument: Document | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchDocuments: () => Promise<void>;
  createDocument: (request: DocumentCreateRequest) => Promise<Document>;
  getDocument: (id: number) => Promise<Document>;
  updateDocument: (id: number, request: DocumentUpdateRequest) => Promise<Document>;
  submitForReview: (id: number) => Promise<Document>;
  assignEditor: (id: number, editorEmail: string) => Promise<Document>;
  assignReviewer: (id: number, reviewerEmail: string) => Promise<Document>;
  downloadPdf: (id: number) => Promise<void>;
  setCurrentDocument: (document: Document | null) => void;
  clearCurrentDocument: () => void;
  clearError: () => void;
}

const API_BASE_URL = 'http://localhost:8080/api';

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  currentDocument: null,
  loading: false,
  error: null,

  fetchDocuments: async () => {
    set({ loading: true, error: null });
    try {
      console.log('DocumentStore: Fetching documents...');
      console.log('DocumentStore: Current axios headers:', axios.defaults.headers.common);
      
      const response = await axios.get(`${API_BASE_URL}/documents`);
      console.log('DocumentStore: Documents fetched successfully:', response.data);
      set({ documents: response.data, loading: false });
    } catch (error: any) {
      console.error('DocumentStore: Error fetching documents:', error);
      console.error('DocumentStore: Error response:', error.response?.data);
      set({ error: '문서를 불러오는데 실패했습니다.', loading: false });
    }
  },

  createDocument: async (request: DocumentCreateRequest) => {
    set({ loading: true, error: null });
    try {
      console.log('DocumentStore: Creating document with headers:', axios.defaults.headers.common);
      const response = await axios.post(`${API_BASE_URL}/documents`, request);
      const newDocument = response.data;
      set((state) => ({
        documents: [newDocument, ...state.documents],
        loading: false,
      }));
      return newDocument;
    } catch (error) {
      console.error('DocumentStore: Create document error:', error);
      set({ error: '문서 생성에 실패했습니다.', loading: false });
      throw error;
    }
  },

  getDocument: async (id: number): Promise<Document> => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`${API_BASE_URL}/documents/${id}`);
      const document = response.data;
      set({ currentDocument: document, loading: false });
      return document;
    } catch (error) {
      set({ error: '문서를 불러오는데 실패했습니다.', loading: false });
      throw error;
    }
  },

  updateDocument: async (id: number, request: DocumentUpdateRequest) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.put(`${API_BASE_URL}/documents/${id}`, request);
      const updatedDocument = response.data;
      
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? updatedDocument : doc
        ),
        currentDocument: state.currentDocument?.id === id ? updatedDocument : state.currentDocument,
        loading: false,
      }));
      
      return updatedDocument;
    } catch (error: any) {
      console.error('DocumentStore: Update error:', error);
      console.error('DocumentStore: Update response:', error.response?.data);
      set({ error: '문서 수정에 실패했습니다.', loading: false });
      throw error;
    }
  },

  submitForReview: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/documents/${id}/submit-for-review`);
      const updatedDocument = response.data;
      
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? updatedDocument : doc
        ),
        currentDocument: state.currentDocument?.id === id ? updatedDocument : state.currentDocument,
        loading: false,
      }));
      
      return updatedDocument;
    } catch (error: any) {
      console.error('DocumentStore: Submit for review error:', error);
      console.error('DocumentStore: Submit for review response:', error.response?.data);
      set({ error: '검토 요청에 실패했습니다.', loading: false });
      throw error;
    }
  },

  assignEditor: async (id: number, editorEmail: string) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/documents/${id}/assign-editor`, {
        editorEmail
      });
      const updatedDocument = response.data;
      
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? updatedDocument : doc
        ),
        currentDocument: state.currentDocument?.id === id ? updatedDocument : state.currentDocument,
        loading: false,
      }));
      
      return updatedDocument;
    } catch (error) {
      set({ error: '편집자 할당에 실패했습니다.', loading: false });
      throw error;
    }
  },

  assignReviewer: async (id: number, reviewerEmail: string) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/documents/${id}/assign-reviewer`, {
        reviewerEmail
      });
      const updatedDocument = response.data;
      
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? updatedDocument : doc
        ),
        currentDocument: state.currentDocument?.id === id ? updatedDocument : state.currentDocument,
        loading: false,
      }));
      
      return updatedDocument;
    } catch (error) {
      set({ error: '검토자 할당에 실패했습니다.', loading: false });
      throw error;
    }
  },

  downloadPdf: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`${API_BASE_URL}/documents/${id}/download-pdf`, {
        responseType: 'blob'
      });
      
      // PDF 파일 다운로드
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `document_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      set({ loading: false });
    } catch (error: any) {
      console.error('DocumentStore: Download PDF error:', error);
      console.error('DocumentStore: Download PDF response:', error.response?.data);
      set({ error: 'PDF 다운로드에 실패했습니다.', loading: false });
      throw error;
    }
  },

  setCurrentDocument: (document: Document | null) => {
    set({ currentDocument: document });
  },

  clearCurrentDocument: () => {
    set({ currentDocument: null });
  },

  clearError: () => {
    set({ error: null });
  },
})); 