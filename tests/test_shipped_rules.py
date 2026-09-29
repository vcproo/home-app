"""Calls the shipped rule functions. Does not reimplement them."""

from datetime import datetime
from decimal import Decimal
import unittest

from domain.rules import (
    SOURCE_AUTOMATIC,
    SOURCE_MANUAL,
    DomainError,
    apply_manual,
    apply_renqing,
    invite_is_usable,
    manual_balance_edit,
    refresh_invite,
    validate_password,
    validate_phone,
)


class AuthRulesTest(unittest.TestCase):
    def test_phone_and_password_bounds(self):
        validate_phone("13800138000")
        validate_password("abc123")
        validate_password("ab12!@#._-")
        for phone in ("1380013800", "138001380001", "1380013800a", ""):
            with self.assertRaises(DomainError):
                validate_phone(phone)
        for password in ("abc12", "a" * 17, "abc 123", "密码abc12", "中文1234", ""):
            with self.assertRaises(DomainError):
                validate_password(password)

    def test_manual_expense_and_income(self):
        start = Decimal("100.00")
        expense = apply_manual(start, "expense", "30.00")
        self.assertEqual(expense.balance, start - Decimal("30.00"))
        self.assertEqual(expense.monthly_expense, Decimal("30.00"))
        self.assertEqual(expense.monthly_income, Decimal("0.00"))
        self.assertEqual(expense.source, SOURCE_MANUAL)
        self.assertNotEqual(expense.source, SOURCE_AUTOMATIC)
        self.assertTrue(expense.creates_ledger)

        income = apply_manual(expense.balance, "income", "12.50")
        self.assertEqual(income.balance, expense.balance + Decimal("12.50"))
        self.assertEqual(income.monthly_income, Decimal("12.50"))
        self.assertEqual(income.monthly_expense, Decimal("0.00"))
        self.assertEqual(income.source, SOURCE_MANUAL)

    def test_renqing_uses_the_same_directions(self):
        start = Decimal("80.00")
        out = apply_renqing(start, "out", "10")
        self.assertEqual(out.direction, "expense")
        self.assertEqual(out.balance, start - Decimal("10.00"))
        self.assertEqual(out.entry_kind, "renqing")
        self.assertEqual(out.source, SOURCE_MANUAL)
        back = apply_renqing(out.balance, "in", "4")
        self.assertEqual(back.direction, "income")
        self.assertEqual(back.balance, out.balance + Decimal("4.00"))
        self.assertEqual(back.source, SOURCE_MANUAL)

    def test_manual_balance_edit_creates_no_ledger(self):
        edit = manual_balance_edit("42.5")
        self.assertEqual(edit.balance, Decimal("42.50"))
        self.assertFalse(edit.creates_ledger)

    def test_invite_refresh_ignores_the_clock(self):
        changed = refresh_invite("F7K2M9", "A1B2C3")
        later = datetime(2099, 12, 31, 23, 59)
        earlier = datetime(2000, 1, 1)
        self.assertFalse(invite_is_usable(changed.retired, changed.active, later))
        self.assertTrue(invite_is_usable(changed.active, changed.active, later))
        self.assertTrue(invite_is_usable(changed.active, changed.active, earlier))


if __name__ == "__main__":
    unittest.main()
