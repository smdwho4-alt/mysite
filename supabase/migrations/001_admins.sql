-- ============================================================================
--  001. 관리자 명단(admins) + 관리자 확인 함수(is_admin)
--  ⚠ 먼저 「개발용」 Supabase 프로젝트에서 실행하세요. 운영 DB는 승인 후에만.
--  사용법: Supabase 대시보드 → SQL Editor → New query → 전부 붙여넣기 → Run
--  여러 번 실행해도 문제 없고, 기존 표(items, site_texts)는 건드리지 않습니다.
--  실행 순서: schema.sql → 001 → 002 → 003
-- ============================================================================

-- 1) 관리자 명단 표
--    로그인한 사람이라고 모두 관리자가 아니라, 여기에 등록된 사람만 관리자입니다.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,                                  -- 메모 (예: "관리자1")
  created_at timestamptz not null default now()
);

-- 2) 보안: 규칙(정책)을 하나도 만들지 않음 → 사이트 방문자/로그인한 사람도 이 표를 직접 읽거나 쓸 수 없음
--    (아래 is_admin() 함수만 안전하게 확인해 줌. 명단 수정은 SQL Editor 에서만 가능)
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- 3) 「지금 로그인한 사람이 관리자인가?」 를 알려주는 함수
--    - security definer : 명단 표를 직접 읽을 수 없는 사람도 '본인이 관리자인지'만 확인 가능
--    - search_path = '' : 같은 이름의 가짜 표/함수로 바꿔치기하는 공격 방지 (모든 이름을 public. / auth. 로 전체 표기)
--    - 본인(auth.uid())만 확인하므로 다른 사람이 관리자인지는 알아낼 수 없음
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;

-- 4) 실행 권한: 로그인한 사람(authenticated)만. 방문자(anon)와 그 외 모두 회수.
--    (Supabase 가 새 함수에 자동으로 주는 anon 권한도 명시적으로 회수)
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- ----------------------------------------------------------------------------
--  관리자 등록 절차  (아래는 실행되지 않는 안내문입니다. 순서대로 따로 진행하세요)
--
--  [0단계] 반드시 먼저 — 대시보드 → Authentication 에서
--          · 「Allow new users to sign up」 끄기 (회원가입 차단)
--          · 「Allow anonymous sign-ins」 꺼져 있는지 확인
--          (가입이 열린 상태에서 등록하면, 같은 이메일로 먼저 가입한 사람이 관리자가 될 수 있음)
--
--  [1단계] 대시보드 → Authentication → Users → Add user → Create new user
--          · 이메일/비밀번호 입력, 「Auto Confirm User」 체크
--          · "already registered" 같은 오류가 나면 누군가 먼저 만든 계정 → 등록 중단하고 보고
--
--  [2단계] 계정 상태 확인 (읽기만 하는 조회)
--          select id, email, email_confirmed_at, last_sign_in_at, is_anonymous, created_at
--            from auth.users order by created_at;
--          · 내가 만든 계정 말고 모르는 계정이 있으면 등록 중단
--
--  [3단계] 등록 — 아래 블록에서 이메일/메모만 바꿔 실행.
--          · 일치 계정이 정확히 1개, 이메일 확인됨, 익명 아님, 삭제 안 됨,
--            로그인 기록 없음(방금 만든 계정) 일 때만 등록되고, 아니면 오류로 멈춤
--
--  do $$
--  declare
--    v_email text := lower('admin1@example.com');   -- ← 실제 관리자 이메일로 교체
--    v_note  text := '관리자1';                       -- ← 메모
--    v_cnt   int;
--    v_id    uuid;
--  begin
--    select count(*) into v_cnt from auth.users where lower(email) = v_email;
--    if v_cnt <> 1 then
--      raise exception '이메일이 일치하는 계정이 정확히 1개가 아닙니다 (%개). 등록 중단', v_cnt;
--    end if;
--
--    select id into v_id from auth.users
--     where lower(email) = v_email
--       and email_confirmed_at is not null
--       and coalesce(is_anonymous, false) = false
--       and deleted_at is null
--       and last_sign_in_at is null;
--    if v_id is null then
--      raise exception '이메일 미확인/익명/삭제됨/이미 로그인 기록이 있는 계정입니다. 등록 중단';
--    end if;
--
--    insert into public.admins (user_id, note) values (v_id, v_note)
--    on conflict (user_id) do nothing;
--  end $$;
--
--  [4단계] 등록 결과 확인 (읽기만 하는 조회)
--          select a.note, u.email, u.email_confirmed_at
--            from public.admins a join auth.users u on u.id = a.user_id;
--          select (select count(*) from auth.users) as 전체계정, (select count(*) from public.admins) as 관리자;
--          · 전체계정이 관리자 수보다 많으면 출처를 확인 (가입 차단 상태라면 0이 아닌 차이가 없어야 함)
--
--  [관리자 제거]  delete from public.admins where user_id = '<제거할 계정의 id>';
--                (계정 자체를 지우면 자동으로 함께 제거됨)
-- ----------------------------------------------------------------------------
