"""Writes through HomeStore and reads the row back on a second connection."""

from datetime import datetime
from decimal import Decimal
import unittest

from domain.rules import SOURCE_AUTOMATIC, SOURCE_MANUAL, DomainError
from store.mysql_store import HomeStore, connect


class MysqlLedgerTest(unittest.TestCase):
    def setUp(self):
        self.conn = connect()
        self.store = HomeStore(self.conn)
        self.store.ensure_schema()
        stamp = datetime.now().strftime("%H%M%S%f")
        self.phone = "199" + stamp[-8:]
        self.user_id = self.store.register(self.phone, "abc123", "测试")
        created = self.store.create_family(self.user_id, "测试的家", "测试")
        self.family_id = created["family_id"]
        self.member_id = created["member_id"]
        self.invite = created["invite_code"]
        self.account_id = self.store.add_account(
            self.family_id, self.member_id, "测试卡", "储蓄卡", "100.00"
        )
        self.entry_id = None

    def tearDown(self):
        try:
            with self.conn.cursor() as cur:
                cur.execute("DELETE FROM ledger_entries WHERE family_id=%s", (self.family_id,))
                cur.execute("DELETE FROM accounts WHERE family_id=%s", (self.family_id,))
                cur.execute("DELETE FROM invite_codes WHERE family_id=%s", (self.family_id,))
                cur.execute("DELETE FROM members WHERE family_id=%s", (self.family_id,))
                cur.execute("DELETE FROM families WHERE id=%s", (self.family_id,))
                cur.execute("DELETE FROM users WHERE id=%s", (self.user_id,))
            self.conn.commit()
        finally:
            self.conn.close()

    def test_auth_rejects_bad_secrets_and_accepts_login(self):
        with self.assertRaises(DomainError):
            self.store.register("12345", "abc123")
        with self.assertRaises(DomainError):
            self.store.register("19900000000", "abc")
        self.assertEqual(self.store.login(self.phone, "abc123"), self.user_id)
        with self.assertRaises(DomainError):
            self.store.login(self.phone, "abc124")

    def test_expense_income_renqing_balance_and_invite(self):
        day = datetime(2026, 9, 24).date()
        expense_id = self.store.post_ledger(
            self.family_id, self.account_id, self.member_id, "expense", "30", "餐饮", day
        )
        self.entry_id = expense_id
        self.assertEqual(self.store.account_balance(self.account_id), Decimal("70.00"))
        income_id = self.store.post_ledger(
            self.family_id, self.account_id, self.member_id, "income", "10", "工资", day
        )
        self.assertEqual(self.store.account_balance(self.account_id), Decimal("80.00"))
        out_id = self.store.post_renqing(
            self.family_id, self.account_id, self.member_id, "out", "5", "婚礼随出", day
        )
        self.assertEqual(self.store.account_balance(self.account_id), Decimal("75.00"))
        in_id = self.store.post_renqing(
            self.family_id, self.account_id, self.member_id, "in", "2", "回礼", day
        )
        self.assertEqual(self.store.account_balance(self.account_id), Decimal("77.00"))

        other = connect()
        try:
            other_store = HomeStore(other)
            row = other_store.read_entry(expense_id)
            self.assertEqual(row["amount"], Decimal("30.00"))
            self.assertEqual(row["direction"], "expense")
            self.assertEqual(row["source"], SOURCE_MANUAL)
            self.assertNotEqual(row["source"], SOURCE_AUTOMATIC)
            self.assertEqual(other_store.account_balance(self.account_id), Decimal("77.00"))
            renqing = other_store.read_entry(out_id)
            self.assertEqual(renqing["direction"], "expense")
            self.assertEqual(renqing["entry_kind"], "renqing")
            self.assertEqual(renqing["source"], SOURCE_MANUAL)
            back = other_store.read_entry(in_id)
            self.assertEqual(back["direction"], "income")
            totals = other_store.monthly_totals(self.family_id, 2026, 9)
            self.assertEqual(totals["expense"], Decimal("35.00"))
            self.assertEqual(totals["income"], Decimal("12.00"))
            self.assertEqual(other_store.read_entry(income_id)["source"], SOURCE_MANUAL)
        finally:
            other.close()

        before = self._count()
        self.store.set_balance(self.account_id, "50")
        self.assertEqual(self.store.account_balance(self.account_id), Decimal("50.00"))
        self.assertEqual(self._count(), before)

        new_code = self.store.refresh_invite(self.family_id)
        future = datetime(2099, 1, 1)
        self.assertNotEqual(new_code, self.invite)
        self.assertFalse(self.store.code_is_usable(self.family_id, self.invite, future))
        self.assertTrue(self.store.code_is_usable(self.family_id, new_code, future))

    def _count(self) -> int:
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM ledger_entries WHERE account_id=%s",
                (self.account_id,),
            )
            return int(cur.fetchone()[0])


if __name__ == "__main__":
    unittest.main()
