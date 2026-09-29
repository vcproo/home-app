"""Persistence for the documented home-app MySQL database."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from pathlib import Path
import hashlib
import hmac
import os
import re
import secrets

import pymysql

from domain.rules import (
    apply_manual,
    apply_renqing,
    invite_is_usable,
    manual_balance_edit,
    refresh_invite,
    validate_password,
    validate_phone,
)
from domain.rules import DomainError


_DOC = Path(__file__).resolve().parents[1] / "本地数据库连接.md"
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

SCHEMA = [
    """
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(11) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      nickname VARCHAR(64) NOT NULL DEFAULT '',
      UNIQUE KEY uniq_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS families (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      member_limit INT NOT NULL DEFAULT 8
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS members (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      family_id INT NOT NULL,
      user_id INT NOT NULL,
      role VARCHAR(16) NOT NULL,
      display_name VARCHAR(64) NOT NULL,
      KEY idx_family (family_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      family_id INT NOT NULL,
      code VARCHAR(6) NOT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      KEY idx_family_active (family_id, active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS accounts (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      family_id INT NOT NULL,
      owner_member_id INT NOT NULL,
      name VARCHAR(64) NOT NULL,
      account_type VARCHAR(16) NOT NULL,
      balance DECIMAL(14,2) NOT NULL,
      KEY idx_family (family_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      family_id INT NOT NULL,
      account_id INT NOT NULL,
      member_id INT NOT NULL,
      direction VARCHAR(8) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      source VARCHAR(16) NOT NULL,
      entry_kind VARCHAR(16) NOT NULL,
      title VARCHAR(128) NULL,
      occurred_on DATE NOT NULL,
      created_at DATETIME NOT NULL,
      source_ref VARCHAR(64) NULL,
      KEY idx_family_day (family_id, occurred_on)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
]


def connection_settings(doc_path: Path | None = None) -> dict:
    text = (doc_path or _DOC).read_text(encoding="utf-8")

    def cell(label: str) -> str:
        match = re.search(r"\|\s*" + re.escape(label) + r"\s*\|\s*([^|\n]+)\|", text)
        if not match:
            raise DomainError("数据库文档缺少 " + label)
        return match.group(1).strip()

    port_text = cell("端口")
    port_match = re.search(r"\d+", port_text)
    return {
        "host": cell("主机"),
        "port": int(port_match.group(0) if port_match else "3306"),
        "user": cell("账号"),
        "password": cell("密码"),
        "database": cell("数据库"),
        "charset": "utf8mb4",
        "autocommit": False,
        "connect_timeout": 5,
        "read_timeout": 20,
        "write_timeout": 20,
    }


def connect(doc_path: Path | None = None):
    return pymysql.connect(**connection_settings(doc_path))


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return salt.hex() + ":" + digest.hex()


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except ValueError:
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return hmac.compare_digest(actual, expected)


def _new_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(6))


class HomeStore:
    """Manual write path. Automatic deductions are not posted."""

    def __init__(self, conn):
        self.conn = conn

    def ensure_schema(self) -> None:
        with self.conn.cursor() as cur:
            for statement in SCHEMA:
                cur.execute(statement)
        self.conn.commit()

    def register(self, phone: str, password: str, nickname: str = "") -> int:
        validate_phone(phone)
        validate_password(password)
        with self.conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE phone=%s", (phone,))
            if cur.fetchone():
                raise DomainError("手机号已注册")
            cur.execute(
                "INSERT INTO users (phone, password_hash, nickname) VALUES (%s, %s, %s)",
                (phone, _hash_password(password), nickname),
            )
            user_id = cur.lastrowid
        self.conn.commit()
        return int(user_id)

    def login(self, phone: str, password: str) -> int:
        validate_phone(phone)
        validate_password(password)
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT id, password_hash FROM users WHERE phone=%s",
                (phone,),
            )
            row = cur.fetchone()
        if not row or not _verify_password(password, row[1]):
            raise DomainError("手机号或密码错误")
        return int(row[0])

    def create_family(self, user_id: int, name: str, display_name: str) -> dict:
        code = _new_code()
        with self.conn.cursor() as cur:
            cur.execute("INSERT INTO families (name, member_limit) VALUES (%s, 8)", (name,))
            family_id = int(cur.lastrowid)
            cur.execute(
                """
                INSERT INTO members (family_id, user_id, role, display_name)
                VALUES (%s, %s, 'admin', %s)
                """,
                (family_id, user_id, display_name),
            )
            member_id = int(cur.lastrowid)
            cur.execute(
                """
                INSERT INTO invite_codes (family_id, code, active, created_at)
                VALUES (%s, %s, 1, %s)
                """,
                (family_id, code, datetime.now()),
            )
        self.conn.commit()
        return {"family_id": family_id, "member_id": member_id, "invite_code": code}

    def active_invite(self, family_id: int) -> str | None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT code FROM invite_codes
                WHERE family_id=%s AND active=1
                ORDER BY id DESC LIMIT 1
                """,
                (family_id,),
            )
            row = cur.fetchone()
        return row[0] if row else None

    def code_is_usable(self, family_id: int, code: str, at: datetime) -> bool:
        return invite_is_usable(code, self.active_invite(family_id), at)

    def refresh_invite(self, family_id: int) -> str:
        current = self.active_invite(family_id)
        change = refresh_invite(current, _new_code())
        now = datetime.now()
        with self.conn.cursor() as cur:
            if change.retired:
                cur.execute(
                    """
                    UPDATE invite_codes SET active=0
                    WHERE family_id=%s AND code=%s AND active=1
                    """,
                    (family_id, change.retired),
                )
            cur.execute(
                """
                INSERT INTO invite_codes (family_id, code, active, created_at)
                VALUES (%s, %s, 1, %s)
                """,
                (family_id, change.active, now),
            )
        self.conn.commit()
        return change.active

    def add_account(self, family_id: int, member_id: int, name: str, account_type: str, balance) -> int:
        opening = manual_balance_edit(balance)
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO accounts (family_id, owner_member_id, name, account_type, balance)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (family_id, member_id, name, account_type, opening.balance),
            )
            account_id = int(cur.lastrowid)
        self.conn.commit()
        return account_id

    def set_balance(self, account_id: int, new_balance) -> Decimal:
        edit = manual_balance_edit(new_balance)
        if edit.creates_ledger:
            raise DomainError("手动改余额不能产生流水")
        before = self._ledger_count_for_account(account_id)
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE accounts SET balance=%s WHERE id=%s",
                (edit.balance, account_id),
            )
            if cur.rowcount != 1:
                raise DomainError("账户不存在")
        self.conn.commit()
        if self._ledger_count_for_account(account_id) != before:
            raise DomainError("手动改余额不能产生流水")
        return edit.balance

    def post_ledger(
        self,
        family_id: int,
        account_id: int,
        member_id: int,
        direction: str,
        amount,
        title: str,
        occurred_on,
    ) -> int:
        balance = self._balance(account_id)
        effect = apply_manual(balance, direction, amount, entry_kind="ledger")
        return self._write_effect(family_id, account_id, member_id, effect, title, occurred_on)

    def post_renqing(
        self,
        family_id: int,
        account_id: int,
        member_id: int,
        side: str,
        amount,
        title: str,
        occurred_on,
    ) -> int:
        balance = self._balance(account_id)
        effect = apply_renqing(balance, side, amount)
        return self._write_effect(family_id, account_id, member_id, effect, title, occurred_on)

    def read_entry(self, entry_id: int) -> dict | None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, direction, amount, source, entry_kind, account_id, title
                FROM ledger_entries WHERE id=%s
                """,
                (entry_id,),
            )
            row = cur.fetchone()
        if not row:
            return None
        return {
            "id": int(row[0]),
            "direction": row[1],
            "amount": Decimal(str(row[2])).quantize(Decimal("0.01")),
            "source": row[3],
            "entry_kind": row[4],
            "account_id": int(row[5]),
            "title": row[6],
        }

    def account_balance(self, account_id: int) -> Decimal:
        return self._balance(account_id)

    def monthly_totals(self, family_id: int, year: int, month: int) -> dict:
        start = datetime(year, month, 1)
        if month == 12:
            end = datetime(year + 1, 1, 1)
        else:
            end = datetime(year, month + 1, 1)
        expense = Decimal("0.00")
        income = Decimal("0.00")
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT direction, SUM(amount)
                FROM ledger_entries
                WHERE family_id=%s AND occurred_on >= %s AND occurred_on < %s
                GROUP BY direction
                """,
                (family_id, start.date(), end.date()),
            )
            for direction, total in cur.fetchall():
                amount = Decimal(str(total or 0)).quantize(Decimal("0.01"))
                if direction == "expense":
                    expense = amount
                elif direction == "income":
                    income = amount
        return {"expense": expense, "income": income}

    def _write_effect(self, family_id, account_id, member_id, effect, title, occurred_on) -> int:
        if effect.source != "manual":
            raise DomainError("当前只记手动流水")
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE accounts SET balance=%s WHERE id=%s",
                (effect.balance, account_id),
            )
            cur.execute(
                """
                INSERT INTO ledger_entries (
                  family_id, account_id, member_id, direction, amount, source,
                  entry_kind, title, occurred_on, created_at, source_ref
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NULL)
                """,
                (
                    family_id,
                    account_id,
                    member_id,
                    effect.direction,
                    effect.amount,
                    effect.source,
                    effect.entry_kind,
                    title,
                    occurred_on,
                    datetime.now(),
                ),
            )
            entry_id = int(cur.lastrowid)
        self.conn.commit()
        return entry_id

    def _balance(self, account_id: int) -> Decimal:
        with self.conn.cursor() as cur:
            cur.execute("SELECT balance FROM accounts WHERE id=%s", (account_id,))
            row = cur.fetchone()
        if not row:
            raise DomainError("账户不存在")
        return Decimal(str(row[0])).quantize(Decimal("0.01"))

    def _ledger_count_for_account(self, account_id: int) -> int:
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM ledger_entries WHERE account_id=%s",
                (account_id,),
            )
            return int(cur.fetchone()[0])
