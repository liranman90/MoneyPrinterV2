"""
Flask web frontend for MoneyPrinterV2.

Run from project root:
    python src/app.py
"""

import os
import sys
import json
import threading

# Ensure src/ is on sys.path so bare imports work (same as main.py)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from uuid import uuid4
from flask import Flask, render_template, request, jsonify

from config import ROOT_DIR, assert_folder_structure, get_verbose, get_ollama_model
from cache import (
    get_accounts,
    add_account,
    remove_account,
    get_products,
    add_product,
)
from utils import rem_temp_files, fetch_songs
from status import info, success, error, warning
from llm_provider import list_models, select_model, get_active_model

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "static"),
)

# Background task tracking
_tasks: dict = {}
_tasks_lock = threading.Lock()

SENSITIVE_KEYS = {
    "nanobanana2_api_key",
    "assembly_ai_api_key",
    "password",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _config_path() -> str:
    return os.path.join(ROOT_DIR, "config.json")


def _read_config() -> dict:
    with open(_config_path(), "r") as f:
        return json.load(f)


def _write_config(data: dict) -> None:
    with open(_config_path(), "w") as f:
        json.dump(data, f, indent=2)


def _mask(value: str) -> str:
    if not value or len(value) <= 4:
        return "****"
    return value[:2] + "*" * (len(value) - 4) + value[-2:]


def _mask_config(cfg: dict) -> dict:
    """Return a copy of config with sensitive values masked."""
    out = {}
    for k, v in cfg.items():
        if isinstance(v, dict):
            out[k] = _mask_config(v)
        elif k in SENSITIVE_KEYS and isinstance(v, str) and v:
            out[k] = _mask(v)
        else:
            out[k] = v
    return out


def _run_background(task_id: str, fn, *args, **kwargs):
    """Execute *fn* in a background thread and track status."""
    def wrapper():
        try:
            result = fn(*args, **kwargs)
            with _tasks_lock:
                _tasks[task_id]["status"] = "completed"
                _tasks[task_id]["result"] = result
        except Exception as exc:
            with _tasks_lock:
                _tasks[task_id]["status"] = "failed"
                _tasks[task_id]["error"] = str(exc)

    with _tasks_lock:
        _tasks[task_id] = {"status": "running", "result": None, "error": None}

    t = threading.Thread(target=wrapper, daemon=True)
    t.start()


# ---------------------------------------------------------------------------
# Page routes
# ---------------------------------------------------------------------------


@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# API – Models
# ---------------------------------------------------------------------------


@app.route("/api/models", methods=["GET"])
def api_list_models():
    try:
        models = list_models()
        active = get_active_model()
        return jsonify({"models": models, "active": active})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/models/select", methods=["POST"])
def api_select_model():
    data = request.get_json(force=True)
    model = data.get("model")
    if not model:
        return jsonify({"error": "model is required"}), 400
    select_model(model)
    return jsonify({"active": model})


# ---------------------------------------------------------------------------
# API – Accounts
# ---------------------------------------------------------------------------


@app.route("/api/accounts/<platform>", methods=["GET"])
def api_get_accounts(platform):
    if platform not in ("youtube", "twitter"):
        return jsonify({"error": "Invalid platform"}), 400
    return jsonify({"accounts": get_accounts(platform)})


@app.route("/api/accounts/<platform>", methods=["POST"])
def api_create_account(platform):
    if platform not in ("youtube", "twitter"):
        return jsonify({"error": "Invalid platform"}), 400

    data = request.get_json(force=True)
    account_id = str(uuid4())

    if platform == "youtube":
        account = {
            "id": account_id,
            "nickname": data.get("nickname", ""),
            "firefox_profile": data.get("firefox_profile", ""),
            "niche": data.get("niche", ""),
            "language": data.get("language", "English"),
            "videos": [],
        }
    else:
        account = {
            "id": account_id,
            "nickname": data.get("nickname", ""),
            "firefox_profile": data.get("firefox_profile", ""),
            "topic": data.get("topic", ""),
            "posts": [],
        }

    add_account(platform, account)
    return jsonify({"account": account}), 201


@app.route("/api/accounts/<platform>/<account_id>", methods=["DELETE"])
def api_delete_account(platform, account_id):
    if platform not in ("youtube", "twitter"):
        return jsonify({"error": "Invalid platform"}), 400
    remove_account(platform, account_id)
    return jsonify({"deleted": account_id})


# ---------------------------------------------------------------------------
# API – YouTube
# ---------------------------------------------------------------------------


def _youtube_generate_task(account: dict):
    """Long-running: generate + return video path."""
    from classes.Tts import TTS
    from classes.YouTube import YouTube

    rem_temp_files()
    yt = YouTube(
        account["id"],
        account["nickname"],
        account["firefox_profile"],
        account["niche"],
        account["language"],
    )
    tts = TTS()
    path = yt.generate_video(tts)

    # Store the YouTube instance so upload can use it
    return {
        "video_path": path,
        "title": yt.metadata.get("title", ""),
        "description": yt.metadata.get("description", ""),
        "account_id": account["id"],
    }


@app.route("/api/youtube/generate", methods=["POST"])
def api_youtube_generate():
    data = request.get_json(force=True)
    account_id = data.get("account_id")
    if not account_id:
        return jsonify({"error": "account_id is required"}), 400

    accounts = get_accounts("youtube")
    account = next((a for a in accounts if a["id"] == account_id), None)
    if not account:
        return jsonify({"error": "Account not found"}), 404

    if not get_active_model():
        return jsonify({"error": "No Ollama model selected. Select one first."}), 400

    task_id = str(uuid4())
    _run_background(task_id, _youtube_generate_task, account)
    return jsonify({"task_id": task_id}), 202


def _youtube_upload_task(account: dict, video_path: str, metadata: dict):
    """Long-running: upload a previously generated video."""
    from classes.YouTube import YouTube

    yt = YouTube(
        account["id"],
        account["nickname"],
        account["firefox_profile"],
        account["niche"],
        account["language"],
    )
    yt.video_path = os.path.abspath(video_path)
    yt.metadata = metadata
    ok = yt.upload_video()
    return {"uploaded": ok, "url": getattr(yt, "uploaded_video_url", None)}


@app.route("/api/youtube/upload", methods=["POST"])
def api_youtube_upload():
    data = request.get_json(force=True)
    account_id = data.get("account_id")
    video_path = data.get("video_path")
    metadata = data.get("metadata", {})

    if not account_id or not video_path:
        return jsonify({"error": "account_id and video_path are required"}), 400

    accounts = get_accounts("youtube")
    account = next((a for a in accounts if a["id"] == account_id), None)
    if not account:
        return jsonify({"error": "Account not found"}), 404

    task_id = str(uuid4())
    _run_background(task_id, _youtube_upload_task, account, video_path, metadata)
    return jsonify({"task_id": task_id}), 202


@app.route("/api/youtube/<account_id>/videos", methods=["GET"])
def api_youtube_videos(account_id):
    from classes.YouTube import YouTube

    accounts = get_accounts("youtube")
    account = next((a for a in accounts if a["id"] == account_id), None)
    if not account:
        return jsonify({"error": "Account not found"}), 404

    # Read videos directly from cache to avoid launching a browser
    from cache import get_youtube_cache_path
    cache_path = get_youtube_cache_path()
    if not os.path.exists(cache_path):
        return jsonify({"videos": []})

    with open(cache_path, "r") as f:
        data = json.load(f)
    for acc in data.get("accounts", []):
        if acc["id"] == account_id:
            return jsonify({"videos": acc.get("videos", [])})
    return jsonify({"videos": []})


# ---------------------------------------------------------------------------
# API – Twitter
# ---------------------------------------------------------------------------


def _twitter_post_task(account: dict):
    from classes.Twitter import Twitter

    tw = Twitter(
        account["id"],
        account["nickname"],
        account["firefox_profile"],
        account["topic"],
    )
    tw.post()
    return {"posted": True}


@app.route("/api/twitter/post", methods=["POST"])
def api_twitter_post():
    data = request.get_json(force=True)
    account_id = data.get("account_id")
    if not account_id:
        return jsonify({"error": "account_id is required"}), 400

    accounts = get_accounts("twitter")
    account = next((a for a in accounts if a["id"] == account_id), None)
    if not account:
        return jsonify({"error": "Account not found"}), 404

    if not get_active_model():
        return jsonify({"error": "No Ollama model selected. Select one first."}), 400

    task_id = str(uuid4())
    _run_background(task_id, _twitter_post_task, account)
    return jsonify({"task_id": task_id}), 202


@app.route("/api/twitter/<account_id>/posts", methods=["GET"])
def api_twitter_posts(account_id):
    from cache import get_twitter_cache_path
    cache_path = get_twitter_cache_path()
    if not os.path.exists(cache_path):
        return jsonify({"posts": []})
    with open(cache_path, "r") as f:
        data = json.load(f)
    for acc in data.get("accounts", []):
        if acc["id"] == account_id:
            return jsonify({"posts": acc.get("posts", [])})
    return jsonify({"posts": []})


# ---------------------------------------------------------------------------
# API – Affiliate Marketing
# ---------------------------------------------------------------------------


@app.route("/api/afm/products", methods=["GET"])
def api_afm_products():
    return jsonify({"products": get_products()})


def _afm_task(affiliate_link: str, twitter_account: dict):
    from classes.AFM import AffiliateMarketing

    afm = AffiliateMarketing(
        affiliate_link,
        twitter_account["firefox_profile"],
        twitter_account["id"],
        twitter_account["nickname"],
        twitter_account["topic"],
    )
    pitch = afm.generate_pitch()
    afm.share_pitch("twitter")
    afm.quit()
    return {"pitch": pitch}


@app.route("/api/afm/run", methods=["POST"])
def api_afm_run():
    data = request.get_json(force=True)
    affiliate_link = data.get("affiliate_link")
    twitter_uuid = data.get("twitter_uuid")

    if not affiliate_link or not twitter_uuid:
        return jsonify({"error": "affiliate_link and twitter_uuid are required"}), 400

    if not get_active_model():
        return jsonify({"error": "No Ollama model selected. Select one first."}), 400

    accounts = get_accounts("twitter")
    account = next((a for a in accounts if a["id"] == twitter_uuid), None)
    if not account:
        return jsonify({"error": "Twitter account not found"}), 404

    add_product({
        "id": str(uuid4()),
        "affiliate_link": affiliate_link,
        "twitter_uuid": twitter_uuid,
    })

    task_id = str(uuid4())
    _run_background(task_id, _afm_task, affiliate_link, account)
    return jsonify({"task_id": task_id}), 202


# ---------------------------------------------------------------------------
# API – Outreach
# ---------------------------------------------------------------------------


def _outreach_task():
    from classes.Outreach import Outreach
    o = Outreach()
    o.start()
    return {"done": True}


@app.route("/api/outreach/start", methods=["POST"])
def api_outreach_start():
    task_id = str(uuid4())
    _run_background(task_id, _outreach_task)
    return jsonify({"task_id": task_id}), 202


# ---------------------------------------------------------------------------
# API – Background task status
# ---------------------------------------------------------------------------


@app.route("/api/tasks/<task_id>", methods=["GET"])
def api_task_status(task_id):
    with _tasks_lock:
        task = _tasks.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)


# ---------------------------------------------------------------------------
# API – Configuration
# ---------------------------------------------------------------------------


@app.route("/api/config", methods=["GET"])
def api_get_config():
    cfg = _read_config()
    return jsonify(_mask_config(cfg))


@app.route("/api/config", methods=["POST"])
def api_update_config():
    updates = request.get_json(force=True)
    cfg = _read_config()

    for key, value in updates.items():
        # Don't overwrite secrets with masked values
        if isinstance(value, str) and "****" in value:
            continue
        if key in cfg and isinstance(cfg[key], dict) and isinstance(value, dict):
            for sub_k, sub_v in value.items():
                if isinstance(sub_v, str) and "****" in sub_v:
                    continue
                cfg[key][sub_k] = sub_v
        else:
            cfg[key] = value

    _write_config(cfg)
    return jsonify({"saved": True})


# ---------------------------------------------------------------------------
# Bootstrap & run
# ---------------------------------------------------------------------------


def _bootstrap():
    """Same setup steps as main.py."""
    assert_folder_structure()
    rem_temp_files()

    try:
        fetch_songs()
    except Exception:
        warning("Could not fetch songs — configure zip_url or add songs manually.")

    configured_model = get_ollama_model()
    if configured_model:
        select_model(configured_model)
        success(f"Using configured model: {configured_model}")
    else:
        try:
            models = list_models()
            if models:
                select_model(models[0])
                info(f"Auto-selected first available model: {models[0]}")
        except Exception:
            warning("Could not connect to Ollama. Select a model from the UI.")


if __name__ == "__main__":
    _bootstrap()
    print("\n  MoneyPrinter V2 — Web UI")
    print("  http://localhost:5000\n")
    app.run(host="127.0.0.1", port=5000, debug=False)
