import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn', () => {
  it('merges multiple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles a single class', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('handles empty arguments', () => {
    expect(cn()).toBe('')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', false, null, undefined, 0, 'bar')).toBe('foo bar')
  })

  it('handles conditional class objects', () => {
    expect(cn('base', { foo: true, bar: false, baz: true })).toBe('base foo baz')
  })

  it('handles conditional class objects with all false', () => {
    expect(cn({ foo: false, bar: false })).toBe('')
  })

  it('handles conditional class objects with all true', () => {
    expect(cn({ foo: true, bar: true })).toBe('foo bar')
  })

  it('resolves tailwind conflicts (later wins)', () => {
    // tailwind-merge should resolve conflicting utility classes
    const result = cn('px-4', 'px-6')
    expect(result).toBe('px-6')
  })

  it('resolves padding conflicts', () => {
    const result = cn('p-2', 'p-4')
    expect(result).toBe('p-4')
  })

  it('resolves margin conflicts', () => {
    const result = cn('m-2', 'm-4')
    expect(result).toBe('m-4')
  })

  it('resolves color conflicts', () => {
    const result = cn('text-red-500', 'text-blue-600')
    expect(result).toBe('text-blue-600')
  })

  it('merges non-conflicting classes from both sides', () => {
    const result = cn('text-red-500', 'bg-blue-600')
    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-blue-600')
  })

  it('handles arrays of classes', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })

  it('handles nested arrays', () => {
    expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz')
  })

  it('handles mixed arguments (strings, objects, arrays)', () => {
    expect(cn('base', { conditional: true }, ['array-item'])).toBe('base conditional array-item')
  })

  it('preserves important modifiers', () => {
    const result = cn('hover:bg-red-500', 'hover:bg-blue-600')
    expect(result).toBe('hover:bg-blue-600')
  })

  it('handles responsive prefixes', () => {
    const result = cn('sm:p-4', 'md:p-6', 'lg:p-8')
    expect(result).toBe('sm:p-4 md:p-6 lg:p-8')
  })
})
