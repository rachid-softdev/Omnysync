import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '../table'

describe('Table', () => {
  it('renders basic table structure', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>John</TableCell>
            <TableCell>john@test.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('John')).toBeInTheDocument()
    expect(screen.getByText('john@test.com')).toBeInTheDocument()
  })

  it('renders TableFooter', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Data</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Footer</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )

    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('renders TableCaption', () => {
    render(
      <Table>
        <TableCaption>List of items</TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>Item</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(screen.getByText('List of items')).toBeInTheDocument()
  })

  it('applies custom className to Table', () => {
    const { container } = render(
      <Table className="custom-table">
        <TableBody>
          <TableRow>
            <TableCell>Test</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    const table = container.querySelector('table')
    expect(table).toHaveClass('custom-table')
    expect(table).toHaveClass('w-full')
  })

  it('applies custom className to TableHeader', () => {
    const { container } = render(
      <Table>
        <TableHeader className="custom-header">
          <TableRow>
            <TableHead>Head</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    )

    const thead = container.querySelector('thead')
    expect(thead).toHaveClass('custom-header')
  })

  it('applies custom className to TableRow', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow className="custom-row">
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    const row = container.querySelector('tr')
    expect(row).toHaveClass('custom-row')
    expect(row).toHaveClass('border-b')
  })

  it('applies custom className to TableHead and TableCell', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="head-custom">Head</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="cell-custom">Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(screen.getByText('Head')).toHaveClass('head-custom')
    expect(screen.getByText('Cell')).toHaveClass('cell-custom')
  })

  it('renders table with proper semantic elements', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>H</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>C</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(container.querySelector('table')).toBeInTheDocument()
    expect(container.querySelector('thead')).toBeInTheDocument()
    expect(container.querySelector('tbody')).toBeInTheDocument()
    expect(container.querySelector('tr')).toBeInTheDocument()
    expect(container.querySelector('th')).toBeInTheDocument()
    expect(container.querySelector('td')).toBeInTheDocument()
  })

  it('TableHead has proper alignment classes', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aligned</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    )

    const th = container.querySelector('th')
    expect(th).toHaveClass('text-left')
    expect(th).toHaveClass('font-medium')
  })
})
