export function NotDeployed() {
  return (
    <div className="notice">
      <div className="sb-logo" style={{ margin: "0 auto 20px", width: 56, height: 56 }} />
      <h1>Fair Path</h1>
      <p>
        No deployment manifest found. Deploy Fair Path and reload:
      </p>
      <p style={{ marginTop: 18 }}>
        <code>./scripts/demo.sh</code>
      </p>
      <p className="muted" style={{ marginTop: 18 }}>
        This writes <code>frontend/src/deployed.json</code> with the pool, hook,
        and periphery addresses the console reads.
      </p>
    </div>
  );
}
