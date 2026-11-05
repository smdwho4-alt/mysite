-- ============================================================================
--  005. 관리자 보안 개선 (Supabase Security Advisor 권고안 2)
--
--  하는 일 (이 파일에서 바꾸는 것은 딱 4가지)
--   ① public.rls_auto_enable() 의 직접 실행 권한(PUBLIC, anon, authenticated) 회수
--      · Supabase 자동 RLS 이벤트 트리거 자체는 건드리지 않음 (트리거는 DB 내부에서 호출되며 호출자의
--        실행 권한을 확인하지 않으므로 자동 RLS 기능은 그대로 유지됨)
--   ② public.admins : 로그인한 사용자에게 user_id 컬럼 SELECT 권한만 부여 (note, created_at 은 계속 비공개)
--   ③ public.admins : 「본인 user_id 행만」 읽는 RLS 정책 1개 추가
--   ④ public.is_admin() 을 SECURITY DEFINER → SECURITY INVOKER 로 전환
--      · 여전히 auth.uid() 기준 「본인이 관리자인가」만 반환
--      · 실행 권한은 기존 그대로 authenticated 만 (anon 불가)
--
--  바꾸지 않는 것
--   · 001~004 파일, posts / items / site_texts 의 데이터·권한·정책
--   · public.admin_post_authors() (기존 SECURITY DEFINER 구현 그대로 유지)
--   · 이벤트 트리거, Supabase 가 관리하는 다른 객체
--
--  안전장치
--   · 전체가 하나의 트랜잭션(begin ~ commit)이라 중간 상태가 다른 접속에 보이지 않고,
--     끝의 자가 점검이 하나라도 어긋나면 오류로 멈추며 전부 자동 취소(롤백)됩니다.
--   · 적용 순서 : 정책·권한 추가(②③) → 함수 전환(④) → 권한 회수(①).
--     (④ 가 ②③ 보다 먼저면 로그인 사용자의 is_admin() 이 권한 오류가 나므로 순서를 바꾸지 마세요)
--   · 여러 번 실행해도 안전합니다.
--
--  실행 순서 : schema.sql → 001 → 002 → 003 → 004 → 005
--   ⚠ 001 은 is_admin() 을 DEFINER 로 만들므로, 001 을 다시 실행했다면 005 도 다시 실행하세요.
--  ⚠ 먼저 「개발용」 프로젝트(wdlcoucbxidnwtwgrwxy)에서만. 운영 DB 는 별도 승인 후.
--  롤백 방법은 파일 맨 아래 주석을 참고하세요.
-- ============================================================================

begin;

-- 0) 선행 파일 확인
do $$
begin
  if to_regclass('public.admins') is null
     or to_regclass('public.posts') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception '먼저 001_admins.sql, 002_posts.sql 을 실행하세요 (public.admins / public.posts / public.is_admin() 중 없는 것이 있습니다)';
  end if;
end $$;

-- 1) 변경 전 상태 기록 (이 트랜잭션 안에서만 유지됨. 끝에서 「바뀌지 않아야 할 것」이 그대로인지 비교)
do $$
begin
  -- 이벤트 트리거(자동 RLS 포함) 목록·상태
  perform set_config('lsh.snap_evt', (
    select coalesce(md5(string_agg(e.evtname || ':' || e.evtevent || ':' || e.evtenabled::text || ':' || e.evtfoid::text,
                                   ',' order by e.evtname)), 'none')
    from pg_event_trigger e
  ), true);

  -- posts / items / site_texts 의 표·컬럼 권한
  perform set_config('lsh.snap_acl', (
    select coalesce(md5(string_agg(s.x, ',' order by s.x)), 'none')
    from (
      select c.relname || ':' || coalesce(c.relacl::text, '') as x
        from pg_class c
       where c.relnamespace = 'public'::regnamespace and c.relname in ('posts', 'items', 'site_texts')
      union all
      select c.relname || '.' || a.attname || ':' || coalesce(a.attacl::text, '')
        from pg_attribute a join pg_class c on c.oid = a.attrelid
       where c.relnamespace = 'public'::regnamespace and c.relname in ('posts', 'items', 'site_texts')
         and a.attnum > 0 and not a.attisdropped
    ) s
  ), true);

  -- posts / items / site_texts 의 RLS 정책
  perform set_config('lsh.snap_pol', (
    select coalesce(md5(string_agg(p.tablename || ':' || p.policyname || ':' || p.cmd || ':' || p.roles::text || ':'
                                   || coalesce(p.qual, '') || ':' || coalesce(p.with_check, ''),
                                   ',' order by p.tablename, p.policyname)), 'none')
    from pg_policies p
    where p.schemaname = 'public' and p.tablename in ('posts', 'items', 'site_texts')
  ), true);

  -- admin_post_authors() 의 정의와 실행 권한
  perform set_config('lsh.snap_apa', (
    select coalesce(md5(pg_get_functiondef(p.oid) || ':' || coalesce(p.proacl::text, '')), 'none')
    from pg_proc p
    where p.oid = to_regprocedure('public.admin_post_authors()')
  ), true);
end $$;

-- 2) admins : RLS 유지 + 로그인 사용자는 user_id 컬럼만 읽기 + 본인 행만
alter table public.admins enable row level security;

grant select (user_id) on public.admins to authenticated;

drop policy if exists "Users can read own admin row" on public.admins;
create policy "Users can read own admin row"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 3) is_admin() : SECURITY INVOKER 로 전환
--    · 호출한 사람의 권한으로 실행 → 위 정책 덕분에 「본인 행」만 보이므로 결과는 이전과 같음
--    · posts 정책의 (select public.is_admin()) 과 admin_post_authors() 안의 호출도 그대로 동작
--    · 이름 전체 표기 + search_path = '' 유지
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;

-- 실행 권한 재확인 (authenticated 만. 이 트랜잭션이 끝나기 전에는 다른 접속에 보이지 않음)
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- 4) Supabase 자동 RLS 함수 : 직접 실행 권한만 회수 (이벤트 트리거는 그대로)
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is null then
    raise notice 'public.rls_auto_enable() 가 없어 건너뜁니다 (자동 RLS 기능이 꺼진 프로젝트).';
  else
    begin
      revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
    exception when insufficient_privilege then
      raise warning 'rls_auto_enable() 권한 회수 실패(소유자 권한 필요). 대시보드 Security Advisor 에서 경고가 남습니다.';
    end;
  end if;
end $$;

-- 5) 자가 점검 : 하나라도 어긋나면 오류로 멈추고 전체가 자동 취소됩니다.
do $$
declare
  v_ok boolean;
begin
  -- 5-1) is_admin() : INVOKER + search_path 고정, 실행 권한 anon 불가 / authenticated 가능
  select not p.prosecdef into v_ok from pg_proc p where p.oid = 'public.is_admin()'::regprocedure;
  if not v_ok then raise exception '점검 실패: is_admin() 이 아직 SECURITY DEFINER 입니다'; end if;

  if not exists (
    select 1 from pg_proc p, unnest(coalesce(p.proconfig, '{}'::text[])) c
    where p.oid = 'public.is_admin()'::regprocedure and c like 'search_path=%'
  ) then raise exception '점검 실패: is_admin() 의 search_path 가 고정되지 않았습니다'; end if;

  if has_function_privilege('anon', 'public.is_admin()', 'execute') then
    raise exception '점검 실패: anon 이 is_admin() 을 실행할 수 있습니다'; end if;
  if not has_function_privilege('authenticated', 'public.is_admin()', 'execute') then
    raise exception '점검 실패: authenticated 가 is_admin() 을 실행할 수 없습니다'; end if;

  -- 5-2) admins : user_id 만 읽기, 그 외 컬럼·쓰기·방문자 접근 없음
  if not has_column_privilege('authenticated', 'public.admins', 'user_id', 'select') then
    raise exception '점검 실패: authenticated 가 admins.user_id 를 읽을 수 없습니다'; end if;
  if has_column_privilege('authenticated', 'public.admins', 'note', 'select')
     or has_column_privilege('authenticated', 'public.admins', 'created_at', 'select')
     or has_table_privilege('authenticated', 'public.admins', 'select') then
    raise exception '점검 실패: authenticated 가 user_id 외 컬럼을 읽을 수 있습니다'; end if;
  if has_any_column_privilege('authenticated', 'public.admins', 'insert, update, references')
     or has_table_privilege('authenticated', 'public.admins', 'delete, truncate') then
    raise exception '점검 실패: authenticated 에게 admins 쓰기성 권한이 있습니다'; end if;
  if has_any_column_privilege('anon', 'public.admins', 'select, insert, update, references')
     or has_table_privilege('anon', 'public.admins', 'delete, truncate') then
    raise exception '점검 실패: anon 이 admins 에 접근할 수 있습니다'; end if;

  -- 5-3) admins RLS 켜짐 + 정책은 「본인 행 읽기」 1개뿐
  if not (select relrowsecurity from pg_class where oid = 'public.admins'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.posts'::regclass) then
    raise exception '점검 실패: admins 또는 posts 의 RLS 가 꺼져 있습니다'; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'admins') <> 1
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admins'
                      and policyname = 'Users can read own admin row' and cmd = 'SELECT'
                      and roles = '{authenticated}'::name[]) then
    raise exception '점검 실패: admins 정책이 「본인 행 읽기」 1개가 아닙니다'; end if;

  -- 5-4) 바뀌지 않아야 할 것이 그대로인지
  if coalesce(current_setting('lsh.snap_evt', true), '') is distinct from (
       select coalesce(md5(string_agg(e.evtname || ':' || e.evtevent || ':' || e.evtenabled::text || ':' || e.evtfoid::text,
                                      ',' order by e.evtname)), 'none') from pg_event_trigger e) then
    raise exception '점검 실패: 이벤트 트리거(자동 RLS 포함)가 변경되었습니다'; end if;

  if coalesce(current_setting('lsh.snap_acl', true), '') is distinct from (
       select coalesce(md5(string_agg(s.x, ',' order by s.x)), 'none')
       from (
         select c.relname || ':' || coalesce(c.relacl::text, '') as x
           from pg_class c
          where c.relnamespace = 'public'::regnamespace and c.relname in ('posts', 'items', 'site_texts')
         union all
         select c.relname || '.' || a.attname || ':' || coalesce(a.attacl::text, '')
           from pg_attribute a join pg_class c on c.oid = a.attrelid
          where c.relnamespace = 'public'::regnamespace and c.relname in ('posts', 'items', 'site_texts')
            and a.attnum > 0 and not a.attisdropped
       ) s) then
    raise exception '점검 실패: posts / items / site_texts 의 권한이 변경되었습니다'; end if;

  if coalesce(current_setting('lsh.snap_pol', true), '') is distinct from (
       select coalesce(md5(string_agg(p.tablename || ':' || p.policyname || ':' || p.cmd || ':' || p.roles::text || ':'
                                      || coalesce(p.qual, '') || ':' || coalesce(p.with_check, ''),
                                      ',' order by p.tablename, p.policyname)), 'none')
       from pg_policies p
       where p.schemaname = 'public' and p.tablename in ('posts', 'items', 'site_texts')) then
    raise exception '점검 실패: posts / items / site_texts 의 정책이 변경되었습니다'; end if;

  if coalesce(current_setting('lsh.snap_apa', true), '') is distinct from (
       select coalesce(md5(pg_get_functiondef(p.oid) || ':' || coalesce(p.proacl::text, '')), 'none')
       from pg_proc p where p.oid = to_regprocedure('public.admin_post_authors()')) then
    raise exception '점검 실패: admin_post_authors() 가 변경되었습니다'; end if;

  -- 5-5) rls_auto_enable() : 회수 확인 (실패해도 중단하지는 않고 경고만)
  if to_regprocedure('public.rls_auto_enable()') is not null
     and (has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')
          or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute')) then
    raise warning '주의: anon 또는 authenticated 가 아직 rls_auto_enable() 을 실행할 수 있습니다';
  end if;

  raise notice '005 완료: 모든 자가 점검 통과 (이벤트 트리거·posts·items·site_texts·admin_post_authors 변경 없음)';
end $$;

commit;

-- ----------------------------------------------------------------------------
--  적용 후 확인 (읽기만 하는 조회 · 따로 실행)
--   · scratchpad 의 「함수/정책 조회 SQL」 과 004-privilege-check.sql 을 적용 전·후 비교
--   · 기대 결과
--       is_admin            : security_definer = false, search_path 설정 있음, 실행 권한 authenticated 만
--       admin_post_authors  : security_definer = true  (그대로)
--       rls_auto_enable     : acl 에 anon / authenticated / PUBLIC 의 EXECUTE 없음, 이벤트 트리거는 그대로
--       admins              : 정책 1개(Users can read own admin row), authenticated 는 user_id 컬럼만 select
--   · 자동 RLS 유지 확인 (표를 만들어도 rollback 으로 취소됨. 결과가 true 여야 함)
--       begin;
--         create table public.__rls_probe (id int);
--         select relrowsecurity from pg_class where oid = 'public.__rls_probe'::regclass;
--       rollback;
--   · 로그인 사용자 시험 (관리자 계정을 만든 뒤 · rollback 으로 취소됨 · <관리자 id>, <일반 사용자 id> 는 Auth 사용자의 id)
--       begin;
--         set local role authenticated;
--         select set_config('request.jwt.claims', '{"sub":"<관리자 id>","role":"authenticated"}', true);
--         select public.is_admin();                 -- true
--         select count(*) from public.admins;       -- 1 (본인 행만)
--         select note from public.admins;           -- 오류(permission denied) 여야 함
--         select * from public.admin_post_authors();-- 글 수만큼 행
--         select set_config('request.jwt.claims', '{"sub":"<일반 사용자 id>","role":"authenticated"}', true);
--         select public.is_admin();                 -- false
--         select count(*) from public.admins;       -- 0
--         select * from public.admin_post_authors();-- 0행
--       rollback;
--
--  롤백 방법 (005 적용을 되돌릴 때 · 반드시 아래 순서대로 한 번에 실행)
--   0) 적용 전에 rls_auto_enable() 의 acl 을 조회해 기록해 두세요. (아래 3번에서 그 값으로 복원)
--
--   begin;
--     -- 1) is_admin() 을 원래대로 (SECURITY DEFINER). 정책/권한 제거보다 반드시 먼저!
--     create or replace function public.is_admin()
--     returns boolean language sql stable security definer set search_path = '' as $$
--       select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
--     $$;
--     revoke all on function public.is_admin() from public, anon, authenticated;
--     grant execute on function public.is_admin() to authenticated;
--
--     -- 2) admins 의 정책과 컬럼 권한 제거 (원래의 「정책 없음 + 접근 불가」 상태)
--     drop policy if exists "Users can read own admin row" on public.admins;
--     revoke select (user_id) on public.admins from authenticated;
--
--     -- 3) rls_auto_enable() 권한 복원 : 적용 전 acl 에 있던 것만 되돌리세요. 예)
--     -- grant execute on function public.rls_auto_enable() to public, anon, authenticated;
--   commit;
--
--  Supabase 자동 관리 기능과의 관계
--   · Supabase 대시보드에서 「Automatically enable RLS」 를 껐다 켜면 rls_auto_enable() 이 새로 만들어져
--     기본 실행 권한이 다시 붙을 수 있습니다. 이때는 이 파일을 다시 실행하면 됩니다(여러 번 실행 가능).
--   · 새 함수를 만들 때마다 Supabase 기본 설정이 anon / authenticated 실행 권한을 붙일 수 있으니,
--     필요한 역할 외에는 항상 revoke 하세요 (001·002·005 가 그렇게 하고 있습니다).
-- ----------------------------------------------------------------------------
