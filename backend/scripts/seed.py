#!/usr/bin/env python
"""
Seed script — creates three test users for local development:

  alice@bandup.dev  password: alice123   → active subscription
  bob@bandup.dev    password: bob123     → promo code access
  carol@bandup.dev  password: carol123   → free tier (no access)

Run with:  uv run python scripts/seed.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "app"))

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=False)

from db.db_functions import Users_DB
from utils.security import hash_password
from core.config import DSN, PROMO_CODE

USERS = [
    {
        "name": "Alice (Subscribed)",
        "email": "alice@bandup.dev",
        "password": "alice123",
        "sub_status": "active",
    },
    {
        "name": "Bob (Promo)",
        "email": "bob@bandup.dev",
        "password": "bob123",
        "promo": True,
    },
    {
        "name": "Carol (Free)",
        "email": "carol@bandup.dev",
        "password": "carol123",
    },
]


async def seed():
    db = Users_DB(DSN)
    rc = await db.initialize()
    if rc != 0:
        print("ERROR: Could not connect to the database. Check DATABASE_URL in .env")
        return

    for u in USERS:
        pw_hash = hash_password(u["password"]).decode()
        created = await db.add_user(u["name"], pw_hash, u["email"])
        if created is None:
            print(f"  skip  {u['email']} (already exists)")
        else:
            print(f"  created {u['email']}")

        row = await db.get_user_from_email(u["email"])
        if not row:
            continue
        uid = row["id"]

        if u.get("sub_status"):
            await db.upsert_subscription(
                user_id=uid,
                stripe_customer_id=f"cus_seed_{uid}",
                stripe_subscription_id=f"sub_seed_{uid}",
                stripe_price_id="price_seed_monthly",
                status=u["sub_status"],
            )
            print(f"         → subscription: {u['sub_status']}")

        if u.get("promo") and PROMO_CODE:
            already = await db.has_redeemed_promo(uid, PROMO_CODE)
            if not already:
                await db.redeem_promo(uid, PROMO_CODE)
                print(f"         → promo redeemed: {PROMO_CODE}")

    await db.close()
    print("\nDone. Login credentials:")
    for u in USERS:
        print(f"  {u['email']}  /  {u['password']}")


if __name__ == "__main__":
    asyncio.run(seed())
