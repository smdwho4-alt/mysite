-- ============================================================================
--  003. 기존 공지사항·주요소식 5건 옮겨 넣기 (site.config.ts 의 notices / news 내용)
--  ⚠ 002_posts.sql 실행 후에 실행하세요.
--
--  ★ 최초 1회만 실행하는 파일입니다.
--    · 게시판 표(posts)에 글이 「하나라도」 있으면 아무것도 넣지 않고 건너뜁니다.
--      → 다시 실행해도 중복이 생기지 않고, 관리자가 고치거나 지운 글이 되살아나지 않습니다.
--    · 단, 관리자가 모든 글을 지워 표가 완전히 비었을 때 다시 실행하면 5건이 다시 들어갑니다.
--      (의도한 경우가 아니라면 실행하지 마세요)
--
--  ⚠ 이 5건은 현재 사이트에 보이는 샘플 문구 그대로입니다.
--    운영 DB 에 넣기 전에, 실제 공지로 바꿀지(또는 넣지 않을지) 먼저 결정하세요.
--  개발용 DB 에서 먼저 확인하고, 운영 DB 는 승인 후에 실행합니다.
-- ============================================================================

do $$
begin
  if to_regclass('public.posts') is null then
    raise exception '먼저 002_posts.sql 을 실행하세요 (public.posts 표가 없습니다)';
  end if;

  -- 동시에 두 번 실행돼도 한 번만 들어가도록 잠금
  perform pg_advisory_xact_lock(hashtext('lsh-calss:003_seed_posts'));

  if exists (select 1 from public.posts) then
    raise notice '게시판에 이미 글이 있어 시드 입력을 건너뜁니다 (최초 1회 원칙).';
    return;
  end if;

  insert into public.posts (category, title, published_at)
  values
    ('notice', '가을 정기 모임 및 작은 발표회 안내',  date '2026-10-20'),
    ('notice', '11월 원데이 클래스 참가자 모집',      date '2026-10-05'),
    ('notice', '홈페이지를 새롭게 단장했습니다',      date '2026-09-12'),
    ('news',   'AI 활용 강좌 1기 수료',               date '2026-09-30'),
    ('news',   '지역 도서관과 협력 프로그램 시작',    date '2026-08-18');

  raise notice '시드 5건을 입력했습니다.';
end $$;

-- 확인용(읽기만): select category, title, published_at from public.posts order by category, published_at desc;
-- 기대 결과: 공지 3건 + 소식 2건 = 5건 (작성자 created_by 는 SQL Editor 실행이라 비어 있음)
