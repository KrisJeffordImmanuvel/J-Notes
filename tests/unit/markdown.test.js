import { describe, it, expect, beforeEach } from 'vitest';
import { renderMd, plain, setAttachmentResolver } from '../../src/lib/markdown.js';

describe('renderMd', () => {
  beforeEach(() => setAttachmentResolver(() => null));

  it('renders headings, emphasis, highlight and code', () => {
    const html = renderMd('# Title\n\n**bold** *it* ==hi== `x<y`');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>it</em>');
    expect(html).toContain('<mark>hi</mark>');
    expect(html).toContain('<code>x&lt;y</code>');
  });

  it('renders task lists with source line numbers', () => {
    const html = renderMd('intro\n\n- [ ] one\n- [x] two');
    expect(html).toContain('data-line="2"');
    expect(html).toMatch(/<li class="task done"><input type="checkbox" data-line="3" checked/);
  });

  it('makes checkboxes inside quotes read-only (their line numbers are relative)', () => {
    expect(renderMd('> - [ ] quoted')).toContain('disabled');
  });

  it('renders tables, blockquotes, rules and fenced code', () => {
    const html = renderMd('| a | b |\n| --- | --- |\n| 1 | 2 |\n\n> quote\n\n---\n\n```\n<b>\n```');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('<td>2</td>');
    expect(html).toContain('<blockquote><p>quote</p></blockquote>');
    expect(html).toContain('<hr>');
    expect(html).toContain('<pre><code>&lt;b&gt;</code></pre>');
  });

  describe('XSS safety', () => {
    const cases = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '[click](javascript:alert(1))',
      '![x](javascript:alert(1))',
      '[x](https://a.b/"onmouseover="alert(1))',
      '![a" onerror="alert(1)](https://x/y.png)',
      '[[a" onclick="alert(1)]]'
    ];
    for (const c of cases) {
      it(`neutralises ${c}`, () => {
        const html = renderMd(c, { wiki: true });
        expect(html).not.toMatch(/<script/i);
        expect(html).not.toMatch(/\son\w+="/i);
        expect(html).not.toMatch(/href="javascript:/i);
        expect(html).not.toMatch(/src="javascript:/i);
      });
    }
  });

  it('only links safe URLs', () => {
    expect(renderMd('[ok](https://example.com)')).toContain('<a href="https://example.com"');
    expect(renderMd('[bad](data:text/html,hi)')).not.toContain('<a ');
  });

  it('resolves attachment images through the registered resolver', () => {
    setAttachmentResolver(id => id === 'abc' ? 'data:image/png;base64,AAAA' : null);
    expect(renderMd('![pic](attachment:abc)')).toContain('src="data:image/png;base64,AAAA"');
    expect(renderMd('![pic](attachment:zzz)')).toContain('[missing image]');
  });

  it('renders wiki links only in power mode', () => {
    expect(renderMd('see [[Other]]')).not.toContain('wikilink');
    expect(renderMd('see [[Other]]', { wiki: true })).toContain('class="wikilink" data-title="Other"');
  });
});

describe('plain', () => {
  it('strips markdown syntax for snippets', () => {
    expect(plain('# Hi **there** [link](https://x) ![img](y)')).toBe('Hi there link');
  });
});
