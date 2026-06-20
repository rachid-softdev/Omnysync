import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card'

describe('Card', () => {
  it('renders with content', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders CardHeader', () => {
    render(
      <Card>
        <CardHeader>Header</CardHeader>
      </Card>
    )
    expect(screen.getByText('Header')).toBeInTheDocument()
  })

  it('renders CardTitle as h3', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
        </CardHeader>
      </Card>
    )
    const title = screen.getByText('Card Title')
    expect(title.tagName).toBe('H3')
    expect(title).toHaveClass('text-2xl')
    expect(title).toHaveClass('font-semibold')
  })

  it('renders CardDescription', () => {
    render(
      <Card>
        <CardHeader>
          <CardDescription>Description text</CardDescription>
        </CardHeader>
      </Card>
    )
    const desc = screen.getByText('Description text')
    expect(desc.tagName).toBe('P')
    expect(desc).toHaveClass('text-muted-foreground')
  })

  it('renders CardContent', () => {
    render(
      <Card>
        <CardContent>Content area</CardContent>
      </Card>
    )
    expect(screen.getByText('Content area')).toBeInTheDocument()
  })

  it('renders CardFooter with flex layout', () => {
    render(
      <Card>
        <CardFooter>
          <button>Action</button>
        </CardFooter>
      </Card>
    )
    const footer = screen.getByText('Action').closest('div')
    expect(footer).toHaveClass('flex')
    expect(footer).toHaveClass('items-center')
  })

  it('renders a complete card with all subcomponents', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Complete Card</CardTitle>
          <CardDescription>With all parts</CardDescription>
        </CardHeader>
        <CardContent>Main content here</CardContent>
        <CardFooter>
          <button>Submit</button>
        </CardFooter>
      </Card>
    )

    expect(screen.getByText('Complete Card')).toBeInTheDocument()
    expect(screen.getByText('With all parts')).toBeInTheDocument()
    expect(screen.getByText('Main content here')).toBeInTheDocument()
    expect(screen.getByText('Submit')).toBeInTheDocument()
  })

  it('applies custom className to all parts', () => {
    const { container } = render(
      <Card className="card-custom">
        <CardHeader className="header-custom">
          <CardTitle className="title-custom">Title</CardTitle>
          <CardDescription className="desc-custom">Desc</CardDescription>
        </CardHeader>
        <CardContent className="content-custom">Content</CardContent>
        <CardFooter className="footer-custom">Footer</CardFooter>
      </Card>
    )

    expect(screen.getByText('Title')).toHaveClass('title-custom')
    expect(screen.getByText('Desc')).toHaveClass('desc-custom')
    expect(screen.getByText('Content')).toHaveClass('content-custom')
    expect(screen.getByText('Footer')).toHaveClass('footer-custom')
  })

  it('has border and shadow classes', () => {
    const { container } = render(<Card>Bordered</Card>)
    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('border')
    expect(card).toHaveClass('shadow-sm')
    expect(card).toHaveClass('rounded-lg')
  })
})
