// Pure geometry, no Pixi, so `node --test` can run it.
// Shared by the Cleave decision (units.ts) and the Cleave hit (world.ts).
export interface Positioned { x: number; y: number; state: string }

export function foesInRadius<T extends Positioned>(x: number, y: number, foes: T[], radius: number): T[] {
    return foes.filter((foe) => foe.state !== 'dead' && Math.hypot(foe.x - x, foe.y - y) <= radius)
}
