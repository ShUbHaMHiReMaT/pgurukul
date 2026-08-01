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
from flask_compress import Compress

from config import config_map

# ─── Extension Instances ─────────────────────────────────────────────────────
db = SQLAlchemy()
login_manager = LoginManager()
csrf = CSRFProtect()
limiter = Limiter(key_func=get_remote_address)
cache = Cache()
compress = Compress()


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
    cfg.init_app(app)

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
    # Gzip/Brotli-compresses HTML/CSS/JS/JSON responses on the way out —
    # the safe, transparent version of "minify" (shrinks the same bytes
    # over the wire without rewriting page content, so nothing can break).
    compress.init_app(app)

    # Login manager settings
    login_manager.login_view = "auth.login_view"   # matches auth_bp route name
    login_manager.login_message = "Please log in to access this page."
    login_manager.login_message_category = "warning"
    login_manager.session_protection = "strong"

    # ─── Logging ──────────────────────────────────────────────────────────
    _configure_logging(app)

    # ─── Create tables + seed fixed accounts on every boot ─────────────────
    # Idempotent — safe to run every time. Exists so hosting tiers with no
    # shell access (e.g. Render free tier) never need a manual setup step.
    app.config["BOOTSTRAP_ERROR"] = None
    with app.app_context():
        from backend.db_bootstrap import bootstrap_database
        try:
            bootstrap_database(app, db, log=app.logger.info)
        except Exception as e:
            app.logger.exception("Database bootstrap failed")
            import traceback
            app.config["BOOTSTRAP_ERROR"] = traceback.format_exc()

    # ─── Unauthenticated diagnostic page ────────────────────────────────────
    # Visit /health directly in a browser — no log access needed to see
    # whether the database actually has tables/accounts and whether the
    # boot-time bootstrap succeeded.
    @app.route("/health")
    def health():
        import sqlalchemy as sa
        info = {
            "database_uri_dialect": db.engine.dialect.name,
            "bootstrap_error": app.config.get("BOOTSTRAP_ERROR"),
        }
        try:
            inspector = sa.inspect(db.engine)
            tables = sorted(inspector.get_table_names())
            info["tables"] = tables
            if "users" in tables:
                with db.engine.connect() as conn:
                    info["user_count"] = conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar()
                    info["usernames"] = [
                        r[0] for r in conn.execute(sa.text("SELECT username FROM users ORDER BY username"))
                    ]
        except Exception as e:
            info["inspect_error"] = str(e)
        from flask import jsonify
        return jsonify(info)

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

    # ─── Nav department for sidebar ─────────────────────────────────────────
    # Super admins aren't tied to one department (so they keep the
    # platform-wide overview on /dashboard/), but the sidebar still needs
    # somewhere to point Chat/Files/Tasks/Announcements — give them the
    # first active department as their working department for navigation.
    # The routes already let super_admins into any department; this just
    # gives the sidebar a link to click.
    @app.context_processor
    def inject_nav_dept():
        if not current_user.is_authenticated:
            return {}
        if current_user.department:
            return {"nav_dept": current_user.department}
        if current_user.is_super_admin:
            from backend.models.department import Department
            return {"nav_dept": Department.query.filter_by(is_active=True).order_by(Department.created_at).first()}
        return {}

    # ─── Loud warning if a real deployment silently fell back to SQLite ────
    # Checked independent of FLASK_ENV since a missing/misconfigured
    # FLASK_ENV was itself a source of confusion here — RENDER is set by
    # Render on every service regardless of FLASK_ENV.
    db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    on_render = bool(os.environ.get("RENDER"))
    if (env == "production" or on_render) and db_uri.startswith("sqlite"):
        app.logger.critical(
            "RUNNING ON SQLITE — DATABASE_URL is not set (or not visible to "
            "this process). Data will NOT persist across deploys. Set "
            "DATABASE_URL in the environment variables of THIS service "
            "(not just the database resource) and redeploy."
        )

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
