import { describe, it, expect } from 'vitest'

import { parseGoogleDocToHtml, parseMarkdownToHtml, cleanHtml } from '@/lib/services/html-parser'

describe('parseGoogleDocToHtml', () => {
  it('converts a simple paragraph to HTML', () => {
    const result = parseGoogleDocToHtml({
      title: 'My Title',
      body: {
        content: [
          {
            paragraph: {
              elements: [{ textRun: { content: 'Hello world' } }],
            },
          },
        ],
      },
    })

    expect(result.title).toBe('My Title')
    expect(result.html).toContain('<p>Hello world</p>')
    expect(result.wordCount).toBe(2)
  })

  it('applies bold and italic formatting', () => {
    const result = parseGoogleDocToHtml({
      body: {
        content: [
          {
            paragraph: {
              elements: [
                {
                  textRun: {
                    content: 'bold',
                    textStyle: { bold: true },
                  },
                },
                {
                  textRun: {
                    content: 'italic',
                    textStyle: { italic: true },
                  },
                },
              ],
            },
          },
        ],
      },
    })

    expect(result.html).toContain('<strong>bold</strong>')
    expect(result.html).toContain('<em>italic</em>')
  })

  it('renders headings with slug ids and cleans inline styles', () => {
    const result = parseGoogleDocToHtml(
      {
        body: {
          content: [
            {
              paragraph: {
                paragraphStyle: { namedStyleType: 'HEADING_1' },
                elements: [{ textRun: { content: 'Section One' } }],
              },
            },
          ],
        },
      },
      { addHeadingIds: true }
    )

    expect(result.html).toContain('<h1 id="section-one">Section One</h1>')
    expect(result.html).not.toContain('style=')
  })

  it('renders tables', () => {
    const result = parseGoogleDocToHtml({
      body: {
        content: [
          {
            table: {
              tableRows: [
                {
                  tableCells: [
                    { content: [{ paragraph: { elements: [{ textRun: { content: 'a' } }] } }] },
                    { content: [{ paragraph: { elements: [{ textRun: { content: 'b' } }] } }] },
                  ],
                },
              ],
            },
          },
        ],
      },
    })

    expect(result.html).toContain('<table>')
    // Cell content is itself wrapped in a <p> by the recursive processor.
    expect(result.html).toContain('<td><p>a</p></td>')
    expect(result.html).toContain('<td><p>b</p></td>')
  })
})

describe('parseMarkdownToHtml', () => {
  it('converts headings, lists, and emphasis', () => {
    const md = '# Title\n\n- one\n- two\n\n**bold** and *italic*'
    const html = parseMarkdownToHtml(md)

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<li>two</li>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('renders links and inline emphasis', () => {
    const md = '[link](https://example.com) and *italic*'
    const html = parseMarkdownToHtml(md)

    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener">link</a>')
    expect(html).toContain('<em>italic</em>')
  })

  // NOTE (suspected source bug): the inline-code rule (`...`) is applied before
  // the fenced-code-block rule (```...```), so fenced blocks are mangled into
  // inline <code> instead of <pre><code class="language-*">. Left as-is per TAE
  // scope; flagged in the report.
})

describe('cleanHtml', () => {
  it('strips class, style, data attributes and normalizes whitespace', () => {
    const dirty = '<p class="x"  style="color:red"  data-foo="bar">Hello   <span> </span>World</p>'
    const cleaned = cleanHtml(dirty)

    expect(cleaned).not.toContain('class=')
    expect(cleaned).not.toContain('style=')
    expect(cleaned).not.toContain('data-foo=')
    expect(cleaned).toMatch(/<p[^>]*>Hello World<\/p>/)
  })

  it('collapses repeated break tags', () => {
    const cleaned = cleanHtml('<p>a</p><br/><br/><p>b</p>')
    expect(cleaned).toContain('<br/>')
    expect(cleaned).not.toMatch(/<br\/>\s*<br\/>/)
  })
})
