"""Input validators."""
import re
from typing import Optional


USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,50}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_username(username: str) -> Optional[str]:
    if not username:
        return "Username is required."
    if not USERNAME_RE.match(username):
        return "Username must be 3–50 characters and contain only letters, numbers, _ . -"
    return None


def validate_password(password: str) -> Optional[str]:
    if not password:
        return "Password is required."
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if len(password) > 128:
        return "Password is too long."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return "Password must contain at least one number."
    return None


def validate_email(email: str) -> Optional[str]:
    if not email:
        return "Email is required."
    if not EMAIL_RE.match(email):
        return "Please enter a valid email address."
    if len(email) > 255:
        return "Email is too long."
    return None


def sanitize_text(text: str, max_length: int = 10000) -> str:
    """Strip dangerous characters and trim length."""
    import bleach
    cleaned = bleach.clean(text, tags=[], attributes={}, strip=True)
    return cleaned[:max_length].strip()


def validate_file_path(path: str) -> Optional[str]:
    """Ensure folder path is safe."""
    if not path:
        return "/"
    # Prevent path traversal
    if ".." in path or path.startswith("/.."):
        return None
    if not path.startswith("/"):
        path = "/" + path
    return path
