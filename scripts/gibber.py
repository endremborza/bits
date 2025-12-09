import sqlite3

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
DATABASE = "prompts.db"


def create_tables():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS sentences (
                    sid UNSIGNED BIG INT PRIMARY KEY,
                    pid UNSIGNED BIG INT,
                    time UNSIGNED BIG INT,
                    name TEXT,
                    content TEXT,
                    prompt_phrase TEXT,
                    prompt_val TEXT
                );
    """
    )
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS reviews (
                    rid UNSIGNED BIG INT ,
                    sid UNSIGNED BIG INT ,
                    time UNSIGNED BIG INT ,
                    res INT2,
                    rname TEXT
                )
        """
    )
    conn.commit()
    conn.close()


@app.route("/v1", methods=["GET"])
def get_phrases():
    rid = request.args.get("rid")
    if rid is None:
        return jsonify({"error": "rid needed"}), 400
    q = f"""
    SELECT sid, content
    FROM sentences
    WHERE sid NOT IN (SELECT sid FROM reviews WHERE rid = {int(rid)});
    """
    return fetch(q, ["id", "content"])


@app.route("/v1-results", methods=["GET"])
def get_results():
    keys = ["name", "rname", "prompt_val", "res"]
    q = f"""
    SELECT 
         {', '.join(keys)}
    FROM 
        sentences
    INNER JOIN reviews
        ON reviews.sid = sentences.sid
    """
    return fetch(q, keys)


@app.route("/v1-past", methods=["GET"])
def get_past():
    pid = request.args.get("pid")
    keys = ["content", "prompt_val"]
    q = f"""
    SELECT 
         {', '.join(keys)}
    FROM 
        sentences
    WHERE pid={pid}
    """
    return fetch(q, keys)


@app.route("/v1", methods=["POST"])
def add_sentence():
    d: dict = request.json
    return exec(
        "INSERT INTO sentences (sid, pid, content, prompt_phrase, prompt_val, time, name) VALUES (?,?,?,?,?,?,?)",
        (
            d["sid"],
            d["pid"],
            d["content"],
            d["currentPhrase"],
            d["currentReq"],
            d["time"],
            d["name"],
        ),
    )


@app.route("/v1-review", methods=["POST"])
def add_review():
    d: dict = request.json
    return exec(
        "INSERT INTO reviews (rid, rname, time, sid, res) VALUES (?,?,?,?,?)",
        (d["rid"], d["name"], d["time"], d["sid"], d["res"]),
    )


def exec(comm, args):
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute(comm, args)
    conn.commit()
    conn.close()
    return jsonify({"message": "OK"}), 201


def fetch(comm, keys):
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute(comm)
    messages = list(map(lambda r: dict(zip(keys, r)), c.fetchall()))
    conn.close()
    return jsonify(messages)


if __name__ == "__main__":
    create_tables()
    app.run(host="0.0.0.0", port=5678, debug=True)
