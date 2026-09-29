"""Drives the shipped browser ledger and category functions."""

from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]


class UiEntriesTest(unittest.TestCase):
    def test_shipped_ui_save_path(self):
        script = ROOT / "tests" / "ui_entries_check.js"
        completed = subprocess.run(
            ["node", str(script)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        self.assertIn("ui entries ok", completed.stdout)


if __name__ == "__main__":
    unittest.main()
