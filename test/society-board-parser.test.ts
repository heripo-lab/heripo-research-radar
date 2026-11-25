import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseHsasList } from '../src/parsers/hsas.parser';
import { parseKrasList } from '../src/parsers/kras.parser';
import { createSocietyBoardFetch } from '../src/parsers/society-board.parser';

const listJson = (boardSlug: string, id: number, title: string): string =>
  JSON.stringify({
    success: true,
    board: { slug: boardSlug },
    items: [
      {
        id,
        board_id: 1,
        board_slug: boardSlug,
        title,
        publish_date: '2026-11-12',
        status: 'published',
      },
    ],
  });

const recordingFetch = () => {
  const urls: string[] = [];
  const fetchImpl: typeof fetch = (input) => {
    urls.push(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    return Promise.resolve(new Response('{}'));
  };

  return { urls, fetchImpl };
};

test('사이트별 파서는 자기 사이트의 상세 URL을 만든다', () => {
  const [kras] = parseKrasList(listJson('notice', 32555, '공지'));
  const [hsas] = parseHsasList(listJson('notice', 2577, '공지'));

  assert.equal(
    kras.detailUrl,
    'https://www.kras.or.kr/sub/notice/detail?id=32555',
  );
  assert.equal(
    hsas.detailUrl,
    'https://www.hsas.or.kr/sub/notice/detail?id=2577',
  );
});

test('상세 요청은 요청이 향하던 사이트의 API로 돌아간다', async () => {
  const { urls, fetchImpl } = recordingFetch();
  const societyFetch = createSocietyBoardFetch(fetchImpl);

  await societyFetch('https://www.kras.or.kr/sub/notice/detail?id=32555');
  await societyFetch('https://www.hsas.or.kr/sub/society_news/detail?id=1657');

  assert.deepEqual(urls, [
    'https://www.kras.or.kr/api/boards/detail/32555',
    'https://www.hsas.or.kr/api/boards/detail/1657',
  ]);
});

test('상세가 아닌 요청과 다른 사이트 요청은 그대로 통과시킨다', async () => {
  const { urls, fetchImpl } = recordingFetch();
  const societyFetch = createSocietyBoardFetch(fetchImpl);

  await societyFetch('https://www.hsas.or.kr/sub/notice');
  await societyFetch('https://www.hsas.or.kr/sub/notice/detail');
  await societyFetch('https://www.jbgogo.or.kr/sub/notice/detail?id=1');

  assert.deepEqual(urls, [
    'https://www.hsas.or.kr/sub/notice',
    'https://www.hsas.or.kr/sub/notice/detail',
    'https://www.jbgogo.or.kr/sub/notice/detail?id=1',
  ]);
});
