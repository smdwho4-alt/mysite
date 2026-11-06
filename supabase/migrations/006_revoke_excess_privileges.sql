-- ============================================================================
--  006. items / site_texts 의 과다 권한 회수 (004 보완 — 기본 권한이 넓게 붙어 있는 「운영」 프로젝트용)
--
--  왜 필요한가
--   · 운영 프로젝트(오래된 프로젝트)는 SQL 로 만든 표에 anon / authenticated 에게 모든 권한
--     (INSERT·UPDATE·DELETE·TRUNCATE·REFERENCES·TRIGGER)이 자동으로 붙어 있습니다. (운영 인벤토리 확인)
--   · 지금은 RLS 에 쓰기 정책이 없어 막혀 있지만, 권한 자체가 남아 있으면 방어선이 RLS 하나뿐입니다.
--     (TRUNCATE 는 RLS 를 거치지 않는 권한이고, 회원가입이 열려 있으면 가입자도 authenticated 가 됩니다.)
--   · 004 는 권한을 「추가」만 하므로 이 과다 권한을 줄이지 못합니다. 이 파일이 그 부분만 줄입니다.
--
--  앱이 실제로 쓰는 권한 (코드 확인: lib/data.ts, lib/admin-card-deps.ts, app/admin/*)
--   · 방문자(anon)·로그인 사용자(authenticated) : items, site_texts 「읽기(SELECT)」만
--   · 서버 비밀 키(service_role) : items 읽기·추가·수정·삭제 / site_texts 읽기·저장(upsert)
--
--  하는 일 (이 파일은 권한 「회수」만 합니다. 데이터·정책·표 구조는 바꾸지 않음)
--   ① anon, authenticated : items, site_texts 의 SELECT 를 뺀 모든 권한 회수
--   ② service_role        : TRUNCATE·REFERENCES·TRIGGER 회수, site_texts 의 DELETE 회수 (앱이 쓰지 않음)
--
--  안전장치
--   · 전체가 하나의 트랜잭션이며, 끝의 자가 점검이 하나라도 어긋나면 오류로 멈추고 전부 자동 취소됩니다.
--   · 여러 번 실행해도 안전합니다. (이미 회수된 권한은 아무 일도 일어나지 않음)
--
--  실행 순서 : schema.sql → 001 → 002 → (003 은 운영에서 실행하지 않음) → 004 → 005 → 006
--  ⚠ 운영 DB 는 별도 승인 후에만. 개발 DB 에서는 이미 최소 권한이라 아무 변화가 없습니다.
--  권한 복구(되돌리기, 권장하지 않음 — 운영의 원래 「넓은 권한」 상태로 정확히 복귀. 로컬 엔진에서 006 적용 전 상태와 일치함을 확인):
--     grant insert, update, delete, truncate, references, trigger on public.items, public.site_texts to anon, authenticated;
--     grant truncate, references, trigger on public.items, public.site_texts to service_role;
--     grant delete on public.site_texts to service_role;
-- ============================================================================

begin;

-- 0) 선행 확인
do $$
begin
  if to_regclass('public.items') is null or to_regclass('public.site_texts') is null then
    raise exception '먼저 supabase/schema.sql 을 실행하세요 (public.items / public.site_texts 가 없습니다)';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception '먼저 001~005 를 실행하세요 (public.is_admin() 가 없습니다)';
  end if;
end $$;

-- 1) 방문자·로그인 사용자: 읽기만 남기고 회수
revoke insert, update, delete, truncate, references, trigger
  on public.items, public.site_texts
  from anon, authenticated;

-- 2) 서버 비밀 키: 앱이 쓰지 않는 권한 회수 (읽기·추가·수정·삭제 등 앱 동작에 필요한 권한은 그대로)
revoke truncate, references, trigger
  on public.items, public.site_texts
  from service_role;

revoke delete on public.site_texts from service_role;

-- 3) 자가 점검: 하나라도 어긋나면 오류로 멈추고 전체가 자동 취소됩니다.
do $$
declare
  r record;
begin
  -- 3-1) RLS 는 계속 켜져 있어야 함
  if exists (
    select 1 from pg_class
    where oid in ('public.items'::regclass, 'public.site_texts'::regclass) and not relrowsecurity
  ) then
    raise exception '점검 실패: RLS 가 꺼져 있습니다';
  end if;

  -- 3-2) anon / authenticated : SELECT 만 있어야 함
  for r in
    select t.tbl, ro.rn, p.priv
    from (values ('items'), ('site_texts')) t(tbl)
    cross join (values ('anon'), ('authenticated')) ro(rn)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
    where has_table_privilege(ro.rn::name, 'public.' || t.tbl, p.priv)
       or (p.priv in ('INSERT', 'UPDATE', 'REFERENCES') and has_any_column_privilege(ro.rn::name, 'public.' || t.tbl, p.priv))
  loop
    raise exception '점검 실패: % 가 public.% 에 % 권한을 아직 가지고 있습니다', r.rn, r.tbl, r.priv;
  end loop;

  if not has_table_privilege('anon', 'public.items', 'SELECT')
     or not has_table_privilege('anon', 'public.site_texts', 'SELECT')
     or not has_table_privilege('authenticated', 'public.items', 'SELECT')
     or not has_table_privilege('authenticated', 'public.site_texts', 'SELECT') then
    raise exception '점검 실패: anon / authenticated 의 읽기(SELECT) 권한이 없습니다 (공개 홈페이지가 멈춥니다)';
  end if;

  -- 3-3) service_role : 앱이 쓰는 권한은 남아 있어야 하고, 불필요한 권한은 없어야 함
  if not has_table_privilege('service_role', 'public.items', 'SELECT')
     or not has_table_privilege('service_role', 'public.items', 'DELETE')
     or not has_any_column_privilege('service_role', 'public.items', 'INSERT')
     or not has_any_column_privilege('service_role', 'public.items', 'UPDATE')
     or not has_table_privilege('service_role', 'public.site_texts', 'SELECT')
     or not has_any_column_privilege('service_role', 'public.site_texts', 'INSERT')
     or not has_any_column_privilege('service_role', 'public.site_texts', 'UPDATE') then
    raise exception '점검 실패: service_role 에 앱이 쓰는 권한이 부족합니다 (관리자 저장이 멈춥니다)';
  end if;

  if has_table_privilege('service_role', 'public.items', 'TRUNCATE')
     or has_table_privilege('service_role', 'public.site_texts', 'TRUNCATE')
     or has_table_privilege('service_role', 'public.site_texts', 'DELETE') then
    raise exception '점검 실패: service_role 의 불필요한 권한이 남아 있습니다';
  end if;

  raise notice '006 완료: items / site_texts 가 최소 권한 상태입니다.';
end $$;

commit;

-- ----------------------------------------------------------------------------
--  적용 후 확인 (읽기만 하는 조회 · 따로 실행). 기대: anon / authenticated 는 sel 만 t, service_role 은 아래 표대로.
--
--  select t.tbl as "표", r.rn as "역할",
--         has_table_privilege(r.rn::name, 'public.' || t.tbl, 'SELECT')   as sel,
--         has_table_privilege(r.rn::name, 'public.' || t.tbl, 'INSERT')   as ins_tbl,
--         has_table_privilege(r.rn::name, 'public.' || t.tbl, 'UPDATE')   as upd_tbl,
--         has_table_privilege(r.rn::name, 'public.' || t.tbl, 'DELETE')   as del,
--         has_table_privilege(r.rn::name, 'public.' || t.tbl, 'TRUNCATE') as trunc
--    from (values ('items'), ('site_texts')) t(tbl)
--   cross join (values ('anon'), ('authenticated'), ('service_role')) r(rn)
--   order by 1, 2;
--
--  기대 결과
--   items      : anon / authenticated → sel=t, 나머지 f
--                service_role         → sel=t, ins_tbl=t, upd_tbl=t, del=t, trunc=f
--   site_texts : anon / authenticated → sel=t, 나머지 f
--                service_role         → sel=t, ins_tbl=t, upd_tbl=t, del=f,  trunc=f
--  (service_role 의 ins_tbl / upd_tbl 은 운영 기본 권한이 표 단위로 붙어 있어 t 로 남습니다. 앱 동작에는 영향 없음)
--  이어서 데이터 지문(② 쿼리)이 백업 기준선과 같은지 확인:
--   items 3건 ab879b179473d7d26cd91aac025cfb46 / site_texts 5건 395bf26baf16a13d6baa38eba2686fda
-- ----------------------------------------------------------------------------
