"""Deliberately vulnerable sample used by vibetrace's own tests to exercise
the Semgrep pipeline. Never run this code."""

import sqlite3
import subprocess

import flask

app = flask.Flask(__name__)


@app.route("/user")
def get_user():
    username = flask.request.args.get("username", "")
    conn = sqlite3.connect("users.db")
    # SQL injection: user input concatenated into the query
    query = "SELECT * FROM users WHERE name = '" + username + "'"
    rows = conn.execute(query).fetchall()
    return str(rows)


@app.route("/ping")
def ping():
    host = flask.request.args.get("host", "localhost")
    # command injection: user input in a shell command
    out = subprocess.check_output("ping -c 1 " + host, shell=True)
    return out


@app.route("/eval")
def evaluate():
    expr = flask.request.args.get("expr", "1+1")
    # arbitrary code execution
    return str(eval(expr))


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
