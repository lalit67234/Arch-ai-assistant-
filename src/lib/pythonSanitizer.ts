/**
 * ARCH Engine // Python Code Sanitizer & Syntax Formatter
 * Corrects common indentation errors, aligns try/except/finally blocks,
 * and ensures Python code is ready for execution.
 */

export interface PythonLintResult {
  isValid: boolean;
  issues: string[];
  formattedCode: string;
}

export function sanitizePythonIndentation(source: string): string {
  if (!source) return "";

  const lines = source.split("\n");
  const tryStack: number[] = [];
  const correctedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Replace hard tabs with 4 spaces
    const lineWithSpaces = rawLine.replace(/\t/g, "    ");
    const trimmed = lineWithSpaces.trim();

    // Skip empty lines or comment-only lines
    if (!trimmed || trimmed.startsWith("#")) {
      correctedLines.push(lineWithSpaces);
      continue;
    }

    const currentIndent = lineWithSpaces.search(/\S/);

    // Track try blocks
    if (/^try\s*:/.test(trimmed)) {
      tryStack.push(currentIndent);
      correctedLines.push(lineWithSpaces);
      continue;
    }

    // Match except / finally / else attached to try
    if (/^(except(\s+.*)?:|finally\s*:|else\s*:)/.test(trimmed)) {
      if (tryStack.length > 0) {
        // Expected indent should match the last try
        const expectedIndent = tryStack[tryStack.length - 1];
        if (currentIndent !== expectedIndent) {
          // Fix indentation to align with try
          const fixedLine = " ".repeat(expectedIndent) + trimmed;
          correctedLines.push(fixedLine);
          
          if (/^finally\s*:/.test(trimmed)) {
            tryStack.pop();
          }
          continue;
        }
      }
    }

    correctedLines.push(lineWithSpaces);
  }

  return correctedLines.join("\n");
}

export function validatePythonStructure(source: string): PythonLintResult {
  const issues: string[] = [];
  const lines = source.split("\n");
  let openTryCount = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (/^try\s*:/.test(trimmed)) {
      openTryCount++;
    } else if (/^except(\s+.*)?:/.test(trimmed)) {
      if (openTryCount <= 0) {
        issues.push(`Line ${idx + 1}: 'except' statement found without matching 'try' block.`);
      }
    } else if (/^finally\s*:/.test(trimmed)) {
      if (openTryCount <= 0) {
        issues.push(`Line ${idx + 1}: 'finally' statement found without matching 'try' block.`);
      } else {
        openTryCount = Math.max(0, openTryCount - 1);
      }
    }
  }

  const formattedCode = sanitizePythonIndentation(source);

  return {
    isValid: issues.length === 0,
    issues,
    formattedCode
  };
}
