"""Authentication routes — login, signup, logout."""
import re
from flask import Blueprint, render_template, redirect, url_for, request, flash, session
from flask_login import current_user, login_required
from app import limiter

from backend.services.auth_service import login, do_logout, signup_with_invite, change_password
from backend.utils.validators import validate_email, sanitize_text

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/login", methods=["GET", "POST"])
@limiter.limit("20 per minute")
def login_view():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    error = None
    if request.method == "POST":
        email = sanitize_text(request.form.get("email", ""), 255).lower()
        password = request.form.get("password", "")
        remember = request.form.get("remember") == "on"

        email_err = validate_email(email)
        if email_err:
            error = email_err
        elif not password:
            error = "Password is required."
        else:
            user, err = login(email, password, remember=remember)
            if err:
                error = err
            else:
                next_page = request.args.get("next", "")
                # Security: only allow relative URLs
                if next_page and next_page.startswith("/") and not next_page.startswith("//"):
                    return redirect(next_page)
                return redirect(url_for("dashboard.index"))

    return render_template("auth/login.html", error=error)


@auth_bp.route("/signup", methods=["GET", "POST"])
@limiter.limit("10 per hour")
def signup():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    error = None
    form_data = {}

    if request.method == "POST":
        invite_code = sanitize_text(request.form.get("invite_code", ""), 30)
        temp_password = request.form.get("temp_password", "")
        username = sanitize_text(request.form.get("username", ""), 50)
        email = sanitize_text(request.form.get("email", ""), 255).lower()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        form_data = {"invite_code": invite_code, "username": username, "email": email}

        if password != confirm_password:
            error = "Passwords do not match."
        else:
            user, err = signup_with_invite(
                invite_code=invite_code,
                temp_password=temp_password,
                username=username,
                password=password,
                email=email,
            )
            if err:
                error = err
            else:
                flash("Account created successfully! Please log in.", "success")
                return redirect(url_for("auth.login_view"))

    return render_template("auth/signup.html", error=error, form_data=form_data)


@auth_bp.route("/logout")
@login_required
def logout():
    do_logout(current_user)
    flash("You've been logged out.", "info")
    return redirect(url_for("auth.login_view"))


@auth_bp.route("/change-password", methods=["POST"])
@login_required
@limiter.limit("5 per hour")
def change_pwd():
    current_pwd = request.form.get("current_password", "")
    new_pwd = request.form.get("new_password", "")
    confirm = request.form.get("confirm_password", "")

    if new_pwd != confirm:
        flash("New passwords do not match.", "error")
    else:
        err = change_password(current_user, current_pwd, new_pwd)
        if err:
            flash(err, "error")
        else:
            flash("Password changed successfully.", "success")

    return redirect(url_for("dashboard.profile"))
