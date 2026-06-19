/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectorIcon } from './connector-icon'

describe('ConnectorIcon', () => {
  it('renders GOOGLE_DOCS icon', () => {
    const { container } = render(<ConnectorIcon type="GOOGLE_DOCS" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders WORDPRESS icon', () => {
    const { container } = render(<ConnectorIcon type="WORDPRESS" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders fallback for unknown type', () => {
    render(<ConnectorIcon type="UNKNOWN" />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<ConnectorIcon type="NOTION" className="custom-class" />)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('custom-class')
  })

  it('renders AIRTABLE icon', () => {
    const { container } = render(<ConnectorIcon type="AIRTABLE" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
