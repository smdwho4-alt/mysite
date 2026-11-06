-- ============================================================================
--  002. 게시판(posts) 표 — 공지사항 · 주요소식
--  ⚠ 001_admins.sql 을 먼저 실행한 뒤에 실행하세요. (is_admin() 함수가 필요)
--  ⚠ 먼저 「개발용」 Supabase 프로젝트에서 실행하세요. 운영 DB는 승인 후에만.
--  여러 번 실행해도 문제 없고, 기존 표(items, site_texts)는 건드리지 않습니다.
--  실행 순서: schema.sql → 001 → 002 → 003
--
--  1단계 정책 요약
--   · 즉시 게시 / 임시저장·숨김(is_visible=false) 만 지원. 예약 게시는 지원하지 않음.
--   · 미래 게시일의 글은 공개 불가 (공개 정책 + 저장 시 DB 규칙으로 이중 차단)
--   · created_by(작성자 ID)는 로그인한 관리자로 자동 기록, 사용자가 지정/변경 불가
--   · 방문자와 일반 로그인 사용자는 created_by 컬럼을 읽을 수 없음 (컬럼 권한)
--     → 앱에서 방문자용 조회는 select * 대신 반드시 컬럼 이름을 적어야 함
-- ============================================================================

-- 0) 먼저 001 이 실행됐는지 확인 (아니면 안내 후 중단)
do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception '먼저 001_admins.sql 을 실행하세요 (public.is_admin() 함수가 없습니다)';
  end if;
end $$;

-- 1) 글을 저장하는 표 (규칙은 아래 2)에서 이름을 붙여 따로 걸어, 다시 실행하면 최신 규칙으로 갱신됨)
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,                                       -- notice=공지사항, news=주요소식
  title        text not null,                                       -- 제목
  body         text,                                                -- 본문 (일반 글자만)
  link_url     text,                                                -- 선택 링크
  is_pinned    boolean not null default false,                      -- 고정 (목록 맨 위, 공지 띠에 우선 표시)
  is_visible   boolean not null default true,                       -- true=게시, false=임시저장/숨김
  published_at date not null default ((now() at time zone 'Asia/Seoul')::date), -- 게시일 (화면에 보이는 날짜)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null default auth.uid() -- 작성자 (관리자 작업이력용, 비공개)
);

-- 2) 입력값 규칙 (이름을 붙여 두어 다시 실행해도 최신 규칙으로 교체됨)
alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts add constraint posts_category_check
  check (category in ('notice', 'news'));

-- 제목: 1~120자, 그리고 공백·탭·줄바꿈·전각 공백·보이지 않는 공백만으로 된 제목은 거부
alter table public.posts drop constraint if exists posts_title_check;
alter table public.posts add constraint posts_title_check
  check (
    char_length(title) between 1 and 120
    and title ~ '[^[:space:]\xa0\x2000-\x200b\x3000\xfeff]'
  );

alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts add constraint posts_body_check
  check (body is null or char_length(body) <= 10000);

-- 링크: 500자 이하이고, 아래 둘 중 하나만 허용
--   ① https:// 또는 http:// + 주소(주소 안에 @, 공백, 역슬래시, 제어문자 불가 → 위장 주소 차단)
--   ② 사이트 내부 주소: / 또는 /글자... (// 로 시작하는 외부 우회, /\ 우회, 공백, javascript: 등 모두 차단)
alter table public.posts drop constraint if exists posts_link_url_check;
alter table public.posts add constraint posts_link_url_check
  check (
    link_url is null
    or (
      char_length(link_url) <= 500
      and link_url ~ '^(https?://[^[:space:][:cntrl:]/\\@?#]+([/?#][^[:space:][:cntrl:]\\]*)?|/([^[:space:][:cntrl:]/\\][^[:space:][:cntrl:]\\]*)?)$'
    )
  );

create index if not exists posts_list_idx
  on public.posts (category, is_visible, is_pinned desc, published_at desc, created_at desc);

-- 3) 저장할 때 자동으로 지켜 주는 규칙 (트리거) — 게시판 전용 이름 사용
-- 3-1) 고칠 때마다 updated_at 자동 갱신
create or replace function public.posts_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 3-2) 작성자 자동 기록·변경 금지 + 미래 게시일 공개 금지
--      · 로그인한 사용자(auth.uid() 있음)가 저장하면: 작성자는 항상 본인으로 기록, 수정 시 작성자 변경 불가
--      · auth.uid() 가 없는 경우(SQL Editor, 서버 비밀 키)는 신뢰된 작업으로 보고 지정한 값을 그대로 둠
--      · 미래 게시일이면서 공개(is_visible=true)인 글은 저장 자체를 거부 (예약 게시 미지원)
create or replace function public.posts_guard_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is not null then
    if tg_op = 'INSERT' then
      new.created_by := v_uid;
    else
      new.created_by := old.created_by;
    end if;
  end if;

  if new.is_visible and new.published_at > ((now() at time zone 'Asia/Seoul')::date) then
    raise exception '미래 게시일의 글은 공개할 수 없습니다 (예약 게시는 지원하지 않습니다)'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- 트리거 함수는 직접 호출할 일이 없으므로 실행 권한을 모두 회수
revoke all on function public.posts_set_updated_at() from public, anon, authenticated;
revoke all on function public.posts_guard_write()    from public, anon, authenticated;

-- (이전 버전 이름의 트리거가 있었다면 정리)
drop trigger if exists posts_set_updated_at on public.posts;

drop trigger if exists posts_set_updated_at_trg on public.posts;
create trigger posts_set_updated_at_trg
  before update on public.posts
  for each row execute function public.posts_set_updated_at();

drop trigger if exists posts_guard_write_trg on public.posts;
create trigger posts_guard_write_trg
  before insert or update on public.posts
  for each row execute function public.posts_guard_write();

-- 4) 권한(GRANT) — 컬럼 단위로 최소한만
--    · 읽기: created_by 를 뺀 컬럼만 (방문자·일반 로그인 사용자는 작성자 ID 를 볼 수 없음)
--    · 쓰기: id / created_at / updated_at / created_by 는 사용자가 직접 넣거나 바꿀 수 없음 (자동)
--    · 삭제: 로그인한 사용자에게 권한을 주되, 아래 RLS 가 관리자만 허용
--    · truncate / references / trigger 권한은 아무에게도 주지 않음
revoke all on public.posts from anon, authenticated;

grant select (id, category, title, body, link_url, is_pinned, is_visible, published_at, created_at, updated_at)
  on public.posts to anon, authenticated;

grant insert (category, title, body, link_url, is_pinned, is_visible, published_at)
  on public.posts to authenticated;

grant update (category, title, body, link_url, is_pinned, is_visible, published_at)
  on public.posts to authenticated;

grant delete on public.posts to authenticated;

-- 5) 보안 규칙(RLS) — GRANT 와 반드시 함께 적용되는 두 번째 잠금
alter table public.posts enable row level security;

-- (이전 버전 이름의 정책이 있었다면 정리)
drop policy if exists "Public can read visible posts" on public.posts;

-- 방문자 + 로그인한 사람: '게시' 상태이고 게시일이 오늘(한국 시간) 이전인 글만 읽기
drop policy if exists "Public can read published posts" on public.posts;
create policy "Public can read published posts"
  on public.posts for select
  to anon, authenticated
  using (is_visible = true and published_at <= ((now() at time zone 'Asia/Seoul')::date));

-- 관리자만: 임시저장·숨김·미래 날짜 글 포함 전부 읽기
drop policy if exists "Admins can read all posts" on public.posts;
create policy "Admins can read all posts"
  on public.posts for select
  to authenticated
  using ((select public.is_admin()));

-- 관리자만: 추가 / 수정 / 삭제
drop policy if exists "Admins can insert posts" on public.posts;
create policy "Admins can insert posts"
  on public.posts for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can update posts" on public.posts;
create policy "Admins can update posts"
  on public.posts for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete posts" on public.posts;
create policy "Admins can delete posts"
  on public.posts for delete
  to authenticated
  using ((select public.is_admin()));

-- 6) 관리자 전용 작업이력 조회: 글별 작성자 ID (created_by 는 컬럼 권한으로 막혀 있으므로 이 함수로만 조회)
--    · 관리자가 아니면 결과가 0행
--    · 방문자(anon)는 실행 권한 없음
create or replace function public.admin_post_authors()
returns table (post_id uuid, created_by uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.created_by
    from public.posts p
   where (select public.is_admin());
$$;

revoke all on function public.admin_post_authors() from public, anon, authenticated;
grant execute on function public.admin_post_authors() to authenticated;

-- ----------------------------------------------------------------------------
--  실행 후 확인용 (읽기만 하는 조회 — 따로 실행). 기대 결과를 함께 적어 둠.
--
--  A) RLS 켜짐: rowsecurity 가 posts / admins / items / site_texts 모두 true
--     select tablename, rowsecurity from pg_tables
--      where schemaname = 'public' and tablename in ('posts', 'admins', 'items', 'site_texts');
--
--  B) 정책: posts 에 5개
--     select policyname, cmd, roles from pg_policies where tablename = 'posts' order by policyname;
--
--  C) 컬럼 권한: 방문자·로그인 사용자의 created_by 읽기 → 모두 false
--     select has_column_privilege('anon',          'public.posts', 'created_by', 'select') as anon_read,
--            has_column_privilege('authenticated', 'public.posts', 'created_by', 'select') as auth_read,
--            has_column_privilege('authenticated', 'public.posts', 'created_by', 'update') as auth_update,
--            has_column_privilege('authenticated', 'public.posts', 'created_by', 'insert') as auth_insert;
--
--  D) 함수 실행 권한: is_admin → anon=false, authenticated=true / admin_post_authors 동일
--     select has_function_privilege('anon',          'public.is_admin()', 'execute') as anon_exec,
--            has_function_privilege('authenticated', 'public.is_admin()', 'execute') as auth_exec;
--
--  E) 동작 시험(개발 DB 에서만, 반드시 마지막 줄 rollback — 실제 저장되지 않음)
--     begin;
--       set local role anon;
--       select count(*) from public.posts;                 -- 공개 글 수 (시드 후 5)
--       select title from public.posts limit 1;            -- 성공
--       select created_by from public.posts limit 1;       -- 오류(permission denied)여야 함
--       insert into public.posts (category, title) values ('notice', 'x');  -- 오류여야 함
--     rollback;
--
--     begin;  -- 관리자가 아닌 로그인 사용자 흉내
--       set local role authenticated;
--       select set_config('request.jwt.claims',
--         '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
--       insert into public.posts (category, title) values ('notice', 'x');  -- RLS 오류여야 함
--     rollback;
-- ----------------------------------------------------------------------------
