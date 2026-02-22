import bcrypt


def hash_password(plain: str) -> bytes:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain.encode(), salt)
    return hashed

def verify_password(plain: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed)

