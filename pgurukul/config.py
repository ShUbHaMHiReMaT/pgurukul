"""PGURUKUL Configuration."""
import os
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-change-in-prod-pgurukul-2024')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 299,
        'pool_pre_ping': True,
    }

    # Folders
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    LOG_DIR = os.path.join(BASE_DIR, 'logs')
    LOG_LEVEL = 'INFO'

    # Session
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    REMEMBER_COOKIE_DURATION = timedelta(days=7)
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SECURE = False

    # Upload limits — 100 MB
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 100 * 1024 * 1024))

    # Rate limiting
    RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL', 'memory://')
    RATELIMIT_DEFAULT = '500 per hour'

    # Flask-Caching
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300

    # WTF
    WTF_CSRF_TIME_LIMIT = 3600
    WTF_CSRF_SSL_STRICT = False

    # Storage — Cloudflare R2 or local fallback
    USE_R2_STORAGE = os.environ.get('USE_R2_STORAGE', 'false').lower() == 'true'
    R2_ENDPOINT_URL = os.environ.get('R2_ENDPOINT_URL', '')
    R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID', '')
    R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
    R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME', 'pgurukul')
    R2_PUBLIC_URL = os.environ.get('R2_PUBLIC_URL', '')
    LOCAL_STORAGE_PATH = UPLOAD_FOLDER

    # Pagination
    ITEMS_PER_PAGE = 25

    @staticmethod
    def init_app(app):
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(Config.LOG_DIR, exist_ok=True)


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'postgresql://postgres:postgres@localhost:5432/pgurukul_dev'
    )
    SESSION_COOKIE_SECURE = False
    REMEMBER_COOKIE_SECURE = False

    @staticmethod
    def init_app(app):
        Config.init_app(app)


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    SERVER_NAME = 'localhost'

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

        raw_db_url = os.environ.get('DATABASE_URL', '')
        if raw_db_url.startswith('postgres://'):
            raw_db_url = raw_db_url.replace('postgres://', 'postgresql://', 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = raw_db_url

        if os.environ.get('R2_ACCESS_KEY_ID'):
            app.config['USE_R2_STORAGE'] = True


config_map = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
