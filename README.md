# HisWork

온라인 문서 협업 플랫폼입니다. 대학이나 조직에서 사용하는 근무 일지 같은 문서를 템플릿 기반으로 작성하고, 편집하고, 검토/결재하는 과정을 디지털화할 수 있습니다.

## 주요 기능

- **템플릿 관리**: 드래그 앤 드롭으로 필드를 배치하고 다양한 타입(텍스트, 날짜, 서명 등) 지원
- **역할 기반 워크플로우**: 생성자 → 편집자 → 검토자 순서로 문서 처리
- **실시간 편집**: 동시 편집 충돌 방지 및 변경 이력 추적
- **PDF 출력**: 완성된 문서를 PDF로 변환하여 다운로드

## 기술 스택

**백엔드**
- Spring Boot 3.2.3
- PostgreSQL
- Spring Security
- iText PDF

**프론트엔드**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand

## 시작하기

### 필요 조건
- Java 17+
- Node.js 18+
- PostgreSQL 15+

### 실행 방법

1. **저장소 클론**
   ```bash
   git clone <repository-url>
   cd hiswork
   ```

2. **데이터베이스 실행**
   ```bash
   docker-compose up postgres -d
   ```

3. **백엔드 실행**
   ```bash
   cd backend
   ./gradlew bootRun
   ```

4. **프론트엔드 실행**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **브라우저에서 확인**
   - 프론트엔드: http://localhost:5173
   - 백엔드 API: http://localhost:8080/api

### Docker로 전체 실행
```bash
docker-compose up --build
```

## 프로젝트 구조

```
hiswork/
├── backend/          # Spring Boot 백엔드
├── frontend/         # React 프론트엔드
└── docker-compose.yml
```
