# FIXTURE — intentionally vulnerable auth module.
import hashlib
import os
import pickle

import yaml
from flask import Flask, request

app = Flask(__name__)
ADMIN_PASSWORD = "sup3rsecretadmin"


def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()


@app.route("/restore", methods=["POST"])
def restore():
    state = pickle.loads(request.cookies["session"])
    return {"ok": True, "user": state.get("user")}


def load_config():
    return yaml.load(open("config.yml"))


def backup(name):
    os.system(f"tar czf /backups/{name}.tar.gz /data")


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)
