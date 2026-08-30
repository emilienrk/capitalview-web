import { beforeEach, describe, expect, it } from 'vitest'
import {
  BASE_MODAL_Z_INDEX,
  acquireModalZIndex,
  releaseModalZIndex,
} from '../modalStack'

/** Drain the shared counter so each test starts from the floor. */
function reset(): void {
  for (let i = 0; i < 20; i += 1) releaseModalZIndex()
}

describe('modalStack', () => {
  beforeEach(reset)

  it('gives the modal opened last the higher z-index', () => {
    const first = acquireModalZIndex()
    const second = acquireModalZIndex()
    expect(second).toBeGreaterThan(first)
  })

  it('starts above the app chrome', () => {
    expect(acquireModalZIndex()).toBeGreaterThan(BASE_MODAL_Z_INDEX)
  })

  it('does not reuse a slot still held by an open modal', () => {
    const parent = acquireModalZIndex()
    acquireModalZIndex() // confirm dialog on top
    releaseModalZIndex() // …dismissed, parent stays open
    // The next modal must clear the parent, not tie with it.
    expect(acquireModalZIndex()).toBeGreaterThan(parent)
  })

  it('returns to the floor once every modal is closed', () => {
    const first = acquireModalZIndex()
    acquireModalZIndex()
    releaseModalZIndex()
    releaseModalZIndex()
    expect(acquireModalZIndex()).toBe(first)
  })

  it('ignores a release with nothing open, so the counter cannot go negative', () => {
    releaseModalZIndex()
    releaseModalZIndex()
    expect(acquireModalZIndex()).toBe(BASE_MODAL_Z_INDEX + 1)
  })
})
