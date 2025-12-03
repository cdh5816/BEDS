
# BEDS v2 - Building Earthquake Detection System

© AIRX (individual business) - All rights reserved.

이 패키지는 형님용 BEDS v2 웹 기본 구조입니다.

- 공개 지도: 모든 현장 위치 + 안전/주의/경고/신호끊김 상태 공개 표시
- 관리자 로그인(admin@beds.local / bedsadmin123!):
  - 주소 입력 → 카카오 REST API로 위/경도 자동 계산
  - 센서 설치 개수 / 건물 규모 / 준공 연도 / 메모 입력
- 고객 로그인(customer@beds.local / bedscustomer123!):
  - 자기 현장 선택 → 현재 상태 뱃지 + 센서 개수 + 흔들림/휨 + 최근 타임라인
- 센서 데이터 수집 API: `/api/sensors/ingest`
