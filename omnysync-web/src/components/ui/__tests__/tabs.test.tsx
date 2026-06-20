import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs'

describe('Tabs', () => {
  it('renders tab triggers', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    expect(screen.getByRole('tab', { name: /tab 1/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /tab 2/i })).toBeInTheDocument()
  })

  it('shows content of default tab', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    expect(screen.getByText('Content 1')).toBeInTheDocument()
  })

  it('switches content when clicking different tab', async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    await user.click(screen.getByRole('tab', { name: /tab 2/i }))

    expect(screen.getByText('Content 2')).toBeInTheDocument()
  })

  it('calls onValueChange when tab changes', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Tabs defaultValue="tab1" onValueChange={handleChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    await user.click(screen.getByRole('tab', { name: /tab 2/i }))
    expect(handleChange).toHaveBeenCalledWith('tab2')
  })

  it('applies custom className to TabsList', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList className="custom-list">
          <TabsTrigger value="a">Tab A</TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const tabList = screen.getByRole('tablist')
    expect(tabList).toHaveClass('custom-list')
    expect(tabList).toHaveClass('bg-muted')
  })

  it('applies custom className to TabsTrigger', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a" className="custom-trigger">
            Custom Tab
          </TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const tab = screen.getByRole('tab', { name: /custom tab/i })
    expect(tab).toHaveClass('custom-trigger')
  })

  it('renders disabled tab trigger', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Active</TabsTrigger>
          <TabsTrigger value="b" disabled>
            Disabled
          </TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const disabledTab = screen.getByRole('tab', {
      name: /disabled/i,
    })
    expect(disabledTab).toBeDisabled()
    expect(disabledTab).toHaveClass('disabled:opacity-50')
  })

  it('shows active tab with correct styling', async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">First</TabsTrigger>
          <TabsTrigger value="b">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="a">First content</TabsContent>
        <TabsContent value="b">Second content</TabsContent>
      </Tabs>
    )

    const firstTab = screen.getByRole('tab', { name: /first/i })
    expect(firstTab).toHaveAttribute('data-state', 'active')

    await user.click(screen.getByRole('tab', { name: /second/i }))
    expect(firstTab).toHaveAttribute('data-state', 'inactive')
  })

  describe('keyboard navigation', () => {
    it('navigates to next tab with ArrowRight', async () => {
      const user = userEvent.setup()

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      )

      const firstTab = screen.getByRole('tab', { name: /tab 1/i })
      firstTab.focus()
      await user.keyboard('{ArrowRight}')

      expect(screen.getByText('Content 2')).toBeInTheDocument()
    })

    it('navigates to previous tab with ArrowLeft', async () => {
      const user = userEvent.setup()

      render(
        <Tabs defaultValue="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      )

      const secondTab = screen.getByRole('tab', { name: /tab 2/i })
      secondTab.focus()
      await user.keyboard('{ArrowLeft}')

      expect(screen.getByText('Content 1')).toBeInTheDocument()
    })

    it('does not switch to disabled tab via click', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(
        <Tabs defaultValue="a" onValueChange={handleChange}>
          <TabsList>
            <TabsTrigger value="a">Active</TabsTrigger>
            <TabsTrigger value="b" disabled>
              Disabled
            </TabsTrigger>
          </TabsList>
          <TabsContent value="a">Content A</TabsContent>
          <TabsContent value="b">Content B</TabsContent>
        </Tabs>
      )

      await user.click(screen.getByRole('tab', { name: /disabled/i }))
      // Disabled tab should not trigger change
      expect(handleChange).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('tablist has proper role', () => {
      render(
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Tab</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      expect(screen.getByRole('tablist')).toBeInTheDocument()
    })

    it('tabs have aria-controls and aria-selected attributes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      )

      const activeTab = screen.getByRole('tab', { name: /tab 1/i })
      expect(activeTab).toHaveAttribute('aria-selected', 'true')
      expect(activeTab).toHaveAttribute('aria-controls')

      const inactiveTab = screen.getByRole('tab', { name: /tab 2/i })
      expect(inactiveTab).toHaveAttribute('aria-selected', 'false')
    })
  })
})
