"""
INTENTIONALLY VULNERABLE FLASK APP
For security benchmarking / educational purposes only.
DO NOT deploy this code.
"""

import os
import pickle
import sqlite3
from flask import Flask, request, jsonify, send_file

# VULN: hardcoded-credentials — secret key hardcoded in source
SECRET_KEY = "my_super_secret_jwt_key_do_not_share"

app = Flask(__name__)
app.secret_key = SECRET_KEY


def get_db():
    return sqlite3.connect("users.db")


# VULN: sql-injection — string formatting used to build SQL query with user input
@app.route("/users")
def get_users():
    username = request.args.get("username", "")
    # An attacker can pass: ' OR '1'='1
    query = "SELECT * FROM users WHERE username = '%s'" % username
    conn = get_db()
    cursor = conn.execute(query)
    rows = cursor.fetchall()
    return jsonify(rows)


# VULN: command-injection — user input passed directly to os.system()
@app.route("/ping")
def ping():
    host = request.args.get("host", "")
    # An attacker can pass: 8.8.8.8; rm -rf /
    output = os.popen("ping -c 1 " + host).read()
    return f"<pre>{output}</pre>"


# VULN: path-traversal — user-supplied filename used to open files without validation
@app.route("/download")
def download():
    filename = request.args.get("filename", "")
    base_dir = "/var/app/files/"
    # An attacker can pass: ../../etc/passwd
    filepath = base_dir + filename
    with open(filepath, "r") as f:
        return f.read()


# VULN: insecure-deserialization — pickle.loads() on user-supplied data
@app.route("/load", methods=["POST"])
def load_object():
    data = request.get_data()
    # An attacker can send a crafted pickle payload for RCE
    obj = pickle.loads(data)
    return jsonify({"result": str(obj)})


# Safe endpoint for comparison
@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
