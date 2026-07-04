"""Local research dashboard. Server-rendered, offline, read-only."""

from __future__ import annotations

import difflib
import sqlite3
from pathlib import Path

from flask import Flask, Response, abort, render_template

from vibetrace import db, export
from vibetrace.dashboard import charts, queries


def create_app(db_path: Path) -> Flask:
    app = Flask(__name__)
    app.config["DB_PATH"] = Path(db_path)

    def conn() -> sqlite3.Connection:
        return db.connect(app.config["DB_PATH"])

    @app.template_filter("shortsha")
    def shortsha(value):  # noqa: ANN001
        return (value or "")[:10]

    @app.route("/")
    def index():
        c = conn()
        try:
            return render_template(
                "index.html",
                overview=queries.overview(c),
                sessions=queries.sessions_list(c),
            )
        finally:
            c.close()

    @app.route("/session/<session_id>")
    def session_view(session_id):
        c = conn()
        try:
            session = c.execute(
                "SELECT * FROM sessions WHERE id=?", (session_id,)
            ).fetchone()
            if session is None:
                abort(404)
            return render_template(
                "session.html",
                session=session,
                timeline=queries.session_timeline(c, session_id),
            )
        finally:
            c.close()

    @app.route("/prompt/<int:prompt_id>")
    def prompt_view(prompt_id):
        c = conn()
        try:
            detail = queries.prompt_detail(c, prompt_id)
            if detail is None:
                abort(404)
            return render_template("prompt.html", **detail)
        finally:
            c.close()

    @app.route("/change/<int:change_id>")
    def change_view(change_id):
        c = conn()
        try:
            detail = queries.change_detail(c, change_id)
            if detail is None:
                abort(404)
            before = (detail["before_text"] or "").splitlines()
            after = (detail["after_text"] or "").splitlines()
            diff = list(
                difflib.unified_diff(before, after, "before", "after", lineterm="")
            )
            return render_template("change.html", diff=diff, **detail)
        finally:
            c.close()

    @app.route("/stats")
    def stats_view():
        c = conn()
        try:
            outcomes = queries.prompt_outcomes(c)
            table = queries.feature_outcome_table(outcomes)
            split_rows = [
                (t["label"], t["mean_new_present"] or 0, t["mean_new_absent"] or 0,
                 t["n_present"], t["n_absent"])
                for t in table
                if t["n_present"] and t["n_absent"]
            ]
            severity_rows = [
                (r["severity"], r["n"], f"{r['severity']}: {r['n']} total, {r['n_new'] or 0} new")
                for r in queries.findings_by_severity(c)
            ]
            severity_class = {
                "ERROR": "vt-sev-error", "WARNING": "vt-sev-warning",
                "INFO": "vt-sev-info", "UNKNOWN": "vt-sev-info",
            }
            chart_splits = charts.paired_hbar_chart(
                split_rows,
                title="Mean NEW security findings per prompt, by prompt trait",
                legend=("Trait present", "Trait absent"),
            )
            chart_severity = charts.hbar_chart(
                severity_rows,
                title="Security findings by severity (after-scans)",
                class_by_label=severity_class,
            )
            chart_rules = charts.hbar_chart(
                [(r["rule_id"].rsplit(".", 1)[-1], r["n"],
                  f"{r['rule_id']}: {r['n']} total, {r['n_new'] or 0} new")
                 for r in queries.findings_by_rule(c)],
                title="Most frequent findings by rule",
            )
            chart_length = charts.hbar_chart(
                [(label, val, f"{label}: mean {val} new findings (n={n})")
                 for label, val, n in queries.length_bucket_rates(outcomes)],
                title="Mean NEW findings by prompt length quartile",
            )
            return render_template(
                "stats.html",
                overview=queries.overview(c),
                n_prompts=len(outcomes),
                feature_table=table,
                chart_splits=chart_splits,
                chart_severity=chart_severity,
                chart_rules=chart_rules,
                chart_length=chart_length,
            )
        finally:
            c.close()

    # --- exports: same code paths as `vibetrace export` ----------------------

    @app.route("/export/flat.csv")
    def export_flat():
        c = conn()
        try:
            return Response(export.flat_csv_text(c), mimetype="text/csv")
        finally:
            c.close()

    @app.route("/export/<name>.csv")
    def export_table(name):
        table = {"prompts": "prompts", "changes": "code_changes",
                 "findings": "findings", "sessions": "sessions"}.get(name)
        if table is None:
            abort(404)
        c = conn()
        try:
            return Response(export.table_csv_text(c, table), mimetype="text/csv")
        finally:
            c.close()

    @app.route("/export/dump.json")
    def export_dump():
        c = conn()
        try:
            return Response(export.dump_json_text(c), mimetype="application/json")
        finally:
            c.close()

    return app
