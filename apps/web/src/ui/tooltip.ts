export const TOOLTIP_W = 240
const GAP = 6 // space between the slot and the tooltip
const EDGE = 8 // never let the tooltip touch the window edge

export interface Anchor {
    left: number
    top: number
    /** True when the tooltip sits above the slot and must be pulled up by its own height. */
    above: boolean
}

/** Spelled out rather than `Pick<DOMRect, …>`: this module must not need the DOM to be tested. */
interface Rect {
    left: number
    top: number
    bottom: number
    width: number
}

/**
 * Where to put a tooltip for a slot. Pure, so it can be tested without a browser.
 *
 * The tooltip is `position: fixed` (the Inventory panel scrolls, and an absolute tooltip gets
 * clipped by that), which means it is placed in viewport coordinates and has to be kept inside
 * the viewport by hand: a slot near the left edge would otherwise centre its tooltip off-screen.
 */
export function tooltipAnchor(rect: Rect, viewportWidth: number, viewportHeight: number): Anchor {
    const centred = rect.left + rect.width / 2 - TOOLTIP_W / 2
    const rightmost = Math.max(EDGE, viewportWidth - TOOLTIP_W - EDGE)
    const left = Math.min(Math.max(EDGE, centred), rightmost)

    // Flip above the slot only when the slot is in the lower half, where there is no room below.
    const above = rect.top > viewportHeight / 2
    return { left, top: above ? rect.top - GAP : rect.bottom + GAP, above }
}
