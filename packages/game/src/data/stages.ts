export const WAVES_PER_STAGE = 10
export const STAGES = 10 // Act 1; M2 only farms Stage 1

/** PLAN §3: monster level = 3 × Stage, and item level = monster level. */
export const monsterLevel = (stage: number) => 3 * stage

/** Stages 1–3 are Warrior + Archer. M9 adds the rest of the Act 1 mix. */
export function enemiesForStage(stage: number): string[] {
    if (stage <= 3) return ['warrior', 'archer']
    if (stage <= 6) return ['warrior', 'archer', 'berserker', 'dark_archer']
    return ['warrior', 'archer', 'berserker', 'dark_archer', 'dark_knight', 'wizard']
}

export const xpPerKill = (monsterLevel: number) => 5 + monsterLevel * 3
export const goldPerKill = (monsterLevel: number) => 2 + monsterLevel
