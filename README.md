# Deb's (Detection Earthquake Building System)

© AIRX (individual business). All rights reserved.

## 왜 Render에서 “현장 등록 후 사라짐”이 생기나

Render는 서비스가 재시작(재배포/슬립 해제 등)될 때 서버 메모리와 로컬 파일이 초기화될 수 있습니다.
따라서 **JSON 파일 저장만으로는** 현장 데이터가 유지되지 않습니다.

이 프로젝트는 아래 방식으로 해결했습니다:

- `DATABASE_URL` 환경변수가 있으면 **PostgreSQL(권장)** 사용
- 없으면 로컬 개발용으로만 JSON 저장(주의: Render에서는 날아갈 수 있음)

## 로컬 실행

```bash
npm install
npm start
```

기본 포트: `4000`

## 기본 관리자 계정

- ID: `operator`
- PW: `beds2025!`

## Render 배포 (현장 데이터 유지하려면 필수)

1) Render에서 PostgreSQL 생성
2) Web Service 환경변수에 `DATABASE_URL` 추가
3) 재배포

서버 부팅 시 자동으로 테이블을 생성하고(마이그레이션), 샘플 현장/관리자 계정을 시드합니다.

## API

- Health: `GET /api/health`
- 로그인: `POST /api/login`
- 현장 목록: `GET /api/sites`
- 현장 등록: `POST /api/sites`
- 현장 수정: `PUT /api/sites/:id`
- 현장 삭제: `DELETE /api/sites/:id`
- 고객 계정 목록: `GET /api/users`
- 고객 계정 생성: `POST /api/users`
- 고객 계정 삭제: `DELETE /api/users/:id`
- 고객 계정 현장 할당: `PUT /api/users/:id/sites`
