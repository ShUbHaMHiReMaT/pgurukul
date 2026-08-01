"""Database bootstrap — create tables and seed fixed accounts.

Idempotent: safe to call on every app boot. This exists so the app
works on hosting tiers with no shell access (e.g. Render's free tier) —
no manual `python setup_db.py` step is required, ever.
"""
import secrets


NAMED_ADMINS = [
    ("shubham", "shubham@pgurukul.local", "iWMzv1AxEau$"),
    ("shreyas", "shreyas@pgurukul.local", "0G5TSP45L8S&"),
    ("suyog", "suyog@pgurukul.local", "Pr4fk1bfyWE$"),
    ("ompatil", "ompatil@pgurukul.local", "H7vLpQ2mXtR$"),
    ("ankita", "ankita@pgurukul.local", "B4wNzK9jFcY#"),
]
NAMED_INTERNS = [
    ("vaish", "vaish@pgurukul.local", "JLAR7NhC3YN*"),
    ("shreecharan", "shreecharan@pgurukul.local", "o1EAGQqWCRe*"),
    ("adarsh", "adarsh@pgurukul.local", "KKwnoOc2ino@"),
    ("vinuta", "vinuta@pgurukul.local", "5IFmEvk9pYr#"),
    ("vinaya", "vinaya@pgurukul.local", "UExAr1CNpRQ*"),
]


def bootstrap_database(app, db, log=print) -> None:
    """Create all tables (if missing) and seed fixed accounts (if missing).

    Must be called inside an app context. `log` receives one-line status
    strings — pass `app.logger.info` for silent-at-boot use, or `print`
    for the CLI (setup_db.py).
    """
    # Import models so db.create_all() sees every table.
    from backend.models.department import Department
    from backend.models.user import User
    from backend.models.file import File, FileVersion
    from backend.models.message import Message, Mention
    from backend.models.task import Task, TaskAssignment
    from backend.models.announcement import Announcement, Notification, ActivityLog
    from backend.services.auth_service import create_super_admin, hash_password

    db.create_all()

    if not User.query.filter_by(role="super_admin").first():
        create_super_admin(username="admin", email="admin@pgurukul.local", password="Admin@12345")
        log("[bootstrap] created default super admin admin@pgurukul.local / Admin@12345")

    dept = Department.query.first()
    if not dept:
        dept = Department(
            name="General",
            slug="general",
            description="Default department for all team members",
            icon="🏢",
            storage_limit_bytes=50 * 1024 * 1024 * 1024,
            is_active=True,
        )
        db.session.add(dept)
        db.session.commit()
        log(f"[bootstrap] created department 'General' (invite: {dept.invite_code})")

    seeded = 0
    for username, email, password in NAMED_ADMINS:
        if User.query.filter((User.username == username) | (User.email == email)).first():
            continue
        db.session.add(User(
            username=username, email=email, password_hash=hash_password(password),
            role="super_admin", is_active=True, is_verified=True,
        ))
        seeded += 1
    for username, email, password in NAMED_INTERNS:
        if User.query.filter((User.username == username) | (User.email == email)).first():
            continue
        db.session.add(User(
            username=username, email=email, password_hash=hash_password(password),
            role="intern", department_id=dept.id, is_active=True, is_verified=True,
        ))
        seeded += 1
    if seeded:
        db.session.commit()
        log(f"[bootstrap] seeded {seeded} named account(s)")

    import os
    os.makedirs(app.config.get("UPLOAD_FOLDER", "uploads"), exist_ok=True)
