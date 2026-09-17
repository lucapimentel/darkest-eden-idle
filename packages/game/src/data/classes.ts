export interface ClassDef {
    classId: 'knight'
    name: string
    baseLife: number
    lifePerLevel: number
    baseMana: number
    str: number
    dex: number
    int: number
    attributePerLevel: number
    attacksPerSecond: number
    /** PLAN §3: skills grow with hero level, not only with the weapon. */
    damagePerLevel: number
    /** Cleave (PLAN §3): a wide arc that hits the whole pack, on a cooldown. */
    cleave: { multiplier: number; cooldownSec: number }
}

export const KNIGHT: ClassDef = {
    classId: 'knight',
    name: 'Knight',
    baseLife: 60,
    lifePerLevel: 12,
    baseMana: 40,
    str: 14, dex: 8, int: 6,
    attributePerLevel: 3,
    attacksPerSecond: 1.1,
    damagePerLevel: 0.08, // +8% per level: a level 30 Knight hits ~3.3x as hard as a level 1
    cleave: { multiplier: 1.6, cooldownSec: 4 },
}

export const CLASSES = { knight: KNIGHT }
