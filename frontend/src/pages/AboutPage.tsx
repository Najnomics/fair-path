import { addresses, chain, isZero } from "../lib/clients";
import { short } from "../lib/format";

export function AboutPage() {
  return (
    <div className="grid cols-2" style={{ alignItems: "start" }}>
      <section className="card card-lg">
        <div className="prose">
          <h2 style={{ marginTop: 0 }}>The idea</h2>
          <p>
            Most MEV is a pricing failure. One pool should not charge a retail
            swapper and a sandwich the same fee. <b>Fair Path</b> prices three
            corridors on the same Uniswap v4 pool.
          </p>
          <p>
            <b>Attested</b> TEE / fair blocks trade at <b>5 bps</b> with no tax.
            <b>Bonded</b> searchers pay slot-priced first-look fees.{" "}
            <b>Toxic</b> unbonded flow pays <b>1% + 50 bps</b> donated to
            in-range LPs. Same-block opposite-direction swaps from a bonded
            searcher <b>slash 20%</b> of the bond to LPs.
          </p>

          <h3>Mechanism</h3>
          <ul>
            <li>
              <code>beforeSwap</code> classifies via <code>policy.isFair</code>{" "}
              then <code>bonds</code> + flashblock slot, and overrides the
              dynamic fee.
            </li>
            <li>
              <code>afterSwap</code> donates toxic tax or slashed bond value to
              LPs.
            </li>
            <li>
              Every swap emits <code>SwapClassified</code> with corridor, slot,
              tax. Corridor 0 is attested on the charts.
            </li>
            <li>
              Retail swaps send empty <code>hookData</code> — the sender is the
              searcher.
            </li>
          </ul>
        </div>
      </section>

      <section className="grid" style={{ gap: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Deployment</h3>
            <span className="muted">{chain.name}</span>
          </div>
          <table className="maptable">
            <tbody>
              <tr>
                <td>Hook</td>
                <td className="mono">{short(addresses.hook)}</td>
              </tr>
              <tr>
                <td>Oracle / policy</td>
                <td className="mono">{short(addresses.policy)}</td>
              </tr>
              <tr>
                <td>Bonds</td>
                <td className="mono">
                  {isZero(addresses.bonds) ? "—" : short(addresses.bonds)}
                </td>
              </tr>
              <tr>
                <td>Swap router</td>
                <td className="mono">{short(addresses.swapRouter)}</td>
              </tr>
              <tr>
                <td>StateView</td>
                <td className="mono">{short(addresses.stateView)}</td>
              </tr>
              <tr>
                <td>PositionManager</td>
                <td className="mono">{short(addresses.positionManager)}</td>
              </tr>
              <tr>
                <td>
                  {addresses.token0Symbol} / {addresses.token1Symbol}
                </td>
                <td className="mono">
                  {short(addresses.token0)} · {short(addresses.token1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Fee schedule</h3>
          </div>
          <table className="maptable">
            <tbody>
              <tr>
                <td>Attested corridor</td>
                <td>
                  <b>0.05%</b> swap fee · no tax
                </td>
              </tr>
              <tr>
                <td>Bonded slot fees</td>
                <td>
                  <b>0.80% → 0.075%</b> by flashblock slot
                </td>
              </tr>
              <tr>
                <td>Toxic corridor</td>
                <td>
                  <b>1.00%</b> + <b>0.50%</b> donate → LPs
                </td>
              </tr>
              <tr>
                <td>Same-block slash</td>
                <td>
                  <b>20%</b> of bond on opposite-direction swap
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
