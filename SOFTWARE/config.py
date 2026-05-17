import os
from dotenv import load_dotenv

load_dotenv() 
class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'mysql+pymysql://root:0739@localhost/mydb'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SECRET_KEY = os.environ.get('SECRET_KEY',     'kpi-web-project-key')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'kpi-cloud-calendar-super-secret-key-32-chars-long-!!!')

    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_USERNAME', 'cioudcaiendarapp@gmail.com')
