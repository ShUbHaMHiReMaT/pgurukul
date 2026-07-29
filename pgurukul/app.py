"""
PGURUKUL — minimal login-only application.

No database, no signup. A fixed set of accounts (see accounts.py) can
log in and see a simple landing page. Everything that previously
depended on a database (chat, files, tasks, announcements, the admin
panel) has been removed.
"""
import os
from datetime import timedelta

from flask import Flask, render_template, request, redirect, url_for, session
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from accounts import verify_login

csrf = CSRFProtect()
limiter = Limiter(key_func=get_remote_address)


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    env = os.environ.get("FLASK_ENV", "development")
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-CHANGE-THIS-NOW")
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = env == "production"
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)
    app.config["WTF_CSRF_TIME_LIMIT"] = 3600
    app.config["WTF_CSRF_SSL_STRICT"] = env == "production"
    app.config["RATELIMIT_STORAGE_URI"] = os.environ.get("REDIS_URL", "memory://")

    csrf.init_app(app)
    limiter.init_app(app)

    from backend.middleware.security_headers import apply_security_headers
    app.after_request(apply_security_headers)

    @app.route("/")
    def root():
        if session.get("username"):
            return redirect(url_for("dashboard"))
        return redirect(url_for("login"))

    @app.route("/login", methods=["GET", "POST"])
    @limiter.limit("10 per minute")
    def login():
        if session.get("username"):
            return redirect(url_for("dashboard"))

        error = None
        if request.method == "POST":
            username = request.form.get("username", "").strip().lower()
            password = request.form.get("password", "")
            account = verify_login(username, password)
            if account:
                session.clear()
                session["username"] = username
                session.permanent = True
                return redirect(url_for("dashboard"))
            error = "Invalid username or password."

        return render_template("login.html", error=error)

    @app.route("/logout")
    def logout():
        session.clear()
        return redirect(url_for("login"))

    @app.route("/dashboard")
    def dashboard():
        username = session.get("username")
        if not username:
            return redirect(url_for("login"))
        from accounts import ACCOUNTS
        account = ACCOUNTS[username]
        return render_template(
            "dashboard.html",
            username=username,
            role=account["role"],
            display_name=account["display_name"],
        )

    @app.errorhandler(404)
    def not_found(e):
        return render_template("errors/404.html"), 404

    @app.errorhandler(429)
    def rate_limited(e):
        return render_template("errors/429.html"), 429

    @app.errorhandler(500)
    def server_error(e):
        return render_template("errors/500.html"), 500

    return app
