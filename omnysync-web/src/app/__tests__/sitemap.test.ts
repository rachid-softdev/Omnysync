import { describe, it, expect } from 'vitest'
import sitemap from '../sitemap'

describe('sitemap', () => {
  it('does not advertise the missing /blog route', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls.some((url) => url.endsWith('/blog'))).toBe(false)
  })

  it('keeps the public pages discoverable', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls.some((url) => url.endsWith('/pricing'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/auth/signin'))).toBe(true)
  })
})
