"""Household ledger rules shared by persistence.

Money effects, password checks, and invite refresh live here so later
automatic deductions can reuse the same entry shape without rewriting
manual posting.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional
import re


SOURCE_MANUAL = "manual"
SOURCE_AUTOMATIC = "automatic"

# Letters, digits, and common symbols. The set includes ! @ # . _ -
_PASSWORD = re.compile(r"^[A-Za-z0-9!@#$%^&*()_+=.,?-]{6,16}$")
_PHONE = re.compile(r"^\d{11}$")
_MONEY = Decimal("0.01")


class DomainError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


@dataclass(frozen=True)
class EntryEffect:
    balance: Decimal
    direction: str
    amount: Decimal
    source: str
    entry_kind: str
    monthly_expense: Decimal
    monthly_income: Decimal
    creates_ledger: bool = True


@dataclass(frozen=True)
class BalanceEdit:
    balance: Decimal
    creates_ledger: bool = False


@dataclass(frozen=True)
class InviteRefresh:
    retired: Optional[str]
    active: str


def _money(value) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(_MONEY)
    except Exception as exc:
        raise DomainError("金额无效") from exc
    if amount <= 0:
        raise DomainError("金额必须大于 0")
    return amount


def validate_phone(phone: str) -> None:
    if not isinstance(phone, str) or _PHONE.fullmatch(phone) is None:
        raise DomainError("手机号需为11位数字")


def validate_password(password: str) -> None:
    if not isinstance(password, str) or _PASSWORD.fullmatch(password) is None:
        raise DomainError("密码需为6-16位，由数字、字母和常见符号组成")


def apply_manual(balance, direction: str, amount, entry_kind: str = "ledger") -> EntryEffect:
    """Post one manual row. Never emits an automatic deduction."""
    if direction not in ("expense", "income"):
        raise DomainError("方向无效")
    if entry_kind not in ("ledger", "renqing"):
        raise DomainError("记录类型无效")
    current = Decimal(str(balance)).quantize(_MONEY)
    posted = _money(amount)
    if direction == "expense":
        return EntryEffect(
            balance=current - posted,
            direction="expense",
            amount=posted,
            source=SOURCE_MANUAL,
            entry_kind=entry_kind,
            monthly_expense=posted,
            monthly_income=Decimal("0.00"),
        )
    return EntryEffect(
        balance=current + posted,
        direction="income",
        amount=posted,
        source=SOURCE_MANUAL,
        entry_kind=entry_kind,
        monthly_expense=Decimal("0.00"),
        monthly_income=posted,
    )


def apply_renqing(balance, side: str, amount) -> EntryEffect:
    """随出 is an expense. 收回 is income. Both are manual ledger rows."""
    if side == "out":
        direction = "expense"
    elif side == "in":
        direction = "income"
    else:
        raise DomainError("人情方向无效")
    return apply_manual(balance, direction, amount, entry_kind="renqing")


def manual_balance_edit(new_balance) -> BalanceEdit:
    """Change the stored balance without creating a ledger row."""
    try:
        amount = Decimal(str(new_balance)).quantize(_MONEY)
    except Exception as exc:
        raise DomainError("金额无效") from exc
    return BalanceEdit(balance=amount, creates_ledger=False)


def refresh_invite(active_code: Optional[str], new_code: str) -> InviteRefresh:
    """Replace the usable code. The previous code stops working immediately."""
    if not isinstance(new_code, str) or len(new_code) != 6:
        raise DomainError("邀请码无效")
    if active_code and new_code == active_code:
        raise DomainError("新邀请码与当前相同")
    return InviteRefresh(retired=active_code, active=new_code)


def invite_is_usable(code: Optional[str], active_code: Optional[str], at: datetime) -> bool:
    """Usable means it is the current code. The clock does not expire it."""
    del at
    return bool(code) and code == active_code
