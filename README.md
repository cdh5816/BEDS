
# BEDS v2 - Building Earthquake Detection System

© AIRX (individual business) - All rights reserved.

이 패키지는 형님이 말한 BEDS v2의 기본 웹 구조입니다.

- 공개 지도: BEDS가 관리하는 모든 현장 공개 표시
- 관리자 로그인(admin@beds.local / bedsadmin123!): 현장 등록 + 좌표 입력 + 카카오 주소 검색 버튼
- 고객 로그인(customer@beds.local / bedscustomer123!): 자기 현장 목록 + 실시간 상태(폴링) 조회
- 센서 데이터 수집 API: `/api/sensors/ingest` (ESP에서 HTTP로 쏘면 DB에 쌓임)
