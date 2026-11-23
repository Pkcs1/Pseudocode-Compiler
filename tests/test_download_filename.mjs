import test from "node:test";
import assert from "node:assert/strict";
import { extractProgramName, getDownloadFilename } from "../web/lib/download.ts";

test("extracts simple program name", () => {
  assert.equal(extractProgramName("program abc"), "abc");
  assert.equal(getDownloadFilename("program abc\nkamus\nalgoritma\nendprogram"), "abc.txt");
});

test("matches program keyword case-insensitively", () => {
  assert.equal(getDownloadFilename("PROGRAM Warung\nkamus"), "Warung.txt");
  assert.equal(getDownloadFilename("Program RataRata"), "RataRata.txt");
});

test("ignores leading comments and whitespace", () => {
  const src = `{ komentar blok\n  multi baris }\n// komentar baris\n   program   Hitung_1  // inline`;
  assert.equal(getDownloadFilename(src), "Hitung_1.txt");
});

test("returns null when program name is missing or empty", () => {
  assert.equal(getDownloadFilename(""), null);
  assert.equal(getDownloadFilename("   \n  "), null);
  assert.equal(getDownloadFilename("program"), null);
  assert.equal(getDownloadFilename("program   \nkamus\n  x : integer"), null);
  assert.equal(getDownloadFilename("// program abc\nkamus"), null);
  assert.equal(getDownloadFilename("{ program abc }\nkamus"), null);
});

test("sanitizes disallowed filename characters", () => {
  assert.equal(getDownloadFilename("program a/b:c*d"), "abcd.txt");
  assert.equal(getDownloadFilename("program ///"), null);
});
