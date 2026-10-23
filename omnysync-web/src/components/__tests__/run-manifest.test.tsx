import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunManifest } from '../run-manifest'

const labels = {
  console: 'Routing console',
  live: 'Live run',
  source: 'Source',
  destinations: 'Destinations',
  parse: 'Parse',
  enrich: 'Enrich',
  publish: 'Publish',
  synced: 'Synchronized',
  syncing: 'Syncing',
  errors: 'Errors',
  duration: 'Duration',
}

describe('RunManifest', () => {
  it('renders the source, pipeline and destinations', () => {
    render(<RunManifest labels={labels} />)

    expect(screen.getByText('Live run')).toBeInTheDocument()
    expect(screen.getByText('launch-notes.md')).toBeInTheDocument()
    expect(screen.getByText('Parse')).toBeInTheDocument()
    expect(screen.getByText('Enrich')).toBeInTheDocument()
    expect(screen.getByText('Publish')).toBeInTheDocument()

    for (const destination of ['WordPress', 'Ghost', 'Webflow', 'Shopify']) {
      expect(screen.getByText(destination)).toBeInTheDocument()
    }
  })

  it('distinguishes completed and in-flight destinations', () => {
    render(<RunManifest labels={labels} />)

    expect(screen.getAllByText('Synchronized')).toHaveLength(3)
    expect(screen.getByText('Syncing')).toBeInTheDocument()
    expect(screen.getByText('00 Errors')).toBeInTheDocument()
    expect(screen.getByText('12.4s')).toBeInTheDocument()
  })
})
