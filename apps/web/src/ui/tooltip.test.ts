import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOOLTIP_W, tooltipAnchor } from './tooltip.ts'

const slot = (left: number, top: number) => ({ left, top, bottom: top + 48, width: 48 })

test('a slot in open space centres its tooltip under it', () => {
    const anchor = tooltipAnchor(slot(500, 100), 1400, 900)
    assert.equal(anchor.left, 500 + 24 - TOOLTIP_W / 2)
    assert.equal(anchor.above, false)
    assert.equal(anchor.top, 154)
})

test('a slot near the left edge keeps its tooltip on screen', () => {
    // This is the Inventory's Main hand slot in a narrow window: centred would be off-screen.
    const anchor = tooltipAnchor(slot(40, 100), 1039, 800)
    assert.ok(anchor.left >= 0, `left was ${anchor.left}`)
    assert.equal(anchor.left, 8)
})

test('a slot near the right edge keeps its tooltip on screen', () => {
    const anchor = tooltipAnchor(slot(1360, 100), 1400, 900)
    assert.ok(anchor.left + TOOLTIP_W <= 1400, `right edge was ${anchor.left + TOOLTIP_W}`)
})

test('a slot in the lower half flips its tooltip above', () => {
    const anchor = tooltipAnchor(slot(500, 700), 1400, 900)
    assert.equal(anchor.above, true)
    assert.equal(anchor.top, 694)
})

test('every slot position stays on screen, at every window size worth caring about', () => {
    for (const [width, height] of [[360, 640], [820, 700], [1039, 797], [1920, 1080]]) {
        for (let left = 0; left <= width - 48; left += 8) {
            for (const top of [0, height / 2, height - 48]) {
                const anchor = tooltipAnchor(slot(left, top), width, height)
                assert.ok(anchor.left >= 0, `${width}x${height} left=${left}: ${anchor.left}`)
                assert.ok(anchor.top >= 0, `${width}x${height} top=${top}: ${anchor.top}`)
                // On a window narrower than the tooltip, hugging the edge is the best it can do.
                if (width >= TOOLTIP_W + 16) {
                    assert.ok(anchor.left + TOOLTIP_W <= width,
                        `${width}x${height} left=${left} overflowed to ${anchor.left + TOOLTIP_W}`)
                }
            }
        }
    }
})
