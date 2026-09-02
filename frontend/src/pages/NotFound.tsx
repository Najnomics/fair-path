import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="card card-lg" style={{ textAlign: "center", padding: "60px 24px" }}>
      <div
        className="stat-value"
        style={{ fontSize: "3.4rem", color: "var(--accent-2)" }}
      >
        404
      </div>
      <h2 style={{ marginTop: 8 }}>This corridor doesn’t exist</h2>
      <p className="lead" style={{ margin: "10px auto 22px", maxWidth: "44ch" }}>
        The page you’re looking for isn’t part of the Fair Path console.
      </p>
      <Link to="/" className="btn btn-primary" style={{ width: "auto", display: "inline-flex" }}>
        Back to Overview
      </Link>
    </div>
  );
}
