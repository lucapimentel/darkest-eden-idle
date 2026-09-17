import type { ClaimResult } from '@dei/game'
import { ItemSlot } from './Item'

function duration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)
    if (hours === 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`
    return `${hours}h ${minutes}m`
}

/**
 * The payoff of a claim, and the best debugger in M2: every number here is one you will notice
 * going wrong. Destroyed items are reported plainly — a player who later finds out the game
 * quietly ate loot trusts nothing afterwards.
 */
export function AwayReport({ result, onClose }: { result: ClaimResult; onClose: () => void }) {
    const shown = result.items.slice(-12)
    return (
        <div className="panel-backdrop" onClick={onClose}>
            <div className="panel report" onClick={(event) => event.stopPropagation()}>
                <header>
                    <h2>While you were away</h2>
                    <button type="button" onClick={onClose}>close</button>
                </header>
                <p className="dim">{duration(result.elapsedSec)} on Stage {result.stage}.</p>

                <dl className="stats">
                    <div><dt>Kills</dt><dd>{result.kills.toLocaleString()}</dd></div>
                    <div><dt>Deaths</dt><dd>{result.deaths}</dd></div>
                    <div><dt>XP</dt><dd>{result.xp.toLocaleString()}</dd></div>
                    <div><dt>Levels gained</dt><dd>{result.levelsGained}</dd></div>
                    <div><dt>Gold</dt><dd>{result.gold.toLocaleString()}</dd></div>
                    <div><dt>Spent on Auto-repair</dt><dd>{result.repairGold.toLocaleString()}</dd></div>
                </dl>

                {result.broken.length > 0 && (
                    <p className="warn">
                        {result.broken.length} item{result.broken.length === 1 ? '' : 's'} broke and
                        gave no stats until repaired. Keep gold for Auto-repair.
                    </p>
                )}

                <h3>Loot</h3>
                <p className="dim">
                    {result.items.length} kept
                    {result.overflowKept > 0 && `, ${result.overflowKept} in the Overflow`}
                    {result.destroyed > 0 && `, ${result.destroyed} destroyed because there was no room`}.
                </p>
                {result.destroyed > result.items.length && (
                    <p className="warn">
                        The Overflow destroyed more than it kept. Empty the Inventory more often.
                    </p>
                )}
                <div className="grid">
                    {shown.map((item) => <ItemSlot key={item.id} item={item} />)}
                </div>

                <button type="button" onClick={onClose}>continue</button>
            </div>
        </div>
    )
}
