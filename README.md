# Pseudocode Compiler & Interpreter

A Python-based compiler and interpreter engine designed to analyze, type-check (*static semantic analysis*), and execute structured pseudocode. The project features a Command-Line Interface (CLI), an interactive runner with streaming I/O, and a modern Web IDE built with Next.js and Tailwind CSS.

The core engine is built with zero external dependencies — relying solely on the Python standard library.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Architecture & Compilation Pipeline](#architecture--compilation-pipeline)
3. [Prerequisites](#prerequisites)
4. [How to Run](#how-to-run)
   - [1. Command-Line Interface (CLI)](#1-command-line-interface-cli)
   - [2. Interactive Runner & AST Inspector](#2-interactive-runner--ast-inspector)
   - [3. Web IDE](#3-web-ide)
5. [Pseudocode Syntax Guide](#pseudocode-syntax-guide)
   - [Program Skeleton](#program-skeleton)
   - [Primitive Data Types](#primitive-data-types)
   - [Declarations in the Dictionary (`kamus`)](#declarations-in-the-dictionary-kamus)
   - [Instructions in the Algorithm (`algoritma`)](#instructions-in-the-algorithm-algoritma)
   - [Control Structures & Loops](#control-structures--loops)
   - [Operators & Precedence](#operators--precedence)
6. [Code Examples](#code-examples)
7. [Error Handling & Diagnostics](#error-handling--diagnostics)
8. [Project Structure](#project-structure)
9. [Automated Testing](#automated-testing)

---

## Key Features

- **Modular Compilation Pipeline**: Fully separated stages for *Lexer*, *Parser*, *Semantic Checker*, and *Runtime Interpreter*.
- **Static Semantic & Type Analysis**: Pre-execution verification of variable declarations, type compatibility, constant immutability, and struct field integrity.
- **64-bit Integer Arithmetic**: Implements signed 64-bit integer representation with wrap-around semantics on overflow.
- **Flexible I/O**: Multi-value whitespace-delimited terminal input reading and formatted output printing.
- **Comprehensive Control Flow**: `if ... then ... else if ... else ... endif` branching, as well as `for` (`to` / `downto`, with optional `step`), `while`, and `repeat-until` loops.
- **User-Defined Types**: Full support for type aliases and multi-field record/struct types.
- **Format Tolerance**: Automatic normalization of typographic smart quotes (`"`, `"`, `'`, `'`) and assignment arrow symbols (`<-` and `←`).
- **Modern Web IDE**: Interactive web editor featuring VS Code-style syntax highlighting, real-time interactive terminal, symbol table inspector with sparkline visualizations, and mechanical keyboard audio feedback.

---

## Architecture & Compilation Pipeline

Source code is processed through 4 sequential stages:

```
[ Source Code (.pseudo) ]
           │
           ▼
┌────────────────────────────────┐
│      1. Lexer (lexer.py)       │  Tokenizes source text, tracks line and column numbers,
│                                │  normalizes quotes, and strips comments (// and { }).
└────────────────┬───────────────┘
                 │
                 ▼
┌────────────────────────────────┐
│     2. Parser (parser.py)      │  Recursive-Descent Parser with 9 levels of operator
│                                │  precedence to construct the Abstract Syntax Tree (AST).
└────────────────┬───────────────┘
                 │
                 ▼
┌────────────────────────────────┐
│   3. Checker (checker.py)      │  Static Semantic Analysis: validates variable scope,
│                                │  enforces constant immutability, and checks types.
└────────────────┬───────────────┘
                 │
                 ▼
┌────────────────────────────────┐
│ 4. Interpreter (interpreter.py)│  Executes AST statements, manages runtime memory,
│                                │  handles I/O, and wraps integers to 64-bit signed ranges.
└────────────────┬───────────────┘
                 │
                 ▼
        [ Execution Output ]
```

---

## Prerequisites

- **Python 3.10** or newer (required for the core compiler engine).
- **Node.js 18+** & **npm** (optional, only needed to run the Web IDE).

Verify your Python version:

```bash
python --version
```

---

## How to Run

### 1. Command-Line Interface (CLI)

Run any `.pseudo` file using the main entry script `pseudo.py`:

```bash
python pseudo.py example.pseudo
```

If the program requires terminal inputs (`input`), type the values and press **Enter**. You can also redirect input from a text file:

```bash
python pseudo.py example.pseudo < input.txt
```

### 2. Interactive Runner & AST Inspector

The compiler provides `interactive_runner.py` for integration with interactive environments and inspection of internal compiler representations.

To inspect tokens, the AST tree, and symbol table without executing the code:

```bash
python interactive_runner.py --inspect example.pseudo
```

### 3. Web IDE

To run the interactive web interface locally:

```bash
cd web
npm install
npm run dev
```

Open your browser at `http://localhost:3000` to access the web editor, live symbol table inspector, and interactive terminal.

---

## Pseudocode Syntax Guide

All language keywords are **case-insensitive** (typically written in lowercase). Comments can be written as single-line (`// ...`) or bracketed multi-line (`{ ... }`).

### Program Skeleton

Every pseudocode program must define three main blocks: `program`, a `kamus` dictionary section, and an `algoritma` instruction block, terminated by `endprogram`:

```text
program ProgramName
kamus
    // Declarations: types, constants, and variables
algoritma
    // Program instructions and execution logic
endprogram
```

### Primitive Data Types

| Data Type | Example Literal | Description |
| :--- | :--- | :--- |
| `integer` | `10`, `-5`, `0` | Signed 64-bit integer |
| `real` | `3.14`, `-0.5` | 64-bit floating-point decimal |
| `string` | `"Hello World"` | Double-quoted text string |
| `char` | `'A'`, `'9'`, `'\n'` | Single character enclosed in single quotes |
| `boolean` | `true`, `false` | Logical boolean values |

### Declarations in the Dictionary (`kamus`)

Declarations inside the `kamus` block can appear in any order:

```text
kamus
    // 1. Variable Declarations
    x, y, total : integer
    width, height : real
    name : string
    isActive : boolean

    // 2. Constant Declarations (immutable values)
    constant PI : real = 3.1415926535
    constant MAX_LIMIT : integer <- 100

    // 3. Type Aliases
    type Number : integer

    // 4. Record / Struct Types
    type Point <
        x, y : real
    >
    type Student <
        id : integer
        name : string
        gpa : real
    >

    p1 : Point
    s1 : Student
```

### Instructions in the Algorithm (`algoritma`)

#### Value Assignment
You can use either the `=` operator or the assignment arrow `<-` (or `←`):

```text
total = 0
x <- 10
p1.x = 2.5
p1.y <- 4.0
```

#### Input and Output (`input` & `output`)
- `input(var1, var2, ...)` reads whitespace-delimited tokens (spaces, tabs, newlines) from standard input.
- `output(expr1, expr2, ...)` prints expression values separated by spaces and terminated with a newline.

```text
input(x, y)
output("Sum result:", x + y)
```

### Control Structures & Loops

#### Conditional Branching (`if ... then ... else if ... else ... endif`)
Evaluates boolean expressions:

```text
if score >= 80 then
    output("Grade: A")
else if score >= 70 then
    output("Grade: B")
else if score >= 60 then
    output("Grade: C")
else
    output("Grade: D")
endif
```

#### Counted Loops (`for`)
Iterates from a start value to an end value, inclusive. Use `to` to count up (default step `+1`) and `downto` to count down (default step `-1`). With `downto`, `step k` is the amount subtracted each round and must be positive:

```text
// Ascending loop with default step (+1)
for i = 1 to 5 do
    output(i)
endfor

// Ascending loop with custom step
for i = 0 to 10 step 2 do
    output(i)
endfor

// Descending loop with downto (9, 8, ..., 1)
for i = 9 downto 1 do
    output(i)
endfor

// Descending loop, subtracting 2 each round (10, 8, ..., 0)
for i = 10 downto 0 step 2 do
    output(i)
endfor

// Equivalent older form: negative step with `to`
for i = 10 to 1 step -1 do
    output(i)
endfor
```

#### Condition-Based Loops (`while` & `repeat-until`)
- `while <condition> do ... endwhile`: Evaluates the condition upfront; repeats **while** the condition is `true`.
- `repeat ... until <condition>`: Executes the block at least once; repeats **until** the condition becomes `true` (checked at the end).

```text
// While loop
while n > 0 do
    output(n)
    n = n - 1
endwhile

// Repeat-until loop
repeat
    count = count + 1
    output("Iteration:", count)
until count == 5
```

### Operators & Precedence

Operator precedence is evaluated from highest (1) to lowest (9):

| Level | Category | Operator | Associativity | Description |
| :---: | :--- | :--- | :---: | :--- |
| **1** | Grouping & Access | `( )`, `.`, `len()` | Left-to-Right | Parentheses priority and struct field access |
| **2** | Unary | `+`, `-`, `not` | Right-to-Left | Sign prefix and logical negation |
| **3** | Exponentiation | `^` | Right-to-Left | Power operation |
| **4** | Multiplicative & Bitwise | `*`, `/`, `div`, `mod`, `<<`, `>>`, `&` | Left-to-Right | `/` always produces `real`; `div` & `mod` require `integer` |
| **5** | Additive & Bitwise Or | `+`, `-`, `\|` | Left-to-Right | `+` also concatenates `string` operands |
| **6** | Relational Comparison | `<`, `<=`, `>`, `>=` | Left-to-Right | Returns a `boolean` result |
| **7** | Equality Comparison | `==`, `!=`, `<>` | Left-to-Right | `<>` is equivalent to `!=` |
| **8** | Logical And | `and` | Left-to-Right | Short-circuit evaluation |
| **9** | Logical Or | `or` | Left-to-Right | Short-circuit evaluation |

---

## Code Examples

### 1. Cylinder Volume Calculation (Struct & Constant)

```text
program CalculateCylinder
kamus
    constant PI : real = 3.1415926535
    type Cylinder <
        radius : real
        height : real
        volume : real
    >
    c : Cylinder
algoritma
    input(c.radius, c.height)
    c.volume = PI * (c.radius ^ 2) * c.height
    output("Cylinder volume:", c.volume)
endprogram
```

### 2. Number Sequence & Conditional Loop

```text
program NumberSequence
kamus
    limit, total, num : integer
algoritma
    input(limit)
    total = 0
    num = 1

    while num <= limit do
        if num mod 2 == 0 then
            total = total + num
        endif
        num = num + 1
    endwhile

    output("Sum of even numbers:", total)
endprogram
```

---

## Error Handling & Diagnostics

The compiler enforces strict verification at each stage, producing informative error messages with precise line and column numbers:

1. **Syntax Errors**:
   Detected during the *Lexer* or *Parser* stage when code violates grammatical rules (e.g., invalid characters, unclosed strings, or missing closing keywords like `endprogram`, `endif`, `endfor`).
2. **Semantic & Type Errors**:
   Caught by the *Semantic Checker* before execution:
   - Use of undeclared variables in `algoritma`.
   - Mutation of a `constant` (via assignment or `input`).
   - Type mismatches (e.g., assigning a `real` value directly to an `integer` variable).
   - Access to undefined struct fields.
3. **Runtime Errors**:
   Raised during execution in the *Interpreter*:
   - Division by zero (`/`, `div`, or `mod` with a `0` denominator).
   - Reading an uninitialized variable before any value has been assigned.
   - Exhausted or invalid input data stream.
   - Loop `step` parameter evaluated to `0`.

---

## Project Structure

```text
Pseudocode Compiler/
├── pseudo.py                # Main CLI entry point
├── interactive_runner.py    # Interactive runner & AST inspection utility
├── lexer.py                 # Lexical analysis & tokenization
├── parser.py                # Recursive-descent parser (AST construction)
├── ast_nodes.py             # AST node class definitions
├── checker.py               # Static semantic analysis & type validation
├── interpreter.py           # Runtime engine & execution environment
├── errors.py                # Error definitions and diagnostic formatting
├── docs/                    # Language specifications & design notes
├── tests/                   # Automated unit test suite
│   └── examples/            # Example .pseudo, .in, and .out test fixtures
└── web/                     # Interactive Web IDE (Next.js & Tailwind CSS)
```

---

## Automated Testing

The project includes an extensive test suite verifying lexical analysis, parsing, semantic rules, and runtime execution correctness.

Run all tests using Python's built-in `unittest` runner:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```
