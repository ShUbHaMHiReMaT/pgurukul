"""Authentication service — signup, login, password management."""
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple

from flask import current_app, request
from flask_login import login_user, logout_user
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from app import db
from backend.models.user import User
from backend.models.department import Department
from backend.services.activity_service import log_activity
from backend.utils.validators import validate_username, validate_password

ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)


def hash_password(password: str) -> str:
    """Hash a password with Argon2id."""
    return ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    try:
        return ph.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def signup_with_invite(
    invite_code: str,
    temp_password: str,
    username: str,
    password: str,
    email: str,
) -> Tuple[Optional[User], Optional[str]]:
    """
    Register a new intern using a department invite code.
    Returns (user, error_message).
    """
    # Validate inputs
    username_error = validate_username(username)
    if username_error:
        return None, username_error

    password_error = validate_password(password)
    if password_error:
        return None, password_error

    # Find department by invite code
    department = Department.query.filter_by(invite_code=invite_code, is_active=True).first()
    if not department:
        return None, "Invalid invite code. Contact your department lead."

    # Verify temp password
    if department.temp_password:
        if not verify_password(temp_password, department.temp_password):
            return None, "Invalid temporary password."

    # Check username uniqueness
    if User.query.filter_by(username=username).first():
        return None, f"Username '{username}' is already taken. Choose another."

    # Check email uniqueness
    if User.query.filter_by(email=email).first():
        return None, "An account with this email already exists."

    # Create user
    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        role="intern",
        department_id=department.id,
        is_active=True,
        is_verified=True,
    )
    db.session.add(user)
    db.session.flush()  # Get the ID

    db.session.commit()

    log_activity(
        user_id=user.id,
        department_id=department.id,
        action="department_joined",
        resource_type="department",
        resource_id=department.id,
        details=f"Joined via invite code",
        ip_address=_get_ip(),
        user_agent=_get_ua(),
    )

    return user, None


def login(
    email: str,
    password: str,
    remember: bool = False,
) -> Tuple[Optional[User], Optional[str]]:
    """
    Authenticate a user.
    Returns (user, error_message).
    Implements account lockout after MAX_LOGIN_ATTEMPTS failures.
    """
    user = User.query.filter_by(email=email).first()

    if not user:
        # Prevent timing-based enumeration
        hash_password("dummy_prevent_timing_attack")
        _log_failed_login(None, email)
        return None, "Invalid email or password."

    if not user.is_active:
        return None, "Your account has been disabled. Contact support."

    # Check lockout
    if user.is_locked:
        remaining = (user.locked_until - datetime.utcnow()).seconds // 60
        return None, f"Account temporarily locked. Try again in {remaining} minutes."

    # Verify password
    if not verify_password(password, user.password_hash):
        user.failed_login_attempts += 1
        max_attempts = current_app.config.get("MAX_LOGIN_ATTEMPTS", 5)

        if user.failed_login_attempts >= max_attempts:
            lockout_mins = current_app.config.get("LOCKOUT_DURATION_MINUTES", 15)
            user.locked_until = datetime.utcnow() + timedelta(minutes=lockout_mins)
            db.session.commit()
            log_activity(
                user_id=user.id,
                action="login_failed",
                details=f"Account locked after {max_attempts} failed attempts",
                ip_address=_get_ip(),
                user_agent=_get_ua(),
            )
            return None, f"Too many failed attempts. Account locked for {lockout_mins} minutes."

        db.session.commit()
        _log_failed_login(user.id, email)
        return None, "Invalid email or password."

    # Success — reset counters
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()
    user.last_login_ip = _get_ip()
    user.last_seen_at = datetime.utcnow()
    db.session.commit()

    login_user(user, remember=remember)

    log_activity(
        user_id=user.id,
        department_id=user.department_id,
        action="login",
        ip_address=_get_ip(),
        user_agent=_get_ua(),
    )

    return user, None


def do_logout(user: User) -> None:
    """Log out a user and record the activity."""
    log_activity(
        user_id=user.id,
        department_id=user.department_id,
        action="logout",
        ip_address=_get_ip(),
        user_agent=_get_ua(),
    )
    logout_user()


def create_super_admin(
    username: str,
    email: str,
    password: str,
) -> Tuple[Optional[User], Optional[str]]:
    """Create the initial super admin account (CLI / seed use)."""
    if User.query.filter_by(role="super_admin").first():
        return None, "Super admin already exists."

    if User.query.filter_by(email=email).first():
        return None, "Email already in use."

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        role="super_admin",
        is_active=True,
        is_verified=True,
    )
    db.session.add(user)
    db.session.commit()
    return user, None


def change_password(
    user: User,
    current_password: str,
    new_password: str,
) -> Optional[str]:
    """Change user password. Returns error string or None on success."""
    if not verify_password(current_password, user.password_hash):
        return "Current password is incorrect."

    error = validate_password(new_password)
    if error:
        return error

    user.password_hash = hash_password(new_password)
    db.session.commit()

    log_activity(
        user_id=user.id,
        action="password_changed",
        ip_address=_get_ip(),
        user_agent=_get_ua(),
    )
    return None


def admin_reset_password(
    target_user: User,
    new_password: str,
    admin_user: User,
) -> Optional[str]:
    """Admin resets another user's password."""
    error = validate_password(new_password)
    if error:
        return error

    target_user.password_hash = hash_password(new_password)
    target_user.failed_login_attempts = 0
    target_user.locked_until = None
    db.session.commit()

    log_activity(
        user_id=admin_user.id,
        action="password_reset",
        resource_type="user",
        resource_id=target_user.id,
        details=f"Admin reset password for {target_user.username}",
        ip_address=_get_ip(),
        user_agent=_get_ua(),
    )
    return None


def _get_ip() -> str:
    try:
        return request.headers.get("X-Forwarded-For", request.remote_addr or "")
    except RuntimeError:
        return ""


def _get_ua() -> str:
    try:
        return request.headers.get("User-Agent", "")[:500]
    except RuntimeError:
        return ""


def _log_failed_login(user_id: Optional[str], email: str) -> None:
    log_activity(
        user_id=user_id,
        action="login_failed",
        details=f"Failed login for email: {email}",
        ip_address=_get_ip(),
        user_agent=_get_ua(),
    )
