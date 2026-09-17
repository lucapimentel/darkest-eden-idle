export const COLUMNS = 15;
export const ROWS = 8;
export const FPS = 10;

export const DIRECTIONS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;

export function frameRect(col: number, row: number, cell: number) {
    return { x: col * cell, y: row * cell, w: cell, h: cell }
}

export function facingRow(dx: number, dy: number): number {
    const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); // -4 ... 4
    return (octant + 8) % 8;
}