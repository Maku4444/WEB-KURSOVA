from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    user_id       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username      = db.Column(db.String(45),  unique=True, nullable=False)
    email         = db.Column(db.String(45),  unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role          = db.Column(db.String(20),  default='User')
    avatar_path   = db.Column(db.String(255), nullable=True, default=None)
    categories = db.relationship('Category', backref='owner', lazy=True, cascade='all, delete-orphan')
    events     = db.relationship('Event',    backref='owner', lazy=True, cascade='all, delete-orphan')


class Category(db.Model):
    __tablename__ = 'categories'

    categorie_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name         = db.Column(db.String(45), unique=True, nullable=False)
    color_hex    = db.Column(db.String(7),  default='#3b82f6')
    user_id      = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)


class Event(db.Model):
    __tablename__ = 'events'

    id_events       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title           = db.Column(db.String(45), nullable=False)
    start_time      = db.Column(db.DateTime,   nullable=False)
    end_time        = db.Column(db.DateTime,   nullable=False)
    actual_duration = db.Column(db.Numeric(10, 0), nullable=True)
    user_id         = db.Column(db.Integer, db.ForeignKey('users.user_id'),           nullable=False)
    category_id     = db.Column(db.Integer, db.ForeignKey('categories.categorie_id'), nullable=True)
    reminder_sent = db.Column(db.Boolean, default=False)