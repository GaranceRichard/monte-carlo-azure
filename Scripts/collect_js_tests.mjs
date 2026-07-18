#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function parseOptions(argv) {
  const index = argv.indexOf("--root");
  if (index < 0 || !argv[index + 1]) {
    throw new Error("Usage: collect_js_tests.mjs --root <repository-root>");
  }
  const typeScriptIndex = argv.indexOf("--typescript");
  return {
    root: path.resolve(argv[index + 1]),
    typeScript: typeScriptIndex >= 0 ? path.resolve(argv[typeScriptIndex + 1]) : null,
  };
}

function sourceFiles(root) {
  const files = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  visit(path.join(root, "frontend", "src"));
  visit(path.join(root, "frontend", "tests", "e2e"));
  return files
    .filter((file) => /\.(?:js|jsx|ts|tsx)$/.test(file))
    .filter((file) => /\.(?:test|spec)\.(?:js|jsx|ts|tsx)$/.test(file))
    .sort();
}

function propertyChain(ts, expression) {
  const modifiers = [];
  let current = expression;
  while (ts.isPropertyAccessExpression(current)) {
    modifiers.unshift(current.name.text);
    current = current.expression;
  }
  if (!ts.isIdentifier(current)) return null;
  return { root: current.text, modifiers };
}

function invocation(ts, call) {
  if (ts.isCallExpression(call.expression)) {
    return propertyChain(ts, call.expression.expression);
  }
  return propertyChain(ts, call.expression);
}

function staticTitle(ts, node, sourceFile) {
  if (!node) return "<missing-title>";
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `<dynamic@${position.line + 1}:${position.character + 1}>`;
}

function importedBindings(ts, sourceFile, framework) {
  const tests = new Set(framework === "vitest" ? ["test", "it"] : []);
  const suites = new Set(framework === "vitest" ? ["describe"] : []);
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const expected = framework === "vitest" ? "vitest" : "@playwright/test";
    if (statement.moduleSpecifier.text !== expected) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (imported === "test" || imported === "it") tests.add(element.name.text);
      if (imported === "describe") suites.add(element.name.text);
    }
  }
  if (framework === "playwright") suites.add("test");
  return { tests, suites };
}

function importEvidence(ts, sourceFile) {
  return sourceFile.statements
    .filter((statement) => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))
    .map((statement) => statement.moduleSpecifier.text)
    .sort();
}

function nodeEvidence(ts, node, sourceFile) {
  const calls = new Set();
  const resources = new Set();
  const visit = (child) => {
    if (ts.isCallExpression(child)) {
      calls.add(child.expression.getText(sourceFile).slice(0, 120));
    }
    if (ts.isStringLiteralLike(child) && /(?:https?:\/\/|\/|\\|\.json|\.ya?ml)/i.test(child.text)) {
      resources.add(child.text.slice(0, 160));
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return { calls: [...calls].sort(), resources: [...resources].sort() };
}

function callbackArgument(ts, call) {
  for (let index = call.arguments.length - 1; index >= 0; index -= 1) {
    const argument = call.arguments[index];
    if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) return argument;
  }
  return null;
}

function collectFile(ts, root, absolute) {
  const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
  const framework = relative.startsWith("frontend/tests/e2e/") ? "playwright" : "vitest";
  const scriptKind = absolute.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    absolute,
    fs.readFileSync(absolute, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const bindings = importedBindings(ts, sourceFile, framework);
  const imports = importEvidence(ts, sourceFile);
  const cases = [];

  const walk = (node, suites, conditional) => {
    if (ts.isCallExpression(node)) {
      const descriptor = invocation(ts, node);
      if (descriptor) {
        const isSuite =
          (bindings.suites.has(descriptor.root) && descriptor.modifiers.includes("describe")) ||
          (bindings.suites.has(descriptor.root) &&
            !bindings.tests.has(descriptor.root) &&
            descriptor.modifiers.length === 0);
        if (isSuite) {
          const callback = callbackArgument(ts, node);
          if (callback) walk(callback.body, [...suites, staticTitle(ts, node.arguments[0], sourceFile)], conditional);
          return;
        }
        const testModifiers = new Set([
          "skip",
          "only",
          "each",
          "todo",
          "fixme",
          "fail",
          "concurrent",
          "sequential",
          "skipIf",
          "runIf",
        ]);
        const isTest =
          bindings.tests.has(descriptor.root) &&
          !descriptor.modifiers.includes("describe") &&
          descriptor.modifiers.every((modifier) => testModifiers.has(modifier));
        const ignoredHelper = ["beforeEach", "afterEach", "beforeAll", "afterAll", "setTimeout"].some(
          (name) => descriptor.modifiers.includes(name),
        );
        if (isTest && !ignoredHelper) {
          // Vitest anchors every expanded `.each` task on the closing parenthesis of the
          // inner data-table call. Persist that exact AST position so parameters and dynamic
          // titles map without any title heuristic.
          const declarationOffset =
            framework === "vitest" &&
            descriptor.modifiers.includes("each") &&
            ts.isCallExpression(node.expression)
              ? node.expression.getEnd() - 1
              : node.getStart(sourceFile);
          const position = sourceFile.getLineAndCharacterOfPosition(declarationOffset);
          const title = staticTitle(ts, node.arguments[0], sourceFile);
          const selector = [...suites, title].join(" > ") + ` [${position.line + 1}:${position.character + 1}]`;
          const callback = callbackArgument(ts, node);
          const evidence = nodeEvidence(ts, callback?.body ?? node, sourceFile);
          cases.push({
            framework,
            sourcePath: relative,
            selector,
            evidence: {
              imports,
              calls: evidence.calls,
              fixtures: callback?.parameters.map((parameter) => parameter.name.getText(sourceFile)).sort() ?? [],
              resources: evidence.resources,
              modifiers: descriptor.modifiers,
              conditional,
              dynamicTitle: title.startsWith("<dynamic@"),
            },
          });
          return;
        }
      }
    }
    const nextConditional = conditional || ts.isIfStatement(node) || ts.isConditionalExpression(node);
    ts.forEachChild(node, (child) => walk(child, suites, nextConditional));
  };
  walk(sourceFile, [], false);
  return cases;
}

const options = parseOptions(process.argv.slice(2));
const root = options.root;
const typeScriptPath =
  options.typeScript ?? path.join(root, "frontend", "node_modules", "typescript", "lib", "typescript.js");
if (!fs.existsSync(typeScriptPath)) throw new Error(`TypeScript compiler not found: ${typeScriptPath}`);
const imported = await import(pathToFileURL(typeScriptPath).href);
const ts = imported.default ?? imported;
const result = sourceFiles(root).flatMap((file) => collectFile(ts, root, file));
result.sort((left, right) =>
  `${left.framework}\0${left.sourcePath}\0${left.selector}`.localeCompare(
    `${right.framework}\0${right.sourcePath}\0${right.selector}`,
    "en",
  ),
);
process.stdout.write(`${JSON.stringify(result)}\n`);
