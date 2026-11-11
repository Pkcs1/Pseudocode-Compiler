"""
tests/test_interactive_runner.py
--------------------------------
Pengujian unit untuk interactive_runner.py (mode interaktif & mode inspeksi).
"""

import io
import json
import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from interactive_runner import inspect_source, run_interactive_session


class TestInteractiveRunner(unittest.TestCase):
    def test_inspect_source_tokens_ast_kamus(self):
        code = """
        program Hitung
        kamus
            type umur : integer
            type orang <
                nama : string
                u : umur
            >
            constant PI : real = 3.14
            x, y : integer
        algoritma
            x = 10
            y = 20
        endprogram
        """
        data = inspect_source(code)
        self.assertIsNone(data["error"])
        self.assertTrue(len(data["tokens"]) > 10)
        self.assertIsNotNone(data["ast"])
        self.assertEqual(data["kamus"]["aliases"], {"umur": "integer"})
        self.assertIn("orang", data["kamus"]["structs"])
        self.assertIn("PI", data["kamus"]["constants"])
        self.assertIn("x", data["kamus"]["variables"])
        self.assertIn("y", data["kamus"]["variables"])

    def test_inspect_source_error(self):
        bad_code = "program T\nkamus\n x : integer\nalgoritma\n x = 3.14\nendprogram"
        data = inspect_source(bad_code)
        self.assertIsNotNone(data["error"])
        self.assertEqual(data["error"]["category"], "kesalahan tipe/deklarasi")
        self.assertEqual(data["error"]["line"], 5)

    def test_interactive_session_prompts_and_resumes(self):
        code = """
        program Tambah
        kamus
            a, b : integer
        algoritma
            output("Mulai")
            input(a, b)
            output("Hasil:", a + b)
        endprogram
        """
        # Simulasi stdin yang mengirim baris input saat diminta
        input_lines = [
            json.dumps({"type": "input", "line": "15 25"}) + "\n",
        ]
        in_pipe = io.StringIO("".join(input_lines))
        out_pipe = io.StringIO()

        run_interactive_session(code, in_pipe=in_pipe, out_pipe=out_pipe)

        messages = [
            json.loads(line)
            for line in out_pipe.getvalue().splitlines()
            if line.strip()
        ]

        types = [m["type"] for m in messages]
        # Harus ada: output Mulai, need_input, output Hasil, exit
        self.assertIn("need_input", types)
        self.assertIn("exit", types)

        stdout_texts = [m["text"] for m in messages if m["type"] == "stdout"]
        combined = "".join(stdout_texts)
        self.assertIn("Mulai", combined)
        self.assertIn("Hasil: 40", combined)


if __name__ == "__main__":
    unittest.main()
