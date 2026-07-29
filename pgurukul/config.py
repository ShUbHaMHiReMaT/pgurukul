"""PGURUKUL Configuration — loads from .env automatically."""
import os
from datetime import timedelta
from dotenv import load_dotenv

# Always load .env from project root if present
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH, override=True)


def _get_db_uri():
    """Helper to dynamically resolve Postgres or fallback to SQLite."""
    raw = os.environ.get('DATABASE_URL', '')
    if raw.startswith('postgres://'):
        raw = raw.replace('postgres://', 'postgresql://', 1)
    return raw or f'sqlite:///{os.path.join(BASE_DIR, "pgurukul.db")}'


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-CHANGE-THIS-NOW')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = _get_db_uri()
    
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 299,
        'pool_pre_ping': True,
        'pool_size': 10,
        'max_overflow': 20,
    }

    # Folders
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    LOG_DIR = os.path.join(BASE_DIR, 'logs')
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

    # Session / cookies
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    REMEMBER_COOKIE_DURATION = timedelta(days=7)
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SECURE = False

    # Upload limit — 100 MB
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 100 * 1024 * 1024))

    # Rate limiting
    RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL', 'memory://')

    # Caching
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300

    # WTF CSRF
    WTF_CSRF_TIME_LIMIT = 3600
    WTF_CSRF_SSL_STRICT = False

    # Storage — Cloudflare R2 or local disk fallback
    USE_R2_STORAGE = os.environ.get('USE_R2_STORAGE', 'false').lower() == 'true'
    R2_ENDPOINT_URL = os.environ.get('R2_ENDPOINT_URL', '')
    R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID', '')
    R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
    R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME', 'pgurukul')
    R2_PUBLIC_URL = os.environ.get('R2_PUBLIC_URL', '')
    LOCAL_STORAGE_PATH = os.environ.get('LOCAL_STORAGE_PATH', UPLOAD_FOLDER)

    ITEMS_PER_PAGE = 25

    @staticmethod
    def init_app(app):
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(Config.LOG_DIR, exist_ok=True)


class DevelopmentConfig(Config):
    DEBUG = True

    @staticmethod
    def init_app(app):
        Config.init_app(app)


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False

    @staticmethod
    def init_app(app):
        Config.init_app(app)


class ProductionConfig(Config):
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_SECURE = True
    WTF_CSRF_SSL_STRICT = True
    LOG_LEVEL = 'WARNING'

    @classmethod
    def init_app(cls, app):
        Config.init_app(app)

        raw = os.environ.get('DATABASE_URL', '')
        if raw.startswith('postgres://'):
            raw = raw.replace('postgres://', 'postgresql://', 1)

        if raw:
            app.config['SQLALCHEMY_DATABASE_URI'] = raw

        if os.environ.get('R2_ACCESS_KEY_ID'):
            app.config['USE_R2_STORAGE'] = True


config_map = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}