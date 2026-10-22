import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { fetchBoard, normalizeBoardUrl, parsePin } from '../src/pinterest';

const mock = vi.mocked(requestUrl);
function answer(value: unknown, status = 200): ReturnType<typeof requestUrl> {
  return Promise.resolve({ status, headers: {}, text: JSON.stringify(value), json: value,
    arrayBuffer: new ArrayBuffer(0) }) as ReturnType<typeof requestUrl>;
}
const rawPin = (id: string) => ({
  id, type: 'pin', title: 'A [title]', link: 'https://example.org/a',
  images: { '236x': { url: 'https://i.pinimg.com/small.jpg', width: 236, height: 300 },
    orig: { url: 'https://i.pinimg.com/original.jpg', width: 1000, height: 1400 } },
});
const board = (count = 2) => ({ resource_response: { status: 'success', data: { id: '123', pin_count: count } } });
const page = (ids: string[], bookmark?: string) => ({ resource_response: {
  status: 'success', data: ids.map(rawPin), ...(bookmark ? { bookmark } : {}),
} });

beforeEach(() => { mock.mockReset(); });

describe('Pinterest client', () => {
  it('canonicalizes regional boards and drops tracking parameters', () => {
    expect(normalizeBoardUrl('https://de.pinterest.com/alice/interior/?utm_source=x'))
      .toBe('https://www.pinterest.com/alice/interior/');
  });

  it.each([
    'https://pinterest.com.evil.org/a/b/', 'https://evil.org/a/b/', 'http://pinterest.com/a/b/',
    'https://www.pinterest.com/pin/123/', 'https://pin.it/abcdef',
    'https://www.pinterest.com/user/board/section/', 'https://user:pass@pinterest.com/a/b/',
  ])('rejects unsafe or non-board URLs: %s', url => expect(() => normalizeBoardUrl(url)).toThrow());

  it('selects the largest pin image and ignores unsafe destination links', () => {
    const pin = parsePin({ ...rawPin('1'), link: 'javascript:alert(1)' });
    expect(pin?.imageUrl).toBe('https://i.pinimg.com/original.jpg');
    expect(pin?.link).toBe('');
  });

  it('rejects external image hosts and unsupported image pins', () => {
    expect(() => parsePin({ id: '1', images: { orig: { url: 'https://evil.org/a.jpg' } } })).toThrow();
    expect(parsePin({ type: 'board', id: '999' })).toBeNull();
  });

  it('paginates the entire board and deduplicates overlapping pages', async () => {
    mock.mockImplementationOnce(() => answer(board()))
      .mockImplementationOnce(() => answer(page(['1'], 'next')))
      .mockImplementationOnce(() => answer(page(['1', '2'], '-end-')));
    expect((await fetchBoard('https://de.pinterest.com/alice/interior/')).map(p => p.id)).toEqual(['1', '2']);
    const third = new URL(String(mock.mock.calls[2]![0] && (mock.mock.calls[2]![0] as { url: string }).url));
    expect(JSON.parse(third.searchParams.get('data')!).options.bookmarks).toEqual(['next']);
  });

  it('accepts the resource.options bookmark response variant', async () => {
    mock.mockImplementationOnce(() => answer(board(1)))
      .mockImplementationOnce(() => answer({ ...page(['1']), resource: { options: { bookmarks: ['-end-'] } } }));
    expect(await fetchBoard('https://pinterest.com/a/b/')).toHaveLength(1);
  });

  it('accepts a verified empty board', async () => {
    mock.mockImplementationOnce(() => answer(board(0)))
      .mockImplementationOnce(() => answer(page([], '-end-')));
    expect(await fetchBoard('https://pinterest.com/a/b/')).toEqual([]);
  });

  it('does not accept empty/truncated feeds for nonempty boards', async () => {
    mock.mockImplementationOnce(() => answer(board(2)))
      .mockImplementationOnce(() => answer(page([], '-end-')));
    await expect(fetchBoard('https://pinterest.com/a/b/')).rejects.toThrow('Incomplete');
  });

  it('does not treat missing pagination as a complete board', async () => {
    mock.mockImplementationOnce(() => answer(board(2)))
      .mockImplementationOnce(() => answer(page(['1'])));
    await expect(fetchBoard('https://pinterest.com/a/b/')).rejects.toThrow('pagination');
  });

  it('detects repeated bookmarks', async () => {
    mock.mockImplementationOnce(() => answer(board(2)))
      .mockImplementationOnce(() => answer(page(['1'], 'same')))
      .mockImplementationOnce(() => answer(page(['1'], 'same')));
    await expect(fetchBoard('https://pinterest.com/a/b/')).rejects.toThrow('pagination');
  });

  it('reports rate limits without partial results', async () => {
    mock.mockImplementationOnce(() => answer(board(2)))
      .mockImplementationOnce(() => answer({}, 429));
    await expect(fetchBoard('https://pinterest.com/a/b/')).rejects.toThrow('rate limit');
  });

  it('reports offline failures without partial results', async () => {
    mock.mockRejectedValue(new Error('Offline'));
    await expect(fetchBoard('https://pinterest.com/a/b/')).rejects.toThrow('Offline');
  });

  it('resolves metadata from HTML hydration when BoardResource is blocked', async () => {
    const hydration = { props: { board: { id: '123', type: 'board', url: '/a/b/', pin_count: 1 } } };
    mock.mockImplementationOnce(() => answer({}, 403))
      .mockImplementationOnce(() => Promise.resolve({ status: 200,
        text: `<html><script type="application/json">${JSON.stringify(hydration)}</script></html>`,
        headers: {}, json: {}, arrayBuffer: new ArrayBuffer(0),
      }) as ReturnType<typeof requestUrl>)
      .mockImplementationOnce(() => answer(page(['1'], '-end-')));
    expect(await fetchBoard('https://pinterest.com/a/b/')).toHaveLength(1);
  });

  function htmlAnswer(value: unknown): ReturnType<typeof requestUrl> {
    return Promise.resolve({ status: 200, headers: {}, json: {}, arrayBuffer: new ArrayBuffer(0),
      text: `<html><script type="application/json">${JSON.stringify(value)}</script></html>`,
    }) as ReturnType<typeof requestUrl>;
  }

  it('explains the HTTP-200 login wall returned for the reported board', async () => {
    mock.mockImplementationOnce(() => answer({}, 403))
      .mockImplementationOnce(() => htmlAnswer({
        context: { is_authenticated: false, current_url: 'https://www.pinterest.com/finnxwz/tattoos/' },
        experiments: { active: { lop_unauth_lockdown_board: 'enabled' } },
        initialReduxState: { boards: {}, resources: {} },
      }));
    await expect(fetchBoard('https://de.pinterest.com/finnxwz/tattoos/'))
      .rejects.toThrow('Pinterest requires sign-in');
    expect(mock).toHaveBeenCalledTimes(2); // no feed or destructive sync
  });

  it('retains the original request error when HTML has no recognizable board', async () => {
    mock.mockImplementationOnce(() => answer({}, 403))
      .mockImplementationOnce(() => htmlAnswer({ initialReduxState: { boards: {} } }));
    await expect(fetchBoard('https://pinterest.com/a/b/')).rejects.toThrow('HTTP 403');
  });

  it('still accepts real board data when the page also contains a rollout flag', async () => {
    mock.mockImplementationOnce(() => answer({}, 403))
      .mockImplementationOnce(() => htmlAnswer({
        context: { is_authenticated: false },
        experiments: { active: { lop_unauth_lockdown_board: 'enabled' } },
        board: { id: '123', type: 'board', url: '/a/b/', pin_count: 1 },
      }))
      .mockImplementationOnce(() => answer(page(['1'], '-end-')));
    expect(await fetchBoard('https://pinterest.com/a/b/')).toHaveLength(1);
  });
});
