import datetime
import os
import sys
import uuid
import datetime
import jwt
from flask_apscheduler import APScheduler
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_mail import Mail, Message
from functools import wraps
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from config import Config
from models import Category, Event, User, db
from dotenv import load_dotenv

load_dotenv()
REQUIRED_ENV_VARS = ['MAIL_USERNAME', 'MAIL_PASSWORD']

def check_env():
    missing_vars = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
    
    if missing_vars:
        print("\n[КРИТИЧНА ПОМИЛКА КОНФІГУРАЦІЇ]")
        print(f"Відсутні обов'язкові змінні середовища: {', '.join(missing_vars)}")
        print("Переконайтеся, що файл .env існує та заповнений правильно.")
        print("-" * 40)
        sys.exit(1) 

check_env()

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ---------------------------------------------------------------------------
# Ініціалізація додатку
# ---------------------------------------------------------------------------
app = Flask(__name__, static_folder='static', static_url_path='')
app.config.from_object(Config)

mail = Mail(app)
CORS(app)
db.init_app(app)

AVATAR_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'avatars')
os.makedirs(AVATAR_FOLDER, exist_ok=True)

with app.app_context():
    db.create_all()


# ---------------------------------------------------------------------------
# Допоміжні функції
# ---------------------------------------------------------------------------

def send_notification_email(recipient_email: str, subject: str, body: str) -> bool:
    """Надсилає email-повідомлення. Повертає True у разі успіху."""
    try:
        msg = Message(subject, recipients=[recipient_email])
        msg.body = body
        mail.send(msg)
        return True
    except Exception as exc:
        print(f"[MAIL] Помилка надсилання на {recipient_email}: {exc}")
        return False


def parse_datetime(raw: str) -> datetime.datetime:
    """Перетворює рядок 'YYYY-MM-DDTHH:MM' або 'YYYY-MM-DD HH:MM' на datetime."""
    return datetime.datetime.strptime(raw.replace('T', ' ')[:16], '%Y-%m-%d %H:%M')


# ---------------------------------------------------------------------------
# Декоратори авторизації
# ---------------------------------------------------------------------------

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header or ' ' not in auth_header:
            return jsonify({'message': 'Токен відсутній!'}), 401
        try:
            token = auth_header.split(' ')[1]
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user = db.session.get(User, data['user_id'])
            if not current_user:
                return jsonify({'message': 'Користувача не знайдено!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Токен прострочений!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Токен недійсний!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if current_user.role != 'Admin':
            return jsonify({'message': 'Доступ дозволено лише адміністраторам!'}), 403
        return f(current_user, *args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Профіль
# ---------------------------------------------------------------------------

@app.route('/api/auth/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    avatar_url = (
        f'/avatars/{current_user.avatar_path}'
        if current_user.avatar_path
        else '/img/img2.png'
    )
    return jsonify({
        'full_name':  current_user.username,
        'email':      current_user.email,
        'avatar_url': avatar_url,
    })


@app.route('/api/auth/avatar', methods=['POST'])
@token_required
def upload_avatar(current_user):
    """Завантаження нової аватарки. Очікує multipart/form-data з полем 'avatar'."""
    if 'avatar' not in request.files:
        return jsonify({'error': 'Файл не знайдено у запиті'}), 400

    file = request.files['avatar']

    if file.filename == '':
        return jsonify({'error': 'Файл не вибрано'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Дозволені формати: PNG, JPG, JPEG, GIF, WEBP'}), 400

    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > 5 * 1024 * 1024:
        return jsonify({'error': 'Файл занадто великий. Максимум — 5 МБ'}), 400

    ext      = secure_filename(file.filename).rsplit('.', 1)[1].lower()
    filename = f'user_{current_user.user_id}_{uuid.uuid4().hex[:8]}.{ext}'

    if current_user.avatar_path:
        old_path = os.path.join(AVATAR_FOLDER, current_user.avatar_path)
        if os.path.exists(old_path):
            os.remove(old_path)

    file.save(os.path.join(AVATAR_FOLDER, filename))

    current_user.avatar_path = filename
    db.session.commit()

    return jsonify({
        'message':    'Аватарку успішно оновлено',
        'avatar_url': f'/avatars/{filename}',
    })


@app.route('/api/auth/avatar', methods=['DELETE'])
@token_required
def delete_avatar(current_user):
    """Видалення аватарки — повернення до дефолтної."""
    if current_user.avatar_path:
        old_path = os.path.join(AVATAR_FOLDER, current_user.avatar_path)
        if os.path.exists(old_path):
            os.remove(old_path)
        current_user.avatar_path = None
        db.session.commit()

    return jsonify({'message': 'Аватарку видалено', 'avatar_url': '/img/img2.png'})


@app.route('/api/auth/profile/update', methods=['PUT'])
@token_required
def update_profile(current_user):
    data         = request.json or {}
    new_username = data.get('username', '').strip()
    new_email    = data.get('email', '').strip()
    new_password = data.get('password', '').strip()

    if not new_username or not new_email:
        return jsonify({'error': "Ім'я та email є обов'язковими"}), 400

    if new_email != current_user.email:
        if User.query.filter_by(email=new_email).first():
            return jsonify({'error': 'Ця електронна пошта вже використовується'}), 400

    current_user.username = new_username
    current_user.email    = new_email

    if new_password:
        current_user.password_hash = generate_password_hash(new_password)

    try:
        db.session.commit()
        return jsonify({'message': 'Профіль успішно оновлено',
                        'user': {'name': current_user.username, 'role': current_user.role}})
    except Exception as exc:
        db.session.rollback()
        print(f"[DB] update_profile: {exc}")
        return jsonify({'error': 'Помилка бази даних'}), 500


# ---------------------------------------------------------------------------
# Авторизація
# ---------------------------------------------------------------------------

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    if not data.get('full_name') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Усі поля є обов\'язковими'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Ця пошта вже зайнята'}), 400

    new_user = User(
        username=data['full_name'],
        email=data['email'],
        password_hash=generate_password_hash(data['password'])
    )
    db.session.add(new_user)
    db.session.commit()

    send_notification_email(
        new_user.email,
        'Вітаємо у Cloud Calendar!',
        f'Привіт, {new_user.username}! Твій акаунт успішно створено.'
    )
    return jsonify({'message': 'Реєстрацію успішно завершено!'}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    user = User.query.filter_by(email=data.get('email')).first()

    if not user or not check_password_hash(user.password_hash, data.get('password', '')):
        return jsonify({'error': 'Невірна пошта або пароль'}), 401

    token = jwt.encode(
        {
            'user_id': user.user_id,
            'role': user.role,
            'exp': datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=24)
        },
        app.config['JWT_SECRET_KEY'],
        algorithm='HS256'
    )
    return jsonify({'token': token,
                    'user': {'id': user.user_id, 'name': user.username, 'role': user.role}})


# ---------------------------------------------------------------------------
# Адмін — користувачі
# ---------------------------------------------------------------------------

@app.route('/api/admin/users', methods=['GET'])
@token_required
@admin_required
def get_all_users(current_user):
    users = User.query.filter(User.user_id != current_user.user_id).all()
    return jsonify([
        {'user_id': u.user_id, 'username': u.username, 'email': u.email, 'role': u.role}
        for u in users
    ])


@app.route('/api/admin/users/<int:user_id>/role', methods=['PUT'])
@token_required
@admin_required
def update_user_role(current_user, user_id):
    data     = request.json or {}
    new_role = data.get('role')

    if new_role not in ('User', 'Admin'):
        return jsonify({'error': 'Некоректна роль'}), 400

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'Користувача не знайдено'}), 404

    old_role   = user.role
    user.role  = new_role

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 500

    send_notification_email(
        user.email,
        'Оновлення прав доступу',
        f'Вітаємо, {user.username}!\n\nАдміністратор змінив вашу роль у Cloud Calendar.\n'
        f'Попередня роль: {old_role}\nНова роль: {new_role}'
    )
    return jsonify({'message': f'Роль змінена на {new_role}'})


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_user(current_user, user_id):
    if user_id == current_user.user_id:
        return jsonify({'error': 'Ви не можете видалити власний акаунт'}), 400

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'Користувача не знайдено'}), 404

    user_email = user.email
    user_name  = user.username

    try:
        db.session.delete(user)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 500

    send_notification_email(
        user_email,
        'Ваш акаунт видалено',
        f'Привіт, {user_name}!\n\nВаш акаунт у Cloud Calendar видалений адміністратором. '
        'Усі ваші дані також стерті.'
    )
    return jsonify({'message': f'Користувача {user_name} та всі його дані видалено'})


# ---------------------------------------------------------------------------
# Категорії
# ---------------------------------------------------------------------------

@app.route('/api/categories', methods=['GET'])
@token_required
def get_categories(current_user):
    cats = Category.query.filter_by(user_id=current_user.user_id).all()
    return jsonify([
        {'categorie_id': c.categorie_id, 'name': c.name, 'color_hex': c.color_hex}
        for c in cats
    ])


@app.route('/api/categories', methods=['POST'])
@token_required
def create_category(current_user):
    data = request.json or {}
    if not data.get('name', '').strip():
        return jsonify({'error': 'Назва категорії є обов\'язковою'}), 400

    try:
        cat = Category(
            name=data['name'].strip(),
            color_hex=data.get('color_hex', '#3b82f6'),
            user_id=current_user.user_id
        )
        db.session.add(cat)
        db.session.commit()
        return jsonify({'message': 'Категорію створено'}), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 400


@app.route('/api/categories/<int:cat_id>', methods=['PUT', 'DELETE'])
@token_required
def manage_category(current_user, cat_id):
    cat = Category.query.filter_by(categorie_id=cat_id, user_id=current_user.user_id).first_or_404()

    if request.method == 'DELETE':
        Event.query.filter_by(category_id=cat_id).update({Event.category_id: None})
        db.session.delete(cat)
        db.session.commit()
        return jsonify({'message': 'Категорію видалено'})

    data = request.json or {}
    if not data.get('name', '').strip():
        return jsonify({'error': 'Назва категорії є обов\'язковою'}), 400

    cat.name      = data['name'].strip()
    cat.color_hex = data.get('color_hex', cat.color_hex)
    db.session.commit()
    return jsonify({'message': 'Категорію оновлено'})


# ---------------------------------------------------------------------------
# Події
# ---------------------------------------------------------------------------

@app.route('/api/events', methods=['GET'])
@token_required
def get_events(current_user):
    results = (
        db.session.query(Event, Category)
        .outerjoin(Category, Event.category_id == Category.categorie_id)
        .filter(Event.user_id == current_user.user_id)
        .all()
    )
    return jsonify([
        {
            'id_events':      e.id_events,
            'title':          e.title,
            'start_time':     e.start_time.isoformat(),
            'end_time':       e.end_time.isoformat(),
            'category_id':    e.category_id,
            'category_name':  c.name      if c else 'Без категорії',
            'category_color': c.color_hex if c else '#cbd5e1',
        }
        for e, c in results
    ])


@app.route('/api/events', methods=['POST'])
@token_required
def create_event(current_user):
    data = request.json or {}
    if not data.get('title', '').strip():
        return jsonify({'error': 'Назва події є обов\'язковою'}), 400

    try:
        start = parse_datetime(data['start_time'])
        end   = parse_datetime(data['end_time'])
    except (KeyError, ValueError):
        return jsonify({'error': 'Невірний формат дати'}), 400

    if end <= start:
        return jsonify({'error': 'Час завершення має бути пізніше часу початку'}), 400

    duration_sec = int((end - start).total_seconds())

    try:
        event = Event(
            title=data['title'].strip(),
            start_time=start,
            end_time=end,
            actual_duration=duration_sec,
            user_id=current_user.user_id,
            category_id=data.get('category_id') or None
        )
        db.session.add(event)
        db.session.commit()
        return jsonify({'message': 'Подію створено'}), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 400


@app.route('/api/events/<int:event_id>', methods=['PUT', 'DELETE'])
@token_required
def manage_event(current_user, event_id):
    event = Event.query.filter_by(id_events=event_id, user_id=current_user.user_id).first_or_404()

    if request.method == 'DELETE':
        db.session.delete(event)
        db.session.commit()
        return jsonify({'message': 'Подію видалено'})

    data = request.json or {}
    if not data.get('title', '').strip():
        return jsonify({'error': 'Назва події є обов\'язковою'}), 400

    try:
        start = parse_datetime(data['start_time'])
        end   = parse_datetime(data['end_time'])
    except (KeyError, ValueError):
        return jsonify({'error': 'Невірний формат дати'}), 400

    if end <= start:
        return jsonify({'error': 'Час завершення має бути пізніше часу початку'}), 400

    event.title           = data['title'].strip()
    event.start_time      = start
    event.end_time        = end
    event.actual_duration = int((end - start).total_seconds())
    event.category_id     = data.get('category_id') or None
    db.session.commit()
    return jsonify({'message': 'Подію оновлено'})


# ---------------------------------------------------------------------------
# Аналітика
# ---------------------------------------------------------------------------

@app.route('/api/analytics/stats', methods=['GET'])
@token_required
def get_analytics(current_user):
    results = (
        db.session.query(Event, Category)
        .outerjoin(Category, Event.category_id == Category.categorie_id)
        .filter(Event.user_id == current_user.user_id)
        .all()
    )

    stats         = {}
    total_seconds = 0

    for event, cat in results:
        duration  = max((event.end_time - event.start_time).total_seconds(), 0)
        cat_name  = cat.name      if cat else 'Без категорії'
        cat_color = cat.color_hex if cat else '#cbd5e1'

        if cat_name not in stats:
            stats[cat_name] = {'hours': 0.0, 'color': cat_color}

        stats[cat_name]['hours'] += duration / 3600
        total_seconds            += duration

    total_hours = total_seconds / 3600

    output = [
        {
            'category':   name,
            'hours':      round(data['hours'], 1),
            'percentage': round(data['hours'] / total_hours * 100, 1) if total_hours else 0,
            'color':      data['color'],
        }
        for name, data in stats.items()
    ]

    return jsonify({'total_hours': round(total_hours, 1), 'categories': output})


# ---------------------------------------------------------------------------

@app.route('/')
def serve_index():
    return send_from_directory('static', 'login.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


# ---------------------------------------------------------------------------
scheduler = APScheduler()

def send_event_reminders():
    """Фонова задача: перевірка подій та відправка листів"""
    with app.app_context():
        now = datetime.datetime.now()
        lower_bound = now + datetime.timedelta(minutes=15)
        upper_bound = now + datetime.timedelta(minutes=30)

        upcoming_events = Event.query.filter(
            Event.start_time >= lower_bound,
            Event.start_time <= upper_bound,
            Event.reminder_sent == False
        ).all()

        for event in upcoming_events:
            user = User.query.get(event.user_id)
            if user and user.email:
                try:
                    msg = Message(
                        subject=f"Нагадування: {event.title}",
                        recipients=[user.email],
                        body=f"Привіт, {user.username}!\n\nНагадуємо, що ваша подія '{event.title}' розпочнеться о {event.start_time.strftime('%H:%M')}.\n\nНе забудьте підготуватися!"
                    )
                    mail.send(msg)
                    
                    event.reminder_sent = True
                    db.session.commit()
                    print(f"Reminder sent for user: {user.username} for event {event.title}")
                except Exception as e:
                    print(f"Error sending email: {e}")

if __name__ == '__main__':
    scheduler.add_job(id='reminder_job', func=send_event_reminders, trigger='interval', seconds=60)
    scheduler.init_app(app)
    scheduler.start()
    app.run(debug=True, use_reloader=False)