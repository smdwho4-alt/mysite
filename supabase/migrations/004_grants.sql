-- ============================================================================
--  004. 기존 표(items, site_texts)의 표 권한(GRANT) 명시 — 최소 권한
--
--  왜 필요한가
--   · 최근에 만든 Supabase 프로젝트는 SQL 로 만든 표에 anon / authenticated / service_role
--     권한을 자동으로 붙여 주지 않습니다. (개발 DB ilbong-dev 가 이 경우)
--   · 그래서 schema.sql 로 만든 items, site_texts 를 방문자가 읽지 못하고,
--     서버 비밀 키(service_role)로도 관리자 기능이 동작하지 않습니다.
--   · 이 파일은 현재 앱 코드가 실제로 사용하는 작업에 필요한 권한만 명시합니다.
--
--  원칙
--   · 권한 추가(GRANT)만 합니다. 기존 데이터·RLS 정책·다른 권한은 바꾸지 않습니다.
--   · RLS 는 계속 켜 둡니다. (정책 자체는 schema.sql 의 것을 그대로 사용)
--   · service_role 은 RLS 를 우회하므로, 권한(GRANT)이 유일한 제한입니다 → ALL 금지, 필요한 것만.
--   · posts / admins 는 이 파일에서 다루지 않습니다. (002 의 컬럼 단위 권한 그대로 유지)
--   · Supabase 의 자동 RLS 이벤트 트리거(rls_auto_enable)는 건드리지 않습니다.
--
--  실행 순서: schema.sql → 001 → 002 → 003 → 004   (004 는 schema.sql 이후 언제든 가능)
--  여러 번 실행해도 안전합니다. ⚠ 먼저 「개발용」 프로젝트에서만. 운영 DB 는 별도 승인 후.
--  (이 폴더는 Supabase CLI 가 아니라 SQL Editor 에서 직접 실행하는 방식입니다.)
-- ============================================================================

-- 0) schema.sql 이 실행됐는지 확인
do $$
begin
  if to_regclass('public.items') is null or to_regclass('public.site_texts') is null then
    raise exception '먼저 supabase/schema.sql 을 실행하세요 (public.items / public.site_texts 가 없습니다)';
  end if;
end $$;

-- 1) RLS 켜짐 유지 (이미 켜져 있으면 아무 일도 일어나지 않음. FORCE 는 쓰지 않음)
alter table public.items      enable row level security;
alter table public.site_texts enable row level security;

-- 2) 방문자(anon) + 로그인한 사람(authenticated): 읽기만
--    어떤 행을 볼 수 있는지는 기존 RLS 정책이 결정합니다.
--      items      : is_visible = true 인 카드만
--      site_texts : 전체(공개 문구)
--    사용처: lib/data.ts  getItems() / getHeroTexts()
grant select on public.items      to anon, authenticated;
grant select on public.site_texts to anon, authenticated;

-- 3) 서버 전용 비밀 키(service_role): 관리자 서버 액션이 실제로 쓰는 작업만
--    사용처: app/admin/actions.ts, app/admin/page.tsx
--
--    items  : 목록 조회(select), 추가(insert), 수정(update), 삭제(delete)
--             → 쓰기는 앱이 실제로 보내는 7개 컬럼만. id / created_at 은 자동값이라 직접 쓰기 불가.
grant select, delete on public.items to service_role;

grant insert (section, title, description, image_url, link_url, sort_order, is_visible)
  on public.items to service_role;

grant update (section, title, description, image_url, link_url, sort_order, is_visible)
  on public.items to service_role;

--    site_texts : 조회(select) + 저장(upsert = insert + update). 삭제는 쓰지 않으므로 주지 않음.
grant select on public.site_texts to service_role;

grant insert (key, value, updated_at) on public.site_texts to service_role;
grant update (key, value, updated_at) on public.site_texts to service_role;

-- 4) 적용 후 자가 점검 (아무것도 바꾸지 않고 경고만 출력)
do $$
declare
  r record;
begin
  -- 4-1) RLS 가 꺼진 표가 있으면 중단
  if exists (
    select 1 from pg_class
    where oid in ('public.items'::regclass, 'public.site_texts'::regclass) and not relrowsecurity
  ) then
    raise exception 'RLS 가 꺼져 있습니다. 중단합니다.';
  end if;

  -- 4-2) 방문자/로그인 사용자에게 쓰기성 권한이 남아 있으면 경고
  --      (기본 권한이 자동으로 붙는 예전 프로젝트에서는 나올 수 있음. RLS 가 쓰기를 막고 있지만 권한 정리를 권장)
  for r in
    select t.tbl, ro.rn, p.priv
    from (values ('items'), ('site_texts')) t(tbl)
    cross join (values ('anon'), ('authenticated')) ro(rn)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
    where has_table_privilege(ro.rn::name, 'public.' || t.tbl, p.priv)
  loop
    raise warning '주의: % 가 public.% 에 % 권한을 가지고 있습니다 (정리 권장)', r.rn, r.tbl, r.priv;
  end loop;

  -- 4-3) 서버 키에 필요 이상의 표 권한이 있으면 경고
  for r in
    select t.tbl, p.priv
    from (values ('items'), ('site_texts')) t(tbl)
    cross join (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
    where has_table_privilege('service_role', 'public.' || t.tbl, p.priv)
  loop
    raise warning '주의: service_role 이 public.% 에 % 권한을 가지고 있습니다 (정리 권장)', r.tbl, r.priv;
  end loop;
  if has_table_privilege('service_role', 'public.site_texts', 'DELETE') then
    raise warning '주의: service_role 이 public.site_texts 에 DELETE 권한을 가지고 있습니다 (앱은 삭제를 쓰지 않음, 정리 권장)';
  end if;

  -- 4-4) admins 에 방문자/로그인 사용자 접근이 있으면 경고
  if to_regclass('public.admins') is not null then
    for r in
      select ro.rn from (values ('anon'), ('authenticated')) ro(rn)
      where has_table_privilege(ro.rn::name, 'public.admins', 'SELECT, INSERT, UPDATE, DELETE')
         or has_any_column_privilege(ro.rn::name, 'public.admins', 'SELECT, INSERT, UPDATE')
    loop
      raise warning '위험: % 가 public.admins 에 접근 권한을 가지고 있습니다. 001_admins.sql 을 다시 확인하세요', r.rn;
    end loop;
  end if;

  raise notice '004 완료: 경고가 없으면 최소 권한 상태입니다.';
end $$;

-- ----------------------------------------------------------------------------
--  적용 전/후 비교용 읽기 전용 조회 (따로 실행 · 데이터 변경 없음)
--  같은 조회를 004 실행 「전」과 「후」에 각각 실행해 결과를 비교하세요.
--
--  A) 권한 표 (t=true / f=false)
--     표 단위 권한은 *_tbl, 컬럼 단위로라도 가진 권한은 *_col 열입니다.
--
--  select t.tbl as "표", r.rn as "역할",
--         has_table_privilege(r.rn::name, 'public.' || t.tbl, 'SELECT')   as sel_tbl,
--         has_any_column_privilege(r.rn::name, 'public.' || t.tbl, 'SELECT') as sel_col,
--         has_table_privilege(r.rn::name, 'public.' || t.tbl, 'INSERT')   as ins_tbl,
--         has_any_column_privilege(r.rn::name, 'public.' || t.tbl, 'INSERT') as ins_col,
--         has_table_privilege(r.rn::name, 'public.' || t.tbl, 'UPDATE')   as upd_tbl,
--         has_any_column_privilege(r.rn::name, 'public.' || t.tbl, 'UPDATE') as upd_col,
--         has_table_privilege(r.rn::name, 'public.' || t.tbl, 'DELETE')   as del_tbl,
--         has_table_privilege(r.rn::name, 'public.' || t.tbl, 'TRUNCATE') as trunc_tbl
--    from (values ('items'), ('site_texts'), ('posts'), ('admins')) t(tbl)
--   cross join (values ('anon'), ('authenticated'), ('service_role')) r(rn)
--   order by 1, 2;
--
--  B) RLS 켜짐 + 정책 수 (004 전후 같아야 함. items=1, site_texts=1, posts=5, admins=0)
--
--  select c.relname as "표", c.relrowsecurity as rls,
--         (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
--    from pg_class c
--   where c.relnamespace = 'public'::regnamespace and c.relname in ('items', 'site_texts', 'posts', 'admins')
--   order by 1;
--
--  C) 서버 키가 컬럼 단위로 쓸 수 있는 컬럼 (기대: 아래 「기대 결과」 참고)
--
--  select table_name as "표", privilege_type as "권한", string_agg(column_name, ', ' order by column_name) as "컬럼"
--    from information_schema.column_privileges
--   where table_schema = 'public' and grantee = 'service_role'
--     and table_name in ('items', 'site_texts') and privilege_type in ('INSERT', 'UPDATE')
--   group by 1, 2 order by 1, 2;
--
--  기대 결과 (004 적용 후, 새 Supabase 프로젝트 기준)
--   items      : anon sel_tbl=t / authenticated sel_tbl=t / service_role sel_tbl=t, del_tbl=t, ins_col=t, upd_col=t
--                (나머지 칸 모두 f, ins_tbl/upd_tbl 은 f — 컬럼 단위이므로)
--   site_texts : anon sel_tbl=t / authenticated sel_tbl=t / service_role sel_tbl=t, ins_col=t, upd_col=t (del_tbl=f)
--   posts      : 변경 없음. anon sel_col=t(표 단위 f) / authenticated sel_col, ins_col, upd_col, del_tbl = t / service_role 전부 f
--   admins     : 세 역할 모두 전부 f
--   B) rls 는 4개 표 모두 t, policies 는 items=1, site_texts=1, posts=5, admins=0
--   C) items : INSERT, UPDATE 모두 description, image_url, is_visible, link_url, section, sort_order, title
--      site_texts : INSERT, UPDATE 모두 key, updated_at, value
--
--  ※ 운영처럼 기본 권한이 자동으로 붙는 프로젝트에서는 A) 의 anon / authenticated 에 INSERT,
--    UPDATE, DELETE, TRUNCATE 등이 t 로 나올 수 있습니다. 004 는 이를 줄이지 않습니다. (별도 승인 사항)
-- ----------------------------------------------------------------------------
