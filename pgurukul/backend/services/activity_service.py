"""Activity logging service — used throughout the app."""
import json
from typing import Optional
from flask import request

from app import db
from backend.models.announcement import ActivityLog


def log_activity(
    action: str,
    user_id: Optional[str] = None,
    department_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    extra: Optional[dict] = None,
) -> ActivityLog:
    """
    Record an activity log entry.
    
    Args:
        action: One of ActivityLog.ACTIONS
        user_id: The acting user's ID
        department_id: The relevant department (if applicable)
        resource_type: file | message | task | announcement | user | department
        resource_id: UUID of the resource
        details: Human-readable description
        ip_address: Client IP
        user_agent: Browser/client user agent
        extra: Additional dict data serialized to JSON in details
    """
    if extra and not details:
        details = json.dumps(extra)
    elif extra and details:
        try:
            existing = json.loads(details) if details.startswith("{") else {"msg": details}
        except Exception:
            existing = {"msg": details}
        existing.update(extra)
        details = json.dumps(existing)

    # Parse browser/device from UA
    browser, device = _parse_ua(user_agent or "")

    log = ActivityLog(
        user_id=user_id,
        department_id=department_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address or _get_ip(),
        user_agent=(user_agent or _get_ua())[:500],
        browser=browser,
        device_type=device,
    )
    db.session.add(log)
    # Note: caller is responsible for committing if they haven't already,
    # or we use db.session.flush() here. To keep it simple, we commit here.
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

    return log


def _get_ip() -> str:
    try:
        return request.headers.get("X-Forwarded-For", request.remote_addr or "")[:45]
    except RuntimeError:
        return ""


def _get_ua() -> str:
    try:
        return request.headers.get("User-Agent", "")[:500]
    except RuntimeError:
        return ""


def _parse_ua(ua: str) -> tuple:
    """Very lightweight UA parsing for device/browser type."""
    ua_lower = ua.lower()

    # Device
    if any(k in ua_lower for k in ("mobile", "android", "iphone")):
        device = "mobile"
    elif any(k in ua_lower for k in ("tablet", "ipad")):
        device = "tablet"
    else:
        device = "desktop"

    # Browser
    if "edg/" in ua_lower:
        browser = "Edge"
    elif "chrome/" in ua_lower:
        browser = "Chrome"
    elif "firefox/" in ua_lower:
        browser = "Firefox"
    elif "safari/" in ua_lower:
        browser = "Safari"
    elif "opera" in ua_lower:
        browser = "Opera"
    else:
        browser = "Unknown"

    return browser, device
