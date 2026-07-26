"""Search service — PostgreSQL full-text search."""
from typing import List, Dict, Any, Optional
from sqlalchemy import text, or_, func
from app import db
from backend.models.user import User
from backend.models.file import File
from backend.models.message import Message
from backend.models.task import Task
from backend.models.announcement import Announcement


def global_search(
    query: str,
    department_id: Optional[str],
    user_role: str,
    limit: int = 20,
) -> Dict[str, List[Dict]]:
    """
    Search across files, messages, tasks, announcements, and users.
    department_id=None means super_admin (search all).
    """
    q = query.strip()
    if not q or len(q) < 2:
        return {"files": [], "messages": [], "tasks": [], "announcements": [], "users": []}

    results = {
        "files": _search_files(q, department_id, limit),
        "messages": _search_messages(q, department_id, limit),
        "tasks": _search_tasks(q, department_id, limit),
        "announcements": _search_announcements(q, department_id, limit),
        "users": _search_users(q, department_id, user_role, limit // 2),
    }
    return results


def _search_files(q: str, dept_id: Optional[str], limit: int) -> List[Dict]:
    base = File.query.filter(File.is_deleted == False)
    if dept_id:
        base = base.filter(File.department_id == dept_id)
    files = base.filter(
        or_(
            File.name.ilike(f"%{q}%"),
            File.description.ilike(f"%{q}%"),
        )
    ).limit(limit).all()
    return [f.to_dict() for f in files]


def _search_messages(q: str, dept_id: Optional[str], limit: int) -> List[Dict]:
    base = Message.query.filter(
        Message.is_deleted == False,
        Message.content.ilike(f"%{q}%"),
    )
    if dept_id:
        base = base.filter(Message.department_id == dept_id)
    msgs = base.order_by(Message.created_at.desc()).limit(limit).all()
    return [m.to_dict() for m in msgs]


def _search_tasks(q: str, dept_id: Optional[str], limit: int) -> List[Dict]:
    base = Task.query.filter(
        Task.is_deleted == False,
        or_(Task.title.ilike(f"%{q}%"), Task.description.ilike(f"%{q}%")),
    )
    if dept_id:
        base = base.filter(Task.department_id == dept_id)
    tasks = base.limit(limit).all()
    return [t.to_dict() for t in tasks]


def _search_announcements(q: str, dept_id: Optional[str], limit: int) -> List[Dict]:
    base = Announcement.query.filter(
        Announcement.is_deleted == False,
        or_(
            Announcement.title.ilike(f"%{q}%"),
            Announcement.content.ilike(f"%{q}%"),
        ),
    )
    if dept_id:
        base = base.filter(
            or_(Announcement.department_id == dept_id, Announcement.is_global == True)
        )
    announcements = base.order_by(Announcement.created_at.desc()).limit(limit).all()
    return [a.to_dict() for a in announcements]


def _search_users(q: str, dept_id: Optional[str], role: str, limit: int) -> List[Dict]:
    if role not in ("super_admin", "department_lead"):
        return []
    base = User.query.filter(
        User.is_active == True,
        or_(
            User.username.ilike(f"%{q}%"),
            User.display_name.ilike(f"%{q}%"),
            User.email.ilike(f"%{q}%"),
        ),
    )
    if dept_id and role == "department_lead":
        base = base.filter(User.department_id == dept_id)
    users = base.limit(limit).all()
    return [u.to_dict(public=False) for u in users]
