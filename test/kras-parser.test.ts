import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseKrasList } from '../src/parsers/kras.parser';

const listJson = (
  items: { id: number; title: string; is_secret?: unknown }[],
): string =>
  JSON.stringify({
    success: true,
    board: { slug: 'notice', allow_secret: 1 },
    items: items.map((item) => ({
      board_id: 32,
      board_slug: 'notice',
      publish_date: '2026-11-03',
      status: 'published',
      ...item,
    })),
  });

test('비밀글은 상세를 요청하기 전에 목록에서 제외한다', () => {
  const posts = parseKrasList(
    listJson([
      { id: 1, title: '공개 공지' },
      // alert 게시판 32541번 글에서 관찰한 실제 모양.
      { id: 2, title: '🔒 비밀글입니다.', is_secret: 1 },
      { id: 3, title: '문자열 플래그', is_secret: '1' },
      { id: 4, title: '불리언 플래그', is_secret: true },
    ]),
  );

  assert.deepEqual(
    posts.map((post) => post.uniqId),
    ['1'],
  );
});

test('비밀글 플래그가 없거나 꺼져 있으면 공개글로 본다', () => {
  const posts = parseKrasList(
    listJson([
      { id: 1, title: '플래그 없음' },
      { id: 2, title: '숫자 0', is_secret: 0 },
      { id: 3, title: '문자열 0', is_secret: '0' },
      { id: 4, title: 'null', is_secret: null },
      { id: 5, title: 'false', is_secret: false },
    ]),
  );

  assert.deepEqual(
    posts.map((post) => post.uniqId),
    ['1', '2', '3', '4', '5'],
  );
});

test('공개글은 상세 URL과 날짜를 그대로 만든다', () => {
  const [post] = parseKrasList(listJson([{ id: 32555, title: '  공지  ' }]));

  assert.equal(post.title, '공지');
  assert.equal(
    post.detailUrl,
    'https://www.kras.or.kr/sub/notice/detail?id=32555',
  );
});
