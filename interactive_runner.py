"""
interactive_runner.py
---------------------
Jembatan eksekusi interaktif & inspeksi compiler untuk terminal web.

Mendukung dua mode:
1. Mode Interaktif (default):
   - Menerima kode program dari frontend
   - Mengalirkan keluaran (stdout) secara real-time via event JSON
   - Ketika interpreter membutuhkan masukan (input), memancarkan event {"type": "need_input"}
     dan menunggu satu baris dari stdin (persis seperti terminal Python interaktif!)
   - Melaporkan status selesai atau detail PseudoError (baris, kolom, pesan, format)

2. Mode Inspeksi (--inspect):
   - Menerima kode sumber dan mengembalikan tabel token Lexer, pohon AST Parser,
     serta tabel simbol Kamus (aliases, structs, constants, variables) tanpa menjalankan program.
"""

import dataclasses
import io
import json
import os
import sys
import time
from typing import Any

from ast_nodes import (
    AliasDecl,
    AssignStmt,
    BinaryExpr,
    ConstDecl,
    Expr,
    FieldAccessExpr,
    ForStmt,
    IfBranch,
    IfStmt,
    InputStmt,
    LenExpr,
    LiteralExpr,
    OutputStmt,
    Program,
    RepeatStmt,
    Stmt,
    StructDecl,
    UnaryExpr,
    VarDecl,
    VarExpr,
    WhileStmt,
)
from checker import SemanticChecker
from errors import PseudoError
from interpreter import Interpreter
from lexer import normalize_smart_quotes, tokenize
from parser import parse


def ast_to_dict(node: Any) -> Any:
    """Mengubah node AST menjadi struktur dictionary yang aman diserialisasi ke JSON."""
    if node is None or isinstance(node, (int, float, str, bool)):
        return node
    if isinstance(node, list):
        return [ast_to_dict(item) for item in node]
    if isinstance(node, dict):
        return {k: ast_to_dict(v) for k, v in node.items()}
    if dataclasses.is_dataclass(node):
        data = {"_type": node.__class__.__name__}
        for field in dataclasses.fields(node):
            data[field.name] = ast_to_dict(getattr(node, field.name))
        return data
    return str(node)


def inspect_source(source: str) -> dict[str, Any]:
    """Mengurai kode sumber menjadi tokens, AST, dan tabel simbol kamus."""
    normalized = normalize_smart_quotes(source)
    source_lines = normalized.splitlines()

    result: dict[str, Any] = {
        "tokens": [],
        "ast": None,
        "kamus": {
            "aliases": {},
            "structs": {},
            "constants": {},
            "variables": {},
        },
        "error": None,
    }

    try:
        # Tahap 1: Lexer
        tokens = tokenize(normalized)
        result["tokens"] = [
            {
                "type": tok.type,
                "value": str(tok.value) if tok.value is not None else "",
                "line": tok.line,
                "col": tok.col,
            }
            for tok in tokens
            if tok.type != "EOF"
        ]

        # Tahap 2: Parser
        program = parse(tokens, normalized)
        result["ast"] = ast_to_dict(program)

        # Tahap 3: Checker (ekstraksi kamus)
        checker = SemanticChecker(source_lines)
        checker.check_program(program)

        result["kamus"] = {
            "aliases": {k: v.target_type for k, v in checker.aliases.items()},
            "structs": checker.structs,
            "constants": list(checker.constants),
            "variables": checker.variables,
        }
    except PseudoError as err:
        result["error"] = {
            "category": err.category,
            "message": err.message,
            "line": err.line,
            "col": err.col,
            "formatted": err.format_error(source_lines),
        }
    except Exception as exc:
        result["error"] = {
            "category": "kesalahan internal",
            "message": str(exc),
            "line": 1,
            "col": 1,
            "formatted": f"Error internal: {exc}",
        }

    return result


class InteractiveTerminalStream:
    """
    Stream masukan interaktif untuk interpreter.
    Ketika InputReader membutuhkan baris baru dan buffer kosong,
    stream ini memancarkan event 'need_input' ke stdout dan membaca 1 baris dari stdin!
    """

    def __init__(self, in_pipe: Any = sys.stdin, out_pipe: Any = sys.stdout):
        self.in_pipe = in_pipe
        self.out_pipe = out_pipe

    def readline(self) -> str:
        # Kirim sinyal ke frontend bahwa terminal sedang menunggu pengguna mengetik
        self.out_pipe.write(json.dumps({"type": "need_input"}, ensure_ascii=False) + "\n")
        self.out_pipe.flush()

        raw = self.in_pipe.readline()
        if not raw:
            return ""
        try:
            msg = json.loads(raw)
            if isinstance(msg, dict) and msg.get("type") == "input":
                line_val = str(msg.get("line", ""))
                return line_val + "\n"
            if isinstance(msg, dict) and msg.get("type") == "stop":
                return ""
        except json.JSONDecodeError:
            pass
        return raw


class InteractiveTerminalOutput:
    """Stream keluaran yang langsung memancarkan event 'stdout' secara live."""

    def __init__(self, out_pipe: Any = sys.stdout):
        self.out_pipe = out_pipe

    def write(self, text: str) -> int:
        if not text:
            return 0
        self.out_pipe.write(json.dumps({"type": "stdout", "text": text}, ensure_ascii=False) + "\n")
        self.out_pipe.flush()
        return len(text)

    def flush(self) -> None:
        self.out_pipe.flush()


def run_interactive_session(source: str, in_pipe: Any = sys.stdin, out_pipe: Any = sys.stdout) -> None:
    """Menjalankan sesi kompilasi & eksekusi interaktif dengan streaming dua arah."""
    normalized = normalize_smart_quotes(source)
    source_lines = normalized.splitlines()

    start_time = time.perf_counter()

    try:
        tokens = tokenize(normalized)
        program = parse(tokens, normalized)

        checker = SemanticChecker(source_lines)
        checker.check_program(program)

        term_in = InteractiveTerminalStream(in_pipe=in_pipe, out_pipe=out_pipe)
        term_out = InteractiveTerminalOutput(out_pipe=out_pipe)

        interpreter = Interpreter(
            source_lines=source_lines,
            stdin=term_in,  # type: ignore[arg-type]
            stdout=term_out,  # type: ignore[arg-type]
            max_steps=500_000,
        )
        interpreter.run(program)

        duration_ms = int((time.perf_counter() - start_time) * 1000)
        out_pipe.write(json.dumps({"type": "exit", "code": 0, "durationMs": duration_ms}, ensure_ascii=False) + "\n")
        out_pipe.flush()

    except PseudoError as err:
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        out_pipe.write(
            json.dumps(
                {
                    "type": "error",
                    "durationMs": duration_ms,
                    "error": {
                        "category": err.category,
                        "message": err.message,
                        "line": err.line,
                        "col": err.col,
                        "formatted": err.format_error(source_lines),
                    },
                },
                ensure_ascii=False,
            )
            + "\n"
        )
        out_pipe.flush()
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        out_pipe.write(
            json.dumps(
                {
                    "type": "error",
                    "durationMs": duration_ms,
                    "error": {
                        "category": "kesalahan internal",
                        "message": str(exc),
                        "line": 1,
                        "col": 1,
                        "formatted": f"Error internal: {exc}",
                    },
                },
                ensure_ascii=False,
            )
            + "\n"
        )
        out_pipe.flush()


def main() -> int:
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) > 1 and sys.argv[1] == "--inspect":
        payload = sys.stdin.read()
        try:
            req = json.loads(payload) if payload.strip() else {}
        except json.JSONDecodeError:
            req = {}
        source = req.get("source", "")
        data = inspect_source(source)
        sys.stdout.write(json.dumps(data, ensure_ascii=False))
        return 0

    first_line = sys.stdin.readline()
    if not first_line:
        return 0

    try:
        init_msg = json.loads(first_line)
    except json.JSONDecodeError:
        init_msg = {"source": first_line}

    source = init_msg.get("source", "")
    run_interactive_session(source)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
