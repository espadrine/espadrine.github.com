let mpf;
class Calculator {
  // mpWasm is https://github.com/cag/mp-wasm
  // We make it provided externally to support multiple platforms.
  constructor(mpWasm) {
    this.parser = new Parser();
    this.evaluator = new Evaluator();
    this.mpf = mpf = mpWasm.mpf;
  }

  // Returns:
  // - result: a list of MPFR numbers.
  // - tree: the abstract syntax tree representation of the input.
  // - errors: a list of errors in parsing or evaluating the input.
  compute(input) {
    const syntax = this.parser.parse(input);
    if (syntax.errors.length > 0) {
      return { result: null, tree: syntax.tree, errors: syntax.errors };
    }
    const { result, errors } = this.evaluator.eval(syntax.tree);
    return { result, tree: syntax.tree, errors };
  }

  // Returns:
  // - tree: the abstract syntax tree representation of the input.
  // - errors: a list of errors in parsing the input.
  parse(input) {
    return this.parser.parse(input);
  }
}

class Parser {
  parse(input) {
    const tree = new SyntaxTree(input);
    return { tree, errors: tree.errors };
  }
}

class SyntaxTree {
  constructor(input) {
    this.text = input;
    this.cursor = 0;
    this.line = 1;
    this.column = 1;
    this.errors = [];
    this.root = this.parseRoot();
  }

  parseRoot() {
    const expr = this.parseExpr();
    this.skipWhitespace();
    if (!this.endReached()) {
      this.addError('Trailing characters');
    }
    return expr;
  }

  parseExpr() {
    this.skipWhitespace();
    let node = this.newNode(SyntaxTreeNode.type.expr);

    const rest = this.read(this.text.length);
    const type = SyntaxTreeNode.nameFromType.findIndex(type =>
      SyntaxTreeNode.token[type].test(rest));
    let subExpr;
    switch (type) {
      case SyntaxTreeNode.type.number:
        node = this.parseNumber();
        break;
      case SyntaxTreeNode.type.paren:
        node = this.parseParen();
        break;
      case SyntaxTreeNode.type.sep:
        break;  // End of the expression.
      case SyntaxTreeNode.type.prefixOp:
        node.type = type;
        node.func = SyntaxTreeNode.funcFromOperator[this.read()];
        this.advance();
        subExpr = this.parseExpr();
        node.children = [subExpr];
        break;
      case SyntaxTreeNode.type.func:
        node = this.parseFunction(type);
        break;
      default:
        this.addError("Invalid expression");
        this.advance();
    }
    this.closeNode(node);

    // Infix operators.
    this.skipWhitespace();
    if (SyntaxTreeNode.token.infixOp.test(this.read())) {
      const operator = SyntaxTreeNode.funcFromOperator[this.read()];
      if (!operator) {
        throw new Error(`Invalid operator type ${this.read()}`);
      }

      // The expression to return is an infix operation.
      const firstOperand = node;

      node = this.newNode(SyntaxTreeNode.type.infixOp);
      node.startAlong(firstOperand);
      node.func = operator;
      this.advance();

      const secondOperand = this.parseExpr();
      node.children = [firstOperand, secondOperand];

      // Handle associativity.
      if (secondOperand.type === SyntaxTreeNode.token.infixOp &&
          SyntaxTreeNode.operatorAssociativity.get(operator) >
          SyntaxTreeNode.operatorAssociativity.get(secondOperand.func)) {
        // In this situation, we must promote the second operator to toplevel.
        //    [firstOperand <operator> [second[0] <secondOperator> second[1]]]
        // → [[firstOperand <operator> second[0]] <secondOperator> second[1]]
        const newFirstOperand = this.newNode(SyntaxTreeNode.type.infixOp);
        newFirstOperand.startAlong(firstOperand);
        newFirstOperand.endAlong(secondOperand.children[0]);
        newFirstOperand.func = operator;
        newFirstOperand.children = [firstOperand, secondOperand.children[0]];
        node.func = secondOperand.func;
        node.children = [newFirstOperand, secondOperand.children[1]];
      }
      this.closeNode(node);
    }

    // Postfix operators.
    this.skipWhitespace();
    while (SyntaxTreeNode.token.postfixOp.test(this.read())) {
      const operator = SyntaxTreeNode.funcFromOperator[this.read()];
      if (!operator) {
        throw new Error(`Invalid operator type ${this.read()}`);
      }

      // The expression to return is a postfix operation.
      const operand = node;
      this.closeNode(operand);

      node = this.newNode(SyntaxTreeNode.type.postfixOp);
      node.startAlong(operand);
      node.func = operator;
      this.advance();
      node.children = [operand];
      this.closeNode(node);
      this.skipWhitespace();
    }

    return node;
  }

  // Expression of the form "12.5"
  parseNumber() {
    this.skipWhitespace();
    const node = this.newNode(SyntaxTreeNode.type.number);

    const rest = this.read(this.text.length);
    const match = SyntaxTreeNode.token.number.exec(rest);
    this.advance(match[0].length);
    node.number = mpf(match[0].replace(/_/g, ''));

    this.closeNode(node);
    return node;
  }

  // Expression of the form "(…, …)"
  parseParen() {
    this.skipWhitespace();
    const node = this.newNode(SyntaxTreeNode.type.paren);

    if (this.read() !== '(') {  // We only throw when it should never happen.
      throw new Error("Invalid paren does not start with a parenthesis");
    }
    this.advance();

    let closingParenReached = false;
    while (!closingParenReached && this.cursor < this.text.length) {
      this.skipWhitespace();
      node.children.push(this.parseExpr());
      switch (this.read()) {
        case ',':
          this.advance();
          this.skipWhitespace();
          break;
        case ')':
          this.advance();
          closingParenReached = true;
          break;
        default:
          this.addError("Invalid character in parenthesized expression");
          this.advance();
      }
    }
    this.closeNode(node);
    return node;
  }

  // Expression of the form "func(…, …)"
  parseFunction() {
    this.skipWhitespace();
    const node = this.newNode(SyntaxTreeNode.type.func);

    const rest = this.read(this.text.length);
    const funcMatch = SyntaxTreeNode.token.func.exec(rest);
    if (funcMatch == null) {
      throw new Error("Invalid function name");
    }
    node.func = funcMatch[0];
    this.advance(node.func.length);
    this.skipWhitespace();
    if (this.read() !== '(') {
      this.addError("Invalid function with no parameters");
      this.advance();
      this.closeNode(node);
      return node;
    }
    const args = this.parseParen();
    node.children = args.children;

    this.closeNode(node);
    return node;
  }

  // Read the next n characters.
  read(n = 1) {
    return this.text.slice(this.cursor, this.cursor + n);
  }

  // Advance the cursor by n characters.
  advance(n = 1) {
    for (let i = this.cursor; i < this.cursor + n; i++) {
      if (this.text[i] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
    }
    this.cursor += n;
  }

  skipWhitespace() {
    while (/^[ \t\n]/.test(this.read())) {
      this.advance();
    }
  }

  endReached() {
    return this.cursor >= this.text.length;
  }

  newNode(type) {
    return new SyntaxTreeNode(
      type, this.cursor, this.cursor + 1, this.line, this.column, this.text);
  }

  closeNode(node) {
    node.end = this.cursor;
    node.endLine = this.line;
    node.endColumn = this.column;
    node.text = this.text.slice(node.start, node.end);
  }

  addError(message) {
    this.errors.push(new SyntaxTreeError(message, this.line, this.column));
  }

  toString() {
    return this.root.toString();
  }
}

class SyntaxTreeNode {
  constructor(type, start, end, startLine, startColumn, text) {
    this.type = type;
    this.text = text;
    this.children = [];
    this.func = null;
    this.number = null;
    this.start = start;
    this.end = end;
    this.startLine = this.endLine = startLine;
    this.startColumn = this.endColumn = startColumn;
  }

  startAlong(node) {
    this.start = node.start;
    this.startLine = node.startLine;
    this.startColumn = node.startColumn;
  }

  endAlong(node) {
    this.end = node.end;
    this.endLine = node.endLine;
    this.endColumn = node.endColumn;
  }

  // Returns:
  // - result: a list of MPFR numbers.
  // - errors: a list of errors in evaluating the node.
  eval() {
    const childrenEval = this.children.map(c => c.eval());
    const childrenValues = childrenEval.map(c => c.result)
      .reduce((list, val) => list.concat(val), []);
    const result = [], errors = [];
    let operator;
    switch (this.type) {
      case SyntaxTreeNode.type.root:
      case SyntaxTreeNode.type.expr:
        result.push(mpf(0));
        break;
      case SyntaxTreeNode.type.number:
        result.push(mpf(this.number || 0));
        break;
      case SyntaxTreeNode.type.paren:
      case SyntaxTreeNode.type.sep:
        result.push(...childrenValues);
        break;
      case SyntaxTreeNode.type.prefixOp:
        switch (this.func) {
          case "add":
          case "sub":
            result.push(mpf[this.func](0, childrenValues[0]));
            break;
          default:
            throw new Error(`Invalid prefix operator ${this.func}`);
        }
        break;
      case SyntaxTreeNode.type.infixOp:
        result.push(childrenValues.reduce((sum, arg) => sum[this.func](arg)));
        break;
      case SyntaxTreeNode.type.postfixOp:
        if (!mpf[this.func]) {
          throw new Error(`Invalid postfix operator ${this.func}`);
        }
        if (this.func === 'fac') {
          // The factorial function is nonfunctional in mp-wasm,
          // see https://github.com/cag/mp-wasm/issues/3
          result.push(mpf.gamma(childrenValues[0].add(1)));
        } else {
          result.push(mpf[this.func](childrenValues[0]));
        }
        break;
      case SyntaxTreeNode.type.func:
        operator = {
          "ln": "log",
          "round": "rintRound",
          "floor": "rintFloor",
          "ceil": "rintCeil",
          "trunc": "rintTrunc",
        }[this.func] || this.func;
        result.push(mpf[this.func](...childrenValues));
        break;
      default:
        throw new Error("Invalid evaluation " +
          "of nonexistent node type " + this.type);
    }
    childrenEval.forEach(c => errors.push(...c.errors));
    return { result, errors };
  }

  toString() {
    const info =
      (this.type === SyntaxTreeNode.type.number)?       this.number + ' ':
      (this.type === SyntaxTreeNode.type.prefixOp  ||
       this.type === SyntaxTreeNode.type.infixOp   ||
       this.type === SyntaxTreeNode.type.postfixOp ||
       this.type === SyntaxTreeNode.type.func)?         this.func   + ' ':
      '';
    const curText =
      `${this.startLine}:${this.startColumn}-` +
      `${this.endLine}:${this.endColumn} ` +
      `${SyntaxTreeNode.nameFromType[this.type]} ` +
      `${info}${JSON.stringify(this.text)}`;
    const childrenText = this.children.map(c =>
      c.toString().split('\n')
      .map(line => `  ${line}`)
      .join('\n'))
    .join('\n');
    return curText + ((this.children.length > 0)? `\n${childrenText}`: "");
  }
}

class SyntaxTreeError {
  constructor(message, line, column) {
    this.message = message;
    this.line = line;
    this.column = column;
  }
  toString() {
    return `${this.line}:${this.column}: ${this.message}`;
  }
}

// Node types.
SyntaxTreeNode.type = {
  root:         0,
  expr:         1,
  number:       2,
  paren:        3,
  sep:          4,
  prefixOp:     5,
  infixOp:      6,
  postfixOp:    7,
  func:         8,
};
SyntaxTreeNode.nameFromType = Object.keys(SyntaxTreeNode.type);

SyntaxTreeNode.token = {
  root:         new RegExp("[]"),
  expr:         new RegExp("[]"),
  number:       /^[0-9_]+(\.[0-9_]+)?([eE][0-9_]+)?/,
  paren:        /^\(/,
  sep:          /^,/,
  prefixOp:     /^[+-]/,
  infixOp:      /^([+\-*×/÷%^]|\*\*)/,  // If you add an operator, add its precedence in operatorAssociativity.
  postfixOp:    /^[!]/,
  func:         /^(rootn|dim|atan2|gammaInc|beta|jn|yn|agm|hypot|fmod|remainder|min|max|sqr|sqrt|recSqrt|cbrt|neg|abs|log|ln|log2|log10|log1p|exp|exp2|exp10|expm1|cos|sin|tan|sec|csc|cot|acos|asin|atan|cosh|sinh|tanh|sech|csch|coth|acosh|asinh|atanh|eint|li2|gamma|lngamma|digamma|zeta|erf|erfc|j0|j1|y0|y1|rint|ceil|rintCeil|floor|rintFloor|round|rintRound|rintRoundeven|trunc|rintTrunc|frac)\b/,
};

SyntaxTreeNode.operators = [..."+-*×/÷%^", "**", "!"];
SyntaxTreeNode.operatorAssociativity =
  SyntaxTreeNode.operators.reduce((a, o, i) => a.set(o, i), new Map());
SyntaxTreeNode.funcFromOperator = {
  '+':  "add",
  '-':  "sub",
  '*':  "mul",
  '×':  "mul",
  '/':  "div",
  '÷':  "div",
  '%':  "remainder",
  '^':  "pow",
  '**': "pow",
  '!':  "fac",
};

class Evaluator {
  eval(tree) {
    return tree.root.eval();
  }
}

export default Calculator;
