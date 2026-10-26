import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunManifest } from '../run-manifest'

const labels = {
  console: 'Routing console',
  live: 'Live run',
  source: 'Source',
  destinations: 'Destinations',
  parse: 'Parse',
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
    expect(screen.getByText('Publish')).toBeInTheDocument()
    expect(screen.getByText('WordPress')).toBeInTheDocument()
    expect(screen.queryByText('Ghost')).not.toBeInTheDocument()
  })

  it('shows one completed destination and does not invent a duration', () => {
    render(<RunManifest labels={labels} />)

    expect(screen.getByText('Synchronized')).toBeInTheDocument()
    expect(screen.queryByText('Syncing')).not.toBeInTheDocument()
    expect(screen.getByText('00 Errors')).toBeInTheDocument()
    expect(screen.queryByText('12.4s')).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
