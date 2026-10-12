/** Safe arithmetic evaluator (numbers, + - * /, parentheses). No eval. */

type Tok =
  | { t: 'num'; v: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/' }
  | { t: 'lp' }
  | { t: 'rp' };

function tokenize(expr: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(') {
      tokens.push({ t: 'lp' });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ t: 'rp' });
      i++;
      continue;
    }
    if ('+-*/'.includes(c)) {
      tokens.push({ t: 'op', v: c as '+' | '-' | '*' | '/' });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      const num = Number(expr.slice(i, j));
      if (Number.isNaN(num)) throw new Error('Invalid number');
      tokens.push({ t: 'num', v: num });
      i = j;
      continue;
    }
    throw new Error(`Unexpected character: ${c}`);
  }
  return tokens;
}

function parse(tokens: Tok[]): number {
  let pos = 0;

  function parseExpr(): number {
    let left = parseTerm();
    while (pos < tokens.length && tokens[pos].t === 'op' && (tokens[pos] as { v: string }).v.match(/[+-]/)) {
      const op = (tokens[pos++] as { v: '+' | '-' }).v;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (pos < tokens.length && tokens[pos].t === 'op' && (tokens[pos] as { v: string }).v.match(/[*/]/)) {
      const op = (tokens[pos++] as { v: '*' | '/' }).v;
      const right = parseFactor();
      if (op === '/' && right === 0) throw new Error('Division by zero');
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number {
    if (tokens[pos]?.t === 'op' && (tokens[pos] as { v: string }).v === '-') {
      pos++;
      return -parseFactor();
    }
    if (tokens[pos]?.t === 'lp') {
      pos++;
      const val = parseExpr();
      if (tokens[pos]?.t !== 'rp') throw new Error('Missing )');
      pos++;
      return val;
    }
    if (tokens[pos]?.t === 'num') {
      return (tokens[pos++] as { v: number }).v;
    }
    throw new Error('Invalid expression');
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error('Trailing tokens');
  return result;
}

export function evaluateExpression(expression: string): number {
  const tokens = tokenize(expression);
  return parse(tokens);
}
