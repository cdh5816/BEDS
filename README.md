# BEDS - Building Earthquake Detection System

© AIRX (individual business) - All rights reserved.

간단하게 띄울 수 있는 BEDS(건물 지진 감지 웹) 서버입니다.

## 기능 요약

- 상단 좌측 `BEDS` 로고, 우측 `로그인` / `로그아웃` 버튼
- 첫 화면: 대한민국 지도 + BEDS가 모니터링 중인 건물 마커 표시 (누구나 열람 가능)
- 관리자 로그인 후:
  - 건물(이름, 주소, 좌표) 등록
  - 등록된 건물은 곧바로 첫 화면 지도에 마커로 표시됨

## 기술 스택

- Node.js + Express
- 파일 기반 JSON DB (`data/db.json`)
- 정적 프론트: HTML + CSS + JS
- 지도: Leaflet + OpenStreetMap

## 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 서버 실행
npm start
```

기본 포트는 `4000`입니다.  
브라우저에서 `http://localhost:4000` 접속.

### 환경 변수(선택)

`.env` 파일을 루트에 만들 수 있습니다.

```env
PORT=4000
JWT_SECRET=아무_랜덤_문자열
```

지정하지 않으면 기본값:

- `PORT=4000`
- `JWT_SECRET=beds-dev-secret`

## 기본 관리자 계정

서버가 처음 실행될 때 `data/db.json`이 없으면 자동 생성됩니다.

- 이메일: `admin@beds.local`
- 비밀번호: `bedsadmin123!`

로그인 후 화면 아래쪽 관리자 패널에서 건물을 등록할 수 있습니다.

## 구조

```text
BEDS/
  server.js        # Express 서버
  db.js            # JSON 파일 기반 DB 유틸
  package.json
  data/
    db.json        # 최초 실행 시 자동 생성/초기화
  public/
    index.html     # 메인 화면
    style.css      # 다크 그린 테마 스타일
    app.js         # 프론트 로직
```

## 배포 / GitHub

1. 이 폴더 전체를 압축(zip)해서 GitHub에 업로드
2. 서버는 Node.js가 설치된 환경에서 `npm install && npm start`
3. Reverse proxy(Nginx 등) 붙여서 도메인 연결하면 바로 서비스 가능

---

이 버전은 **MVP**로, 추후에 다음 기능을 추가하기 쉬운 구조입니다.

- 센서 측 API (`/api/sensors/...`)
- 측정값/알람 DB 테이블
- 다국어 지원
- 지진 알림(문자/카톡) 연동 등