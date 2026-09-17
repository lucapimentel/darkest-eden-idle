import { useState } from 'react'
import {
    SLOTS, baseById, equip, heroStats, markSeen, rescue, sell, unequip,
    type ActionResult, type SaveState, type Slot,
} from '@dei/game'
import { ItemSlot } from './Item'

const SLOT_LABEL: Record<Slot, string> = {
    mainhand: 'Main hand',
    offhand: 'Off-hand',
    helm: 'Helm',
    chest: 'Chest',
    boots: 'Boots',
}

export function Inventory({ save, mutate, onClose }: {
    save: SaveState
    mutate: (change: (save: SaveState) => void) => void
    onClose: () => void
}) {
    const [refusal, setRefusal] = useState<string | null>(null)
    const stats = heroStats(save.hero)

    // Every action settles a claim first (mutate does that), so rewards always use the stats
    // that earned them. A habit in M2; a correctness requirement from M4 on.
    const act = (action: (save: SaveState) => ActionResult) => {
        mutate((draft) => {
            const outcome = action(draft)
            setRefusal(outcome.ok ? null : outcome.reason)
        })
    }

    const twoHanded = save.hero.equipped.mainhand
        && baseById(save.hero.equipped.mainhand.baseId).twoHanded

    return (
        <div className="panel-backdrop" onClick={onClose}>
            <div className="panel" onClick={(event) => event.stopPropagation()}>
                <header>
                    <h2>Inventory</h2>
                    <button type="button" onClick={onClose}>close</button>
                </header>

                <div className="panel-body">
                    <section className="equipment">
                        <h3>Equipment</h3>
                        <div className="equipment-grid">
                            {SLOTS.map((slot) => (
                                <div key={slot} className="equipment-slot">
                                    <ItemSlot
                                        item={save.hero.equipped[slot] ?? null}
                                        onClick={() => act((draft) => unequip(draft, slot))}
                                    />
                                    <span className="slot-name">
                                        {SLOT_LABEL[slot]}
                                        {slot === 'offhand' && twoHanded && <em> (locked)</em>}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <h3>Hero</h3>
                        <dl className="stats">
                            <div><dt>Level</dt><dd>{stats.level}</dd></div>
                            <div><dt>Life</dt><dd>{stats.maxLife}</dd></div>
                            <div><dt>Energy shield</dt><dd>{stats.maxEnergyShield}</dd></div>
                            <div><dt>Armour</dt><dd>{stats.armour}</dd></div>
                            <div><dt>Evasion</dt><dd>{stats.evasion}</dd></div>
                            <div><dt>Block</dt><dd>{stats.blockChance}%</dd></div>
                            <div><dt>Str / Dex / Int</dt><dd>{stats.str} / {stats.dex} / {stats.int}</dd></div>
                            <div><dt>Damage</dt><dd>{stats.hitDamage.toFixed(1)} × {stats.attacksPerSecond.toFixed(2)}/s</dd></div>
                            <div><dt>Luck</dt><dd>{stats.luck}</dd></div>
                        </dl>
                    </section>

                    <section className="bags">
                        <h3>
                            Inventory
                            <span className="dim">
                                {save.hero.inventory.filter(Boolean).length} / {save.hero.inventory.length}
                            </span>
                        </h3>
                        <p className="hint">Click to equip · right-click to sell</p>
                        <div className="grid">
                            {save.hero.inventory.map((item, index) => (
                                <div
                                    key={item?.id ?? `empty-${index}`}
                                    onContextMenu={(event) => {
                                        event.preventDefault()
                                        if (item) act((draft) => sell(draft, item.id))
                                    }}
                                >
                                    <ItemSlot
                                        item={item}
                                        onClick={() => item && act((draft) => equip(draft, item.id))}
                                    />
                                </div>
                            ))}
                        </div>

                        <h3>
                            Overflow
                            <span className="dim">
                                {save.hero.overflow.filter(Boolean).length} / {save.hero.overflow.length}
                            </span>
                        </h3>
                        <p className="hint">
                            Drops land here when the Inventory is full. It only ever keeps the best,
                            and what it cannot keep is destroyed. Click to move one back.
                        </p>
                        <div className="grid">
                            {save.hero.overflow.map((item, index) => (
                                <div
                                    key={item?.id ?? `overflow-${index}`}
                                    onContextMenu={(event) => {
                                        event.preventDefault()
                                        if (item) act((draft) => sell(draft, item.id))
                                    }}
                                >
                                    <ItemSlot
                                        item={item}
                                        onClick={() => item && act((draft) => rescue(draft, item.id))}
                                    />
                                </div>
                            ))}
                        </div>

                        {refusal && <p className="refusal">{refusal}</p>}
                        <button type="button" className="ghost" onClick={() => mutate(markSeen)}>
                            mark all seen
                        </button>
                    </section>
                </div>
            </div>
        </div>
    )
}
