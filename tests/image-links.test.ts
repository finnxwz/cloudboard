import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { imageUrl, markdownImageUrl, parsePinPreview, resolveImageLink } from '../src/image-links';
import { setLanguage } from '../src/i18n';

const mock = vi.mocked(requestUrl);
beforeEach(() => { mock.mockReset(); setLanguage('de'); });

function response(text: string, status = 200): ReturnType<typeof requestUrl> {
  return Promise.resolve({ text, status, headers: {}, json: {}, arrayBuffer: new ArrayBuffer(0) }) as ReturnType<typeof requestUrl>;
}

describe('manual image links', () => {
  it('migrates earlier Markdown image cards including escaped titles and URL parentheses', () => {
    expect(markdownImageUrl('![A \\[title\\]](<https://i.pinimg.com/a(b).jpg>)\n\n**Title**'))
      .toBe('https://i.pinimg.com/a(b).jpg');
    expect(markdownImageUrl('![Photo](https://i.pinimg.com/a.jpg)')).toBe('https://i.pinimg.com/a.jpg');
    expect(markdownImageUrl('![[Photo.jpg]]')).toBeNull();
    expect(markdownImageUrl('![Unsafe](<javascript:alert(1)>)')).toBeNull();
  });
  it('stores direct image URLs without a network request or download', async () => {
    const image = await resolveImageLink('https://images.example.org/photo.jpg?size=large');
    expect(image.imageUrl).toBe('https://images.example.org/photo.jpg?size=large');
    expect(mock).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', 'file:///C:/photo.png', 'data:image/png,123',
    'http://example.org/image.jpg', 'https://user:password@example.org/image.jpg'])
    ('rejects unsafe image links: %s', value => expect(() => imageUrl(value)).toThrow());

  it('extracts escaped Open Graph values with different attribute orders and casing', () => {
    const image = parsePinPreview(`
      <META content='https://i.pinimg.com/originals/photo.jpg?a=1&amp;b=2' property="og:image">
      <meta name="og:title" content="Tattoo &quot;A&quot; &amp; B">
      <meta content="1000" property="og:image:width">
      <meta property="og:image:height" content="1500">
      <script>throw new Error('never execute')</script>
    `, 'https://www.pinterest.com/pin/123/');
    expect(image).toMatchObject({
      imageUrl: 'https://i.pinimg.com/originals/photo.jpg?a=1&b=2',
      title: 'Tattoo "A" & B', width: 1000, height: 1500,
    });
  });

  it('uses only publicly returned preview metadata for Pinterest pins', async () => {
    mock.mockImplementationOnce(() => response('<meta property="og:image" content="https://i.pinimg.com/originals/image.jpg">'));
    const image = await resolveImageLink('https://de.pinterest.com/pin/123456/?tracking=1');
    expect(image.sourceUrl).toBe('https://www.pinterest.com/pin/123456/');
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0]![0]).toMatchObject({ url: image.sourceUrl, throw: false });
  });

  it('explains what to do when a pin is blocked instead of claiming success', async () => {
    mock.mockImplementationOnce(() => response('<html>Log in</html>'));
    await expect(resolveImageLink('https://pinterest.com/pin/123/')).rejects.toThrow('Bildadresse kopieren');
    mock.mockImplementationOnce(() => response('Forbidden', 403));
    await expect(resolveImageLink('https://pinterest.com/pin/123/')).rejects.toThrow('HTTP 403');
  });

  it('rejects non-Pinterest images injected into Pinterest metadata', () => {
    expect(() => parsePinPreview('<meta property="og:image" content="https://evil.org/image.jpg">',
      'https://www.pinterest.com/pin/123/')).toThrow('gültiges Pinterest-Vorschaubild');
  });

  it('does not mistake a board or short link for an image', async () => {
    await expect(resolveImageLink('https://pinterest.com/user/board/')).rejects.toThrow('keine Board-URL');
    await expect(resolveImageLink('https://pin.it/abc')).rejects.toThrow('Kurzlink');
    expect(mock).not.toHaveBeenCalled();
  });

  it('preserves offline errors and clears the request timeout', async () => {
    mock.mockRejectedValueOnce(new Error('Offline'));
    await expect(resolveImageLink('https://www.pinterest.com/pin/123/')).rejects.toThrow('Offline');
  });
});
