import Parser from "tree-sitter";
// @ts-expect-error - no types
import JS from "tree-sitter-javascript";
// @ts-expect-error - no types
import TS from "tree-sitter-typescript";
// @ts-expect-error - no types
import Py from "tree-sitter-python";
import path from "node:path";
import type { FileMetric, Lang } from "./types";

const parsers: Partial<Record<Lang, Parser>> = {};

function getParser(lang: Lang): Parser {
  if (parsers[lang]) return parsers[lang]!;
  const p = new Parser();
  switch (lang) {
    case "js":
    case "jsx":
      p.setLanguage(JS);
      break;
    case "ts":
      p.setLanguage(TS.typescript);
      break;
    case "tsx":
      p.setLanguage(TS.tsx);
      break;
    case "py":
      p.setLanguage(Py);
      break;
  }
  parsers[lang] = p;
  return p;
}

export function langFromPath(p: string): Lang | null {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".ts") return "ts";
  if (ext === ".tsx") return "tsx";
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return "js";
  if (ext === ".jsx") return "jsx";
  if (ext === ".py") return "py";
  return null;
}

// Cyclomatic complexity contributors per language. We count decision points.
const DECISION_NODES: Record<Lang, Set<string>> = {
  ts: new Set([
    "if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement",
    "switch_case", "catch_clause", "ternary_expression", "binary_expression",
  ]),
  tsx: new Set([
    "if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement",
    "switch_case", "catch_clause", "ternary_expression", "binary_expression",
  ]),
  js: new Set([
    "if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement",
    "switch_case", "catch_clause", "ternary_expression", "binary_expression",
  ]),
  jsx: new Set([
    "if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement",
    "switch_case", "catch_clause", "ternary_expression", "binary_expression",
  ]),
  py: new Set([
    "if_statement", "for_statement", "while_statement", "try_statement", "except_clause",
    "conditional_expression", "boolean_operator",
  ]),
};

const FN_NODES: Record<Lang, Set<string>> = {
  ts: new Set(["function_declaration", "method_definition", "arrow_function", "function_expression"]),
  tsx: new Set(["function_declaration", "method_definition", "arrow_function", "function_expression"]),
  js: new Set(["function_declaration", "method_definition", "arrow_function", "function_expression"]),
  jsx: new Set(["function_declaration", "method_definition", "arrow_function", "function_expression"]),
  py: new Set(["function_definition"]),
};

const CLASS_NODES: Record<Lang, Set<string>> = {
  ts: new Set(["class_declaration"]),
  tsx: new Set(["class_declaration"]),
  js: new Set(["class_declaration"]),
  jsx: new Set(["class_declaration"]),
  py: new Set(["class_definition"]),
};

export interface ParsedFile extends FileMetric {
  // could later carry functions[] with per-fn complexity
}

export function parseFile(filePath: string, source: string): ParsedFile | null {
  const lang = langFromPath(filePath);
  if (!lang) return null;
  let tree;
  try {
    tree = getParser(lang).parse(source);
  } catch {
    return null;
  }
  const root = tree.rootNode;
  let complexity = 1;
  let fnCount = 0;
  let classCount = 0;
  const imports: string[] = [];
  const decisionSet = DECISION_NODES[lang];
  const fnSet = FN_NODES[lang];
  const classSet = CLASS_NODES[lang];

  const stack: Parser.SyntaxNode[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    const t = n.type;
    if (decisionSet.has(t)) {
      if (t === "binary_expression" || t === "boolean_operator") {
        const op = n.childForFieldName("operator")?.text || "";
        if (op === "&&" || op === "||" || op === "and" || op === "or") complexity++;
      } else {
        complexity++;
      }
    }
    if (fnSet.has(t)) fnCount++;
    if (classSet.has(t)) classCount++;
    if (t === "import_statement" || t === "import_from_statement") {
      // python: import_statement (import x) / import_from_statement (from x import y)
      // ts/js: import_statement
      const src = findImportSource(n);
      if (src) imports.push(src);
    } else if (t === "call_expression") {
      // detect `require("x")` and dynamic `import("x")`
      const callee = n.children[0];
      if (callee && (callee.text === "require" || callee.text === "import")) {
        const argsNode = n.children[1];
        if (argsNode) {
          const arg = argsNode.namedChildren[0];
          if (arg && (arg.type === "string" || arg.type === "string_literal")) {
            imports.push(stripQuotes(arg.text));
          }
        }
      }
    }
    for (let i = n.namedChildCount - 1; i >= 0; i--) stack.push(n.namedChild(i)!);
  }

  return {
    path: filePath,
    lang,
    loc: source.split("\n").length,
    complexity,
    fnCount,
    classCount,
    imports: dedupe(imports),
  };
}

function findImportSource(n: Parser.SyntaxNode): string | null {
  // search for first string child
  for (let i = 0; i < n.namedChildCount; i++) {
    const c = n.namedChild(i)!;
    if (c.type === "string" || c.type === "string_literal" || c.type === "dotted_name" || c.type === "relative_import") {
      return stripQuotes(c.text);
    }
  }
  return null;
}

function stripQuotes(s: string): string {
  return s.replace(/^['"`]|['"`]$/g, "");
}

function dedupe<T>(a: T[]): T[] {
  return Array.from(new Set(a));
}
