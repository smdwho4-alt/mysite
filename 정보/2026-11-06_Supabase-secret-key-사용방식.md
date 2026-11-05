# Supabase `sb_secret_` 키로 Auth 관리 API 호출하는 방식 (2026-11-06 조사)

## 결론
- `sb_secret_...` 형식의 Secret Key는 JWT가 아니므로 **`apikey` 헤더에만** 넣어 보내는 것이 공식 안내다.
  `Authorization: Bearer` 로는 보내지 않는다. (예전 `service_role` 키는 JWT라서 두 헤더 모두 쓰는 방식이 있었다)
- 이 프로젝트의 `reset-admin-password-dev.ps1` 은 `apikey` 헤더만 사용한다 → 공식 안내와 일치.
- 이 프로젝트의 개발 DB에서 `GET /auth/v1/admin/users` 를 `apikey` 만으로 호출했을 때 HTTP 200 이었다 (직접 확인, 2026-11-05~06).
- `PUT /auth/v1/admin/users/{uid}` (비밀번호 변경)를 `apikey` 만으로 보냈을 때의 동작은 아직 **실제로 실행해 보지 않았다 (미검증)**.

## 출처별 내용 (서로 다른 내용은 따로 적음)
1. 공식 문서 — API keys: 공개키(publishable)와 비밀키(secret)는 JWT가 아니며 `apikey` 헤더에 보낸다.
   Authorization: Bearer 로 보내면 JWT 검증에 실패한다고 안내.
   https://supabase.com/docs/guides/getting-started/api-keys
2. 공식 GitHub 토론 — Supabase API 키 변경 예고(새 키 형식 도입 배경)
   https://github.com/orgs/supabase/discussions/29260
3. 사용자 저장소의 수정 사례(공식 아님, 참고): Auth 관리 API 사용자 목록 조회를 `sb_secret` + `apikey` 만으로 호출하면 200,
   키 없이 호출하면 401 이었다는 보고. Bearer 로 보내면 "Invalid JWT" 로 거부되었다는 보고도 있음.
   - https://github.com/nfredmond/openplan/pull/370
   - https://github.com/crallbkk/Klear-medusa/pull/22
   - https://github.com/peterlee01/credentialai/pull/24
4. **다른 내용(표시):** 일부 사례(저장소 PR)에서는 "supabase-js 가 REST/Storage 호출에서 `apikey` 와 함께 `Authorization: Bearer <sb_secret>` 도 보낸다"고 적혀 있어,
   공식 문서의 "apikey 에만"과 다르다. 호스팅 프로젝트에서 직접 확인하라는 권고가 함께 있었다.
   - https://github.com/IlianP/Queens-clone/pull/69
   - https://github.com/supabase/supabase-csharp/issues/279

## 추가 발견: 브라우저처럼 보이는 User-Agent 는 Secret Key 가 거부됨 (직접 확인 + 출처)
- 직접 확인(개발 DB, 읽기 GET): 같은 키·같은 주소로 `curl.exe` → 200, PowerShell `Invoke-WebRequest` 기본값 → **401**.
  User-Agent 를 `lsh-calss-admin-script/1.0` 으로 바꾸면 200, `Mozilla/5.0 test` 로 바꾸면 401. (원인 = User-Agent)
- PowerShell 기본 User-Agent 는 `Mozilla/5.0 ... WindowsPowerShell/5.1` 로 시작해 브라우저로 판단됨.
- 공식 문서(API keys): 비밀키는 브라우저에서 쓸 수 없으며 User-Agent 로 판단해 401 을 돌려준다고 안내. 단, 이는 보안 경계가 아니므로 유출된 키는 교체해야 한다.
  https://supabase.com/docs/guides/getting-started/api-keys
- 참고 사례(공식 아님): PowerShell/HTTP 클라이언트의 기본 User-Agent 때문에 401 이 났고, 비브라우저 User-Agent 를 명시해 해결했다는 PR 들
  - https://github.com/nivedhitha97/SmartMealPlanner/pull/19
  - https://github.com/rodzmodzllc-max/taxdeed-scraper/pull/8
- 적용: `reset-admin-password-dev.ps1` 의 모든 Auth 관리 API 호출에 `-UserAgent 'lsh-calss-admin-script/1.0'` 을 명시.
- 참고(다른 내용): 공식 문서는 2026년 말까지 anon / service_role 키를 단계적으로 폐지한다고 안내(검색 결과 요약 기준, 상세 일정은 문서 확인 필요).

## 이 프로젝트에 적용
- Auth 관리 API 호출(`PUT /auth/v1/admin/users/{uid}`)은 `apikey` 헤더만 사용한다.
- 만약 비밀번호 변경이 401/403 으로 거부되면, 그때 원인을 분석한다 (키를 Bearer 로 같이 보내는 것은 공식 안내와 다르므로 임의로 바꾸지 않는다).
