import { useState, type MouseEvent } from 'react'
import { baseById, formatMod, modById, sellPrice, type Item, type Rarity } from '@dei/game'
import { TOOLTIP_W, tooltipAnchor, type Anchor } from './tooltip'

const RARITY_CLASS: Record<Rarity, string> = {
    normal: 'rarity-normal',
    magic: 'rarity-magic',
    rare: 'rarity-rare',
}

const iconUrl = (item: Item) => `/assets/icons/items/${baseById(item.baseId).icon}`

const anchorTo = (element: HTMLElement): Anchor =>
    tooltipAnchor(element.getBoundingClientRect(), window.innerWidth, window.innerHeight)

/** A slot with an item in it: PONETI frame, rarity border, durability bar, "new" dot. */
export function ItemSlot({ item, onClick }: { item: Item | null; onClick?: () => void }) {
    const [anchor, setAnchor] = useState<Anchor | null>(null)

    if (!item) return <div className="slot slot-empty" />

    const durability = item.durability / item.maxDurability
    return (
        <button
            className={`slot ${RARITY_CLASS[item.rarity]}`}
            onClick={onClick}
            onMouseEnter={(event: MouseEvent<HTMLButtonElement>) => setAnchor(anchorTo(event.currentTarget))}
            onMouseLeave={() => setAnchor(null)}
            type="button"
        >
            <img src={iconUrl(item)} alt="" draggable={false} />
            {item.isNew && <span className="new-dot" aria-label="new" />}
            {durability < 1 && (
                <span className="durability">
                    <span style={{ width: `${Math.max(0, durability) * 100}%` }} />
                </span>
            )}
            {anchor && <Tooltip item={item} anchor={anchor} />}
        </button>
    )
}

function Tooltip({ item, anchor }: { item: Item; anchor: Anchor }) {
    const base = baseById(item.baseId)
    const broken = item.durability <= 0
    return (
        <span
            className="tooltip"
            style={{
                left: anchor.left,
                top: anchor.top,
                width: TOOLTIP_W,
                transform: anchor.above ? 'translateY(-100%)' : undefined,
            }}
        >
            <strong className={RARITY_CLASS[item.rarity]}>{base.name}</strong>
            <em>
                item level {item.itemLevel}
                {base.twoHanded && ' · two-handed'}
                {base.physical && ` · ${base.physical[0]}–${base.physical[1]} physical`}
            </em>
            {item.mods.map((mod) => (
                <span key={mod.modId} className="mod">
                    <span className="tier">T{mod.tier}</span> {formatMod(mod)}
                    <span className="affix">{modById(mod.modId).type === 'prefix' ? 'P' : 'S'}</span>
                </span>
            ))}
            {broken
                ? <span className="broken">Broken — gives no stats</span>
                : <span className="dim">durability {Math.floor(item.durability)}/{item.maxDurability}</span>}
            <span className="dim">sells for {sellPrice(item)} gold</span>
        </span>
    )
}
