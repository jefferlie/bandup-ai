import os

IS_ON_PROD = False

BASE_URL = 'http://backend.bandup-ai.com' if IS_ON_PROD else 'http://127.0.0.1:5000'
DSN = os.getenv('DATABASE_URL') if IS_ON_PROD else "postgresql://fisuan:1337@localhost:5432/bandup_db"


'''Exceptions'''
class UserExistsException(Exception):
    def __init__(self, message: str, code: int = 1):
        super().__init__(f"User with email {message} is already exists!")
        self.code = code
