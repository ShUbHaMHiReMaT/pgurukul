"""
PGURUKUL — Flask Application Factory
"""
import os
import logging
from logging.handlers import RotatingFileHandler

from flask import Flask, render_template, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, current_user
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache

from config import config_map

# ─── Extension Instances ─────────────────────────────────────────────────────
db = SQLAlchemy()
login_manager = LoginManager()
csrf = CSRFProtect()
limiter = Limiter(key_func=get_remote_address)
cache = Cache()


def create_app(env: str = None) -> Flask:
    """Application factory."""
    env = env or os.environ.get("FLASK_ENV", "development")
    cfg = config_map.get(env, config_map["default"])

    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="static",
    )
    app.config.from_object(cfg)

    # ─── Jinja filters ────────────────────────────────────────────────────
    from backend.utils.validators import render_mentions
    app.jinja_env.filters["render_mentions"] = render_mentions

    # ─── Ensure dirs ──────────────────────────────────────────────────────
    os.makedirs(app.config.get("UPLOAD_FOLDER", "uploads"), exist_ok=True)
    os.makedirs(app.config.get("LOG_DIR", "logs"), exist_ok=True)

    # ─── Init extensions ──────────────────────────────────────────────────
    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)
    cache.init_app(app)

    # Login manager settings
    login_manager.login_view = "auth.login_view"   # matches auth_bp route name
    login_manager.login_message = "Please log in to access this page."
    login_manager.login_message_category = "warning"
    login_manager.session_protection = "strong"

    # ─── Logging ──────────────────────────────────────────────────────────
    _configure_logging(app)

    # ─── Register Blueprints ──────────────────────────────────────────────
    from backend.routes.auth import auth_bp
    from backend.routes.dashboard import dashboard_bp
    from backend.routes.chat import chat_bp
    from backend.routes.files import files_bp
    from backend.routes.tasks import tasks_bp
    from backend.routes.announcements import announcements_bp
    from backend.routes.search import search_bp
    from backend.routes.admin import admin_bp
    from backend.routes.api import api_bp

    app.register_blueprint(auth_bp)                               # /auth/...
    app.register_blueprint(dashboard_bp, url_prefix="/dashboard") # /dashboard/...
    app.register_blueprint(chat_bp, url_prefix="/chat")           # /chat/...
    app.register_blueprint(files_bp, url_prefix="/files")         # /files/...
    app.register_blueprint(tasks_bp, url_prefix="/tasks")         # /tasks/...
    app.register_blueprint(announcements_bp, url_prefix="/dashboard/announcements")
    app.register_blueprint(search_bp, url_prefix="/search")
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(api_bp, url_prefix="/api")

    # ─── Error Handlers ───────────────────────────────────────────────────
    _register_error_handlers(app)

    # ─── Security Headers ─────────────────────────────────────────────────
    from backend.middleware.security_headers import apply_security_headers
    app.after_request(apply_security_headers)

    # ─── User Loader ──────────────────────────────────────────────────────
    from backend.models.user import User

    @login_manager.user_loader
    def load_user(user_id: str):
        return db.session.get(User, user_id)

    # ─── Root redirect ────────────────────────────────────────────────────
    @app.route("/")
    def root():
        if current_user.is_authenticated:
            return redirect(url_for("dashboard.index"))
        return redirect(url_for("auth.login_view"))

    return app


def _configure_logging(app: Flask) -> None:
    level_str = app.config.get("LOG_LEVEL", "INFO")
    level = getattr(logging, level_str.upper(), logging.INFO)
    fmt = logging.Formatter(
        "[%(asctime)s] %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    log_file = os.path.join(app.config.get("LOG_DIR", "logs"), "pgurukul.log")
    try:
        fh = RotatingFileHandler(log_file, maxBytes=5_000_000, backupCount=5)
        fh.setFormatter(fmt)
        fh.setLevel(level)
        app.logger.addHandler(fh)
    except Exception:
        pass  # Ignore log file errors in dev

    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    sh.setLevel(level)

    app.logger.setLevel(level)
    app.logger.addHandler(sh)
    logging.getLogger("werkzeug").setLevel(logging.WARNING)


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(400)
    def bad_request(e):
        return render_template("errors/400.html"), 400

    @app.errorhandler(403)
    def forbidden(e):
        return render_template("errors/403.html"), 403

    @app.errorhandler(404)
    def not_found(e):
        return render_template("errors/404.html"), 404

    @app.errorhandler(413)
    def too_large(e):
        return render_template("errors/413.html"), 413

    @app.errorhandler(429)
    def rate_limited(e):
        return render_template("errors/429.html"), 429

    @app.errorhandler(500)
    def server_error(e):
        app.logger.error(f"500 error: {e}")
        return render_template("errors/500.html"), 500
