(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
window.fetchMPWasm = function fetchMPWasm(source) {
  const { importObj, errNoObj } = require("./setup");
  const memory = importObj.env.memory;

  return WebAssembly.instantiateStreaming(fetch(source), importObj).then(
    obj => {
      const wasmInstance = obj.instance;
      errNoObj.getLoc = wasmInstance.exports.___errno_location;

      const memUtils = require("./mem-utils")(memory, wasmInstance);
      const mpf = require("./mpf")(wasmInstance, memUtils);

      return { mpf };
    }
  );
};

},{"./mem-utils":2,"./mpf":3,"./setup":11}],2:[function(require,module,exports){
const assert = require("assert");
const { LRUMap } = require("lru_map");

const utf8Encoder = new TextEncoder("utf-8");
const utf8Decoder = new TextDecoder("utf-8");

module.exports = function(memory, wasmInstance) {
  const memViews = {
    int8: new Int8Array(memory.buffer),
    uint8: new Uint8Array(memory.buffer),
    uint8Clamped: new Uint8ClampedArray(memory.buffer),
    int16: new Int16Array(memory.buffer),
    uint16: new Uint16Array(memory.buffer),
    int32: new Int32Array(memory.buffer),
    uint32: new Uint32Array(memory.buffer),
    float32: new Float32Array(memory.buffer),
    float64: new Float64Array(memory.buffer)
  };

  const { _malloc, _sizeof_unsigned_long } = wasmInstance.exports;

  const wordSize = _sizeof_unsigned_long();
  const memWordView = memViews[`uint${wordSize * 8}`];
  const memSwordView = memViews[`int${wordSize * 8}`];
  const wordLimit = Math.pow(2, wordSize * 8);

  const registerSize = 16;
  const numRegisters = 8;
  const registersBeginPtr = _malloc(registerSize * numRegisters);
  const initRegister = Symbol("initRegister");
  const clearRegister = Symbol("clearRegister");
  const registersObjMap = new LRUMap(numRegisters);
  registersObjMap.assign([...Array(numRegisters).keys()].map(n => [n, null]));
  registersObjMap.shift = function shift() {
    const [n, obj] = LRUMap.prototype.shift.call(this);
    if (obj != null) {
      obj[clearRegister](getRegisterPtr(n));
      objsRegisterNumMap.delete(obj);
    }
    return [n, obj];
  };

  const objsRegisterNumMap = new WeakMap();

  function getRegisterPtr(n) {
    assert(
      Number.isInteger(n) && n >= 0 && n < numRegisters,
      `invalid register number ${n}`
    );
    return registersBeginPtr + n * registerSize;
  }

  function ensureRegister(obj) {
    let registerPtr;
    if (objsRegisterNumMap.has(obj)) {
      n = objsRegisterNumMap.get(obj);
      assert(
        registersObjMap.get(n) === obj,
        `wrong object found in register ${n}`
      );
      registerPtr = getRegisterPtr(n);
    } else {
      n = registersObjMap.shift()[0];
      registerPtr = getRegisterPtr(n);

      registersObjMap.set(n, obj);
      objsRegisterNumMap.set(obj, n);

      obj[initRegister](registerPtr);
    }
    return registerPtr;
  }

  return {
    isWord(n) {
      return Number.isInteger(n) && n >= 0 && n < wordLimit;
    },

    isSword(n) {
      return Number.isInteger(n) && n * 2 >= -wordLimit && n * 2 < wordLimit;
    },

    ensureRegister,
    initRegister,
    clearRegister,
    registerSize,
    memViews,

    stringToNewCStr(str) {
      const b = utf8Encoder.encode(str);
      const ptr = _malloc(b.length + 1);
      memViews.uint8.set(b, ptr);
      memViews.uint8[ptr + b.length] = 0;
      return ptr;
    },
    cstrToString(ptr) {
      let length;
      for (length = 0; memViews.uint8[ptr + length] !== 0; ++length);
      return utf8Decoder.decode(new DataView(memory.buffer, ptr, length));
    }
  };
};

},{"assert":4,"lru_map":9}],3:[function(require,module,exports){
const assert = require("assert");
const { camelize } = require("humps");

module.exports = function(wasmInstance, memUtils) {
  const wasmExports = wasmInstance.exports;
  const {
    isWord,
    isSword,

    ensureRegister,
    initRegister,
    clearRegister,
    registerSize,
    memViews,

    cstrToString,
    stringToNewCStr
  } = memUtils;

  const {
    _malloc,
    _free,
    _sizeof_mpfr_struct,
    _get_MPFR_PREC_MIN,
    _get_MPFR_PREC_MAX,
    _mpfr_init,
    _mpfr_init2,
    _mpfr_clear,
    _get_mpfr_sign,
    _set_mpfr_sign,
    _get_mpfr_exp,
    _set_mpfr_exp,
    _mpfr_custom_get_size,
    _mpfr_custom_get_significand,
    _mpfr_set_prec,
    _mpfr_get_prec,
    _mpfr_set_default_prec,
    _mpfr_get_default_prec,
    _mpfr_set_default_rounding_mode,
    _mpfr_get_default_rounding_mode,
    _mpfr_set,
    _mpfr_set_d,
    _mpfr_set_str,
    _conv_mpfr_to_str,
    _mpfr_free_str,
    _mpfr_get_d,
    _mpfr_nan_p,
    _mpfr_number_p,
    _mpfr_integer_p
  } = wasmExports;

  function checkValidPrec(prec) {
    if (
      prec == null ||
      typeof prec !== "number" ||
      !Number.isInteger(prec) ||
      prec < mpf.precMin ||
      prec > mpf.precMax
    ) {
      throw new Error(`invalid precision value ${prec}`);
    }
  }

  function normalizeBaseOption(base) {
    if (base == null) return 0;

    if (Number.isInteger(base) && (base == 0 || (base >= 2 && base <= 62)))
      return base;

    throw new Error(`invalid base ${base}`);
  }

  function normalizeRoundingMode(roundingMode) {
    if (roundingMode == null) return _mpfr_get_default_rounding_mode();

    if (
      typeof roundingMode === "number" &&
      mpf.roundingModeNames.hasOwnProperty(roundingMode)
    )
      return roundingMode;

    if (
      typeof roundingMode === "string" &&
      mpf.roundingModes.hasOwnProperty(roundingMode)
    )
      return mpf.roundingModes[roundingMode];

    throw new Error(`invalid rounding mode ${roundingMode}`);
  }

  const readFromMemory = Symbol("readFromMemory");
  const setRaw = Symbol("setRaw");
  const precision = Symbol("precision");
  const sign = Symbol("sign");
  const exponent = Symbol("exponent");
  const significand = Symbol("significand");

  class MPFloat {
    constructor(initialValue, opts) {
      const { prec } = opts || {};

      if (prec != null) {
        checkValidPrec(prec);
        this[precision] = prec;
      }

      const ptr = ensureRegister(this);

      if (initialValue != null) {
        this[setRaw](ptr, initialValue, opts);
      }

      this[readFromMemory](ptr);
    }

    [readFromMemory](ptr) {
      this[precision] = _mpfr_get_prec(ptr);
      this[sign] = _get_mpfr_sign(ptr);
      this[exponent] = _get_mpfr_exp(ptr);
      const significandSize = _mpfr_custom_get_size(this[precision]);

      if (
        this[significand] != null &&
        significandSize <= this[significand].buffer.byteLength
      ) {
        this[significand] = this[significand].subarray(0, significandSize);
      } else {
        this[significand] = new Uint8Array(new ArrayBuffer(significandSize));
      }

      const significandPtr = _mpfr_custom_get_significand(ptr);

      this[significand].set(
        memViews.uint8.subarray(
          significandPtr,
          significandPtr + significandSize
        )
      );
    }

    [initRegister](ptr) {
      if (
        this[precision] != null &&
        this[sign] != null &&
        this[exponent] != null &&
        this[significand] != null
      ) {
        _mpfr_init2(ptr, this[precision]);
        _set_mpfr_sign(ptr, this[sign]);
        _set_mpfr_exp(ptr, this[exponent]);

        const significandPtr = _mpfr_custom_get_significand(ptr);
        memViews.uint8.set(this[significand], significandPtr);
      } else {
        if (this[precision] == null) {
          _mpfr_init(ptr);
        } else {
          _mpfr_init2(ptr, this[precision]);
        }
      }
    }

    [clearRegister](ptr) {
      _mpfr_clear(ptr);
    }

    setPrec(prec) {
      checkValidPrec(prec);
      const ptr = ensureRegister(this);
      _mpfr_set_prec(ptr, prec);
      this[readFromMemory](ptr);
    }

    getPrec() {
      assert(this[precision] != null);
      return this[precision];
    }

    set(newValue, opts) {
      const ptr = ensureRegister(this);
      this[setRaw](ptr, newValue, opts);
      this[readFromMemory](ptr);
    }

    [setRaw](ptr, newValue, opts) {
      const { base, roundingMode } = opts || {};

      if (typeof newValue === "number") {
        _mpfr_set_d(ptr, newValue, normalizeRoundingMode(roundingMode));
      } else if (mpf.isMPFloat(newValue)) {
        const ptr2 = ensureRegister(newValue);
        _mpfr_set(ptr, ptr2, normalizeRoundingMode(roundingMode));
      } else if (
        typeof newValue === "string" ||
        typeof newValue === "bigint" ||
        typeof newValue === "object"
      ) {
        const valAsCStr = stringToNewCStr(newValue);
        _mpfr_set_str(
          ptr,
          valAsCStr,
          normalizeBaseOption(base),
          normalizeRoundingMode(roundingMode)
        );
        _free(valAsCStr);
      } else {
        throw new Error(`can't set value to ${newValue}`);
      }
    }

    toString() {
      const ptr = ensureRegister(this);
      const strPtr = _conv_mpfr_to_str(ptr);
      assert(strPtr !== 0, `could not convert mpfr at ${ptr} to string`);
      const ret = cstrToString(strPtr);
      _mpfr_free_str(strPtr);
      return ret;
    }

    toNumber(opts) {
      const { roundingMode } = opts || {};
      const ptr = ensureRegister(this);
      return _mpfr_get_d(ptr, normalizeRoundingMode(roundingMode));
    }

    isNaN() {
      const ptr = ensureRegister(this);
      return Boolean(_mpfr_nan_p(ptr));
    }

    isFinite() {
      const ptr = ensureRegister(this);
      return Boolean(_mpfr_number_p(ptr));
    }

    isInteger() {
      const ptr = ensureRegister(this);
      return Boolean(_mpfr_integer_p(ptr));
    }

    isSignBitSet() {
      return this[sign] < 0;
    }

    getBinaryExponent() {
      if (this[exponent] === -2147483645) return Infinity;
      if (this[exponent] === -2147483646) return NaN;
      if (this[exponent] === -2147483647) return -Infinity;
      return this[exponent];
    }

    getSignificandRawBytes() {
      return this[significand];
    }

    [Symbol.for("nodejs.util.inspect.custom")]() {
      return `mpf('${this.toString()}')`;
    }
  }

  function mpf(...args) {
    return new MPFloat(...args);
  }
  mpf.prototype = MPFloat.prototype;

  mpf.structSize = _sizeof_mpfr_struct();
  assert(
    mpf.structSize <= registerSize,
    `mpfr struct size ${
      mpf.structSize
    } bigger than register size ${registerSize}`
  );

  mpf.precMin = _get_MPFR_PREC_MIN();
  mpf.precMax = _get_MPFR_PREC_MAX();

  mpf.roundingModeNames = {};
  mpf.roundingModes = {};
  [
    ["roundTiesToEven", 0],
    ["roundTowardZero", 1],
    ["roundTowardPositive", 2],
    ["roundTowardNegative", 3],
    ["roundAwayZero", 4],
    ["roundFaithful", 5],
    ["roundTiesToAwayZero", -1]
  ].forEach(([name, value]) => {
    mpf.roundingModeNames[value] = name;
    mpf.roundingModes[name] = value;
  });
  Object.freeze(mpf.roundingModeNames);
  Object.freeze(mpf.roundingModes);

  mpf.getDefaultPrec = function getDefaultPrec() {
    return _mpfr_get_default_prec();
  };

  mpf.setDefaultPrec = function setDefaultPrec(prec) {
    checkValidPrec(prec);
    _mpfr_set_default_prec(prec);
  };

  mpf.getDefaultRoundingMode = function getDefaultRoundingMode() {
    return mpf.roundingModeNames[_mpfr_get_default_rounding_mode()];
  };

  mpf.setDefaultRoundingMode = function setDefaultRoundingMode(roundingMode) {
    if (roundingMode == null) throw new Error("missing rounding mode");
    _mpfr_set_default_rounding_mode(normalizeRoundingMode(roundingMode));
  };

  mpf.isMPFloat = function isMPFloat(value) {
    return typeof value === "object" && value instanceof MPFloat;
  };

  ["log2", "pi", "euler", "catalan"].forEach(constant => {
    const name = `get${constant.charAt(0).toUpperCase()}${constant.slice(1)}`;
    const fn = wasmExports[`_mpfr_const_${constant}`];
    mpf[name] = {
      [name](opts) {
        const { roundingMode } = opts || {};
        const ret = mpf(null, opts);
        const retPtr = ensureRegister(ret);
        fn(retPtr, normalizeRoundingMode(roundingMode));
        ret[readFromMemory](retPtr);
        return ret;
      }
    }[name];
  });

  curriedOps = [];
  [
    "sqr",
    "sqrt",
    "rec_sqrt",
    "cbrt",
    "neg",
    "abs",
    "log",
    "log2",
    "log10",
    "log1p",
    "exp",
    "exp2",
    "exp10",
    "expm1",
    "cos",
    "sin",
    "tan",
    "sec",
    "csc",
    "cot",
    "acos",
    "asin",
    "atan",
    "cosh",
    "sinh",
    "tanh",
    "sech",
    "csch",
    "coth",
    "acosh",
    "asinh",
    "atanh",
    "fac",
    "eint",
    "li2",
    "gamma",
    "lngamma",
    "digamma",
    "zeta",
    "erf",
    "erfc",
    "j0",
    "j1",
    "y0",
    "y1",
    "rint",
    "rint_ceil",
    "rint_floor",
    "rint_round",
    "rint_roundeven",
    "rint_trunc",
    "frac"
  ].forEach(op => {
    const name = camelize(op);
    mpf[name] = {
      [name](a, opts) {
        if (a == null) throw new Error("missing argument");

        const { roundingMode } = opts || {};
        const ret = mpf(a, opts);
        const retPtr = ensureRegister(ret);

        let fn, arg;

        if ((fn = wasmExports[`_mpfr_${op}_ui`]) && isWord(a)) {
          arg = a;
        } else if ((fn = wasmExports[`_mpfr_${op}`])) {
          arg = retPtr;
        } else {
          throw new Error(`can't perform ${op} on ${a}`);
        }

        fn(retPtr, arg, normalizeRoundingMode(roundingMode));
        ret[readFromMemory](retPtr);
        return ret;
      }
    }[name];
    if (name !== "fac") curriedOps.push(name);
  });

  ["ceil", "floor", "round", "roundeven", "trunc"].forEach(op => {
    const name = camelize(op);
    const fn = wasmExports[`_mpfr_${op}`];
    mpf[name] = {
      [name](a, opts) {
        if (a == null) throw new Error("missing argument");

        const ret = mpf(a, opts);
        const retPtr = ensureRegister(ret);

        fn(retPtr, retPtr);
        ret[readFromMemory](retPtr);
        return ret;
      }
    }[name];
    curriedOps.push(name);
  });

  [
    "add",
    "sub",
    "mul",
    "div",
    "rootn",
    "pow",
    "dim",
    "atan2",
    "gamma_inc",
    "beta",
    "agm",
    "hypot",
    "fmod",
    "remainder",
    "min",
    "max"
  ].forEach(op => {
    const name = camelize(op);
    mpf[name] = {
      [name](a, b, opts) {
        if (a == null) throw new Error("missing first argument");
        if (b == null) throw new Error("missing second argument");

        const { roundingMode } = opts || {};
        const ret = mpf(null, opts);

        let fn, arg1, arg2;

        // here is a long chain of responsibility...
        // castless cases
        if (
          (fn = wasmExports[`_mpfr_d_${op}`]) &&
          typeof a === "number" &&
          mpf.isMPFloat(b)
        ) {
          arg1 = a;
          arg2 = ensureRegister(b);
        } else if (
          (fn = wasmExports[`_mpfr_${op}_d`]) &&
          mpf.isMPFloat(a) &&
          typeof b === "number"
        ) {
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if (fn && typeof a === "number" && mpf.isMPFloat(b)) {
          // assume op is commutative if _mpfr_d_${op} does not exist
          arg1 = ensureRegister(b);
          arg2 = a;
        } else if (
          (fn = wasmExports[`_mpfr_ui_${op}_ui`]) &&
          isWord(a) &&
          isWord(b)
        ) {
          arg1 = a;
          arg2 = b;
        } else if (
          (fn = wasmExports[`_mpfr_${op}_ui`]) &&
          mpf.isMPFloat(a) &&
          isWord(b)
        ) {
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if (
          (fn = wasmExports[`_mpfr_${op}_si`]) &&
          mpf.isMPFloat(a) &&
          isSword(b)
        ) {
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if (
          (fn = wasmExports[`_mpfr_ui_${op}`]) &&
          isWord(a) &&
          mpf.isMPFloat(b)
        ) {
          arg1 = a;
          arg2 = ensureRegister(b);
        } else if (
          (fn = wasmExports[`_mpfr_${op}`]) &&
          mpf.isMPFloat(a) &&
          mpf.isMPFloat(b)
        ) {
          arg1 = ensureRegister(a);
          arg2 = ensureRegister(b);
        }
        // casted cases
        else if ((fn = wasmExports[`_mpfr_d_${op}`]) && typeof a === "number") {
          ret.set(b, opts);
          b = ret;
          arg1 = a;
          arg2 = ensureRegister(b);
        } else if (
          (fn = wasmExports[`_mpfr_${op}_d`]) &&
          typeof b === "number"
        ) {
          ret.set(a, opts);
          a = ret;
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if (fn && typeof a === "number") {
          // (commutativity assumption again)
          ret.set(b, opts);
          b = ret;
          arg1 = ensureRegister(b);
          arg2 = a;
        } else if ((fn = wasmExports[`_mpfr_${op}_ui`]) && isWord(b)) {
          ret.set(a, opts);
          a = ret;
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if ((fn = wasmExports[`_mpfr_${op}_si`]) && isSword(b)) {
          ret.set(a, opts);
          a = ret;
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if ((fn = wasmExports[`_mpfr_ui_${op}`]) && isWord(a)) {
          ret.set(b, opts);
          b = ret;
          arg1 = a;
          arg2 = ensureRegister(b);
        } else if ((fn = wasmExports[`_mpfr_${op}`]) && mpf.isMPFloat(b)) {
          ret.set(a, opts);
          a = ret;
          arg1 = ensureRegister(a);
          arg2 = ensureRegister(b);
        } else if (fn && mpf.isMPFloat(a)) {
          ret.set(b, opts);
          b = ret;
          arg1 = ensureRegister(a);
          arg2 = ensureRegister(b);
        } else if (fn) {
          ret.set(a, opts);
          a = ret;
          b = mpf(b, opts);
          arg1 = ensureRegister(a);
          arg2 = ensureRegister(b);
        }
        // couldn't find anything
        else {
          throw new Error(`can't perform ${op} on ${a} and ${b}`);
        }

        const retPtr = ensureRegister(ret);
        fn(retPtr, arg1, arg2, normalizeRoundingMode(roundingMode));
        ret[readFromMemory](retPtr);
        return ret;
      }
    }[name];
    curriedOps.push(name);
  });

  ["jn", "yn"].forEach(op => {
    const name = camelize(op);
    const fn = wasmExports[`_mpfr_${op}`];
    mpf[name] = {
      [name](n, a, opts) {
        if (n == null) throw new Error("missing n");
        if (a == null) throw new Error("missing argument");
        if (!isSword(n)) {
          throw new Error(`can't perform ${op} with invalid n=${n} (a = ${a})`);
        }

        const { roundingMode } = opts || {};
        const ret = mpf(a, opts);
        const retPtr = ensureRegister(ret);

        fn(retPtr, n, retPtr, normalizeRoundingMode(roundingMode));
        ret[readFromMemory](retPtr);
        return ret;
      }
    }[name];
  });

  const { _mpfr_cmp, _mpfr_cmp_d, _mpfr_cmpabs } = wasmExports;

  mpf.cmp = function cmp(a, b) {
    if (
      typeof a === "string" ||
      typeof a === "bigint" ||
      (typeof a === "object" && !(a instanceof MPFloat))
    ) {
      a = mpf(a);
    }

    if (
      typeof b === "string" ||
      typeof b === "bigint" ||
      (typeof b === "object" && !(b instanceof MPFloat))
    ) {
      b = mpf(b);
    }

    let ret;

    if (mpf.isMPFloat(a)) {
      if (mpf.isMPFloat(b)) {
        ret = _mpfr_cmp(ensureRegister(a), ensureRegister(b));
      } else if (typeof b === "number") {
        ret = _mpfr_cmp_d(ensureRegister(a), b);
      }
    } else if (typeof a === "number") {
      if (mpf.isMPFloat(b)) {
        ret = -_mpfr_cmp_d(ensureRegister(b), a);
      } else if (typeof b === "number") {
        a = mpf(a);
        ret = _mpfr_cmp_d(ensureRegister(a), b);
      }
    }

    if (ret == null) throw new Error(`don't know how to cmp ${a} and ${b}`);

    return ret;
  };
  curriedOps.push("cmp");

  mpf.cmpabs = function cmpabs(a, b) {
    if (!mpf.isMPFloat(a)) {
      a = mpf(a);
    }

    if (!mpf.isMPFloat(b)) {
      b = mpf(b);
    }

    return _mpfr_cmpabs(ensureRegister(a), ensureRegister(b));
  };
  curriedOps.push("cmpabs");

  [
    ["greater", "gt"],
    ["greaterequal", "gte"],
    ["less", "lt"],
    ["lessequal", "lte"],
    ["equal", "eq"],
    ["lessgreater", "lgt"]
  ].forEach(([op, name]) => {
    mpf.prototype[name] = {
      [name](other) {
        if (!mpf.isMPFloat(other)) {
          other = mpf(other);
        }
        return Boolean(
          wasmExports[`_mpfr_${op}_p`](
            ensureRegister(this),
            ensureRegister(other)
          )
        );
      }
    }[name];
  });

  curriedOps.forEach(name => {
    mpf.prototype[name] = {
      [name](...args) {
        return mpf[name](this, ...args);
      }
    }[name];
  });

  return mpf;
};

},{"assert":4,"humps":8}],4:[function(require,module,exports){
(function (global){
'use strict';

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util/');
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"util/":7}],5:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],6:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],7:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":6,"_process":10,"inherits":5}],8:[function(require,module,exports){
// =========
// = humps =
// =========
// Underscore-to-camelCase converter (and vice versa)
// for strings and object keys

// humps is copyright © 2012+ Dom Christie
// Released under the MIT license.


;(function(global) {

  var _processKeys = function(convert, obj, options) {
    if(!_isObject(obj) || _isDate(obj) || _isRegExp(obj) || _isBoolean(obj) || _isFunction(obj)) {
      return obj;
    }

    var output,
        i = 0,
        l = 0;

    if(_isArray(obj)) {
      output = [];
      for(l=obj.length; i<l; i++) {
        output.push(_processKeys(convert, obj[i], options));
      }
    }
    else {
      output = {};
      for(var key in obj) {
        if(Object.prototype.hasOwnProperty.call(obj, key)) {
          output[convert(key, options)] = _processKeys(convert, obj[key], options);
        }
      }
    }
    return output;
  };

  // String conversion methods

  var separateWords = function(string, options) {
    options = options || {};
    var separator = options.separator || '_';
    var split = options.split || /(?=[A-Z])/;

    return string.split(split).join(separator);
  };

  var camelize = function(string) {
    if (_isNumerical(string)) {
      return string;
    }
    string = string.replace(/[\-_\s]+(.)?/g, function(match, chr) {
      return chr ? chr.toUpperCase() : '';
    });
    // Ensure 1st char is always lowercase
    return string.substr(0, 1).toLowerCase() + string.substr(1);
  };

  var pascalize = function(string) {
    var camelized = camelize(string);
    // Ensure 1st char is always uppercase
    return camelized.substr(0, 1).toUpperCase() + camelized.substr(1);
  };

  var decamelize = function(string, options) {
    return separateWords(string, options).toLowerCase();
  };

  // Utilities
  // Taken from Underscore.js

  var toString = Object.prototype.toString;

  var _isFunction = function(obj) {
    return typeof(obj) === 'function';
  };
  var _isObject = function(obj) {
    return obj === Object(obj);
  };
  var _isArray = function(obj) {
    return toString.call(obj) == '[object Array]';
  };
  var _isDate = function(obj) {
    return toString.call(obj) == '[object Date]';
  };
  var _isRegExp = function(obj) {
    return toString.call(obj) == '[object RegExp]';
  };
  var _isBoolean = function(obj) {
    return toString.call(obj) == '[object Boolean]';
  };

  // Performant way to determine if obj coerces to a number
  var _isNumerical = function(obj) {
    obj = obj - 0;
    return obj === obj;
  };

  // Sets up function which handles processing keys
  // allowing the convert function to be modified by a callback
  var _processor = function(convert, options) {
    var callback = options && 'process' in options ? options.process : options;

    if(typeof(callback) !== 'function') {
      return convert;
    }

    return function(string, options) {
      return callback(string, convert, options);
    }
  };

  var humps = {
    camelize: camelize,
    decamelize: decamelize,
    pascalize: pascalize,
    depascalize: decamelize,
    camelizeKeys: function(object, options) {
      return _processKeys(_processor(camelize, options), object);
    },
    decamelizeKeys: function(object, options) {
      return _processKeys(_processor(decamelize, options), object, options);
    },
    pascalizeKeys: function(object, options) {
      return _processKeys(_processor(pascalize, options), object);
    },
    depascalizeKeys: function () {
      return this.decamelizeKeys.apply(this, arguments);
    }
  };

  if (typeof define === 'function' && define.amd) {
    define(humps);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = humps;
  } else {
    global.humps = humps;
  }

})(this);

},{}],9:[function(require,module,exports){
/**
 * A doubly linked list-based Least Recently Used (LRU) cache. Will keep most
 * recently used items while discarding least recently used items when its limit
 * is reached.
 *
 * Licensed under MIT. Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>
 * See README.md for details.
 *
 * Illustration of the design:
 *
 *       entry             entry             entry             entry
 *       ______            ______            ______            ______
 *      | head |.newer => |      |.newer => |      |.newer => | tail |
 *      |  A   |          |  B   |          |  C   |          |  D   |
 *      |______| <= older.|______| <= older.|______| <= older.|______|
 *
 *  removed  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  added
 */
(function(g,f){
  const e = typeof exports == 'object' ? exports : typeof g == 'object' ? g : {};
  f(e);
  if (typeof define == 'function' && define.amd) { define('lru', e); }
})(this, function(exports) {

const NEWER = Symbol('newer');
const OLDER = Symbol('older');

function LRUMap(limit, entries) {
  if (typeof limit !== 'number') {
    // called as (entries)
    entries = limit;
    limit = 0;
  }

  this.size = 0;
  this.limit = limit;
  this.oldest = this.newest = undefined;
  this._keymap = new Map();

  if (entries) {
    this.assign(entries);
    if (limit < 1) {
      this.limit = this.size;
    }
  }
}

exports.LRUMap = LRUMap;

function Entry(key, value) {
  this.key = key;
  this.value = value;
  this[NEWER] = undefined;
  this[OLDER] = undefined;
}


LRUMap.prototype._markEntryAsUsed = function(entry) {
  if (entry === this.newest) {
    // Already the most recenlty used entry, so no need to update the list
    return;
  }
  // HEAD--------------TAIL
  //   <.older   .newer>
  //  <--- add direction --
  //   A  B  C  <D>  E
  if (entry[NEWER]) {
    if (entry === this.oldest) {
      this.oldest = entry[NEWER];
    }
    entry[NEWER][OLDER] = entry[OLDER]; // C <-- E.
  }
  if (entry[OLDER]) {
    entry[OLDER][NEWER] = entry[NEWER]; // C. --> E
  }
  entry[NEWER] = undefined; // D --x
  entry[OLDER] = this.newest; // D. --> E
  if (this.newest) {
    this.newest[NEWER] = entry; // E. <-- D
  }
  this.newest = entry;
};

LRUMap.prototype.assign = function(entries) {
  let entry, limit = this.limit || Number.MAX_VALUE;
  this._keymap.clear();
  let it = entries[Symbol.iterator]();
  for (let itv = it.next(); !itv.done; itv = it.next()) {
    let e = new Entry(itv.value[0], itv.value[1]);
    this._keymap.set(e.key, e);
    if (!entry) {
      this.oldest = e;
    } else {
      entry[NEWER] = e;
      e[OLDER] = entry;
    }
    entry = e;
    if (limit-- == 0) {
      throw new Error('overflow');
    }
  }
  this.newest = entry;
  this.size = this._keymap.size;
};

LRUMap.prototype.get = function(key) {
  // First, find our cache entry
  var entry = this._keymap.get(key);
  if (!entry) return; // Not cached. Sorry.
  // As <key> was found in the cache, register it as being requested recently
  this._markEntryAsUsed(entry);
  return entry.value;
};

LRUMap.prototype.set = function(key, value) {
  var entry = this._keymap.get(key);

  if (entry) {
    // update existing
    entry.value = value;
    this._markEntryAsUsed(entry);
    return this;
  }

  // new entry
  this._keymap.set(key, (entry = new Entry(key, value)));

  if (this.newest) {
    // link previous tail to the new tail (entry)
    this.newest[NEWER] = entry;
    entry[OLDER] = this.newest;
  } else {
    // we're first in -- yay
    this.oldest = entry;
  }

  // add new entry to the end of the linked list -- it's now the freshest entry.
  this.newest = entry;
  ++this.size;
  if (this.size > this.limit) {
    // we hit the limit -- remove the head
    this.shift();
  }

  return this;
};

LRUMap.prototype.shift = function() {
  // todo: handle special case when limit == 1
  var entry = this.oldest;
  if (entry) {
    if (this.oldest[NEWER]) {
      // advance the list
      this.oldest = this.oldest[NEWER];
      this.oldest[OLDER] = undefined;
    } else {
      // the cache is exhausted
      this.oldest = undefined;
      this.newest = undefined;
    }
    // Remove last strong reference to <entry> and remove links from the purged
    // entry being returned:
    entry[NEWER] = entry[OLDER] = undefined;
    this._keymap.delete(entry.key);
    --this.size;
    return [entry.key, entry.value];
  }
};

// ----------------------------------------------------------------------------
// Following code is optional and can be removed without breaking the core
// functionality.

LRUMap.prototype.find = function(key) {
  let e = this._keymap.get(key);
  return e ? e.value : undefined;
};

LRUMap.prototype.has = function(key) {
  return this._keymap.has(key);
};

LRUMap.prototype['delete'] = function(key) {
  var entry = this._keymap.get(key);
  if (!entry) return;
  this._keymap.delete(entry.key);
  if (entry[NEWER] && entry[OLDER]) {
    // relink the older entry with the newer entry
    entry[OLDER][NEWER] = entry[NEWER];
    entry[NEWER][OLDER] = entry[OLDER];
  } else if (entry[NEWER]) {
    // remove the link to us
    entry[NEWER][OLDER] = undefined;
    // link the newer entry to head
    this.oldest = entry[NEWER];
  } else if (entry[OLDER]) {
    // remove the link to us
    entry[OLDER][NEWER] = undefined;
    // link the newer entry to head
    this.newest = entry[OLDER];
  } else {// if(entry[OLDER] === undefined && entry.newer === undefined) {
    this.oldest = this.newest = undefined;
  }

  this.size--;
  return entry.value;
};

LRUMap.prototype.clear = function() {
  // Not clearing links should be safe, as we don't expose live links to user
  this.oldest = this.newest = undefined;
  this.size = 0;
  this._keymap.clear();
};


function EntryIterator(oldestEntry) { this.entry = oldestEntry; }
EntryIterator.prototype[Symbol.iterator] = function() { return this; }
EntryIterator.prototype.next = function() {
  let ent = this.entry;
  if (ent) {
    this.entry = ent[NEWER];
    return { done: false, value: [ent.key, ent.value] };
  } else {
    return { done: true, value: undefined };
  }
};


function KeyIterator(oldestEntry) { this.entry = oldestEntry; }
KeyIterator.prototype[Symbol.iterator] = function() { return this; }
KeyIterator.prototype.next = function() {
  let ent = this.entry;
  if (ent) {
    this.entry = ent[NEWER];
    return { done: false, value: ent.key };
  } else {
    return { done: true, value: undefined };
  }
};

function ValueIterator(oldestEntry) { this.entry = oldestEntry; }
ValueIterator.prototype[Symbol.iterator] = function() { return this; }
ValueIterator.prototype.next = function() {
  let ent = this.entry;
  if (ent) {
    this.entry = ent[NEWER];
    return { done: false, value: ent.value };
  } else {
    return { done: true, value: undefined };
  }
};


LRUMap.prototype.keys = function() {
  return new KeyIterator(this.oldest);
};

LRUMap.prototype.values = function() {
  return new ValueIterator(this.oldest);
};

LRUMap.prototype.entries = function() {
  return this;
};

LRUMap.prototype[Symbol.iterator] = function() {
  return new EntryIterator(this.oldest);
};

LRUMap.prototype.forEach = function(fun, thisObj) {
  if (typeof thisObj !== 'object') {
    thisObj = this;
  }
  let entry = this.oldest;
  while (entry) {
    fun.call(thisObj, entry.value, entry.key, this);
    entry = entry[NEWER];
  }
};

/** Returns a JSON (array) representation */
LRUMap.prototype.toJSON = function() {
  var s = new Array(this.size), i = 0, entry = this.oldest;
  while (entry) {
    s[i++] = { key: entry.key, value: entry.value };
    entry = entry[NEWER];
  }
  return s;
};

/** Returns a String representation */
LRUMap.prototype.toString = function() {
  var s = '', entry = this.oldest;
  while (entry) {
    s += String(entry.key)+':'+entry.value;
    entry = entry[NEWER];
    if (entry) {
      s += ' < ';
    }
  }
  return s;
};

});

},{}],10:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],11:[function(require,module,exports){
const globalImports = {
  NaN: new WebAssembly.Global({ value: "f64" }, NaN),
  Infinity: new WebAssembly.Global({ value: "f64" }, Infinity)
};

const ptrSize = 4;
const wasmPageSize = 65536;
const numMemoryPages = 256;
const totalMemory = numMemoryPages * wasmPageSize;
const memoryAlignment = 16;

function alignMemory(size) {
  return Math.ceil(size / memoryAlignment) * memoryAlignment;
}

const memory = new WebAssembly.Memory({
  initial: numMemoryPages,
  maximum: numMemoryPages
});

const memViews = {
  uint8: new Uint8Array(memory.buffer),
  uint32: new Uint32Array(memory.buffer)
};

const numStackPages = 80;
const totalStackMemory = numStackPages * wasmPageSize;

const staticBase = 1024;
const staticBump = 91344;

let staticTop = staticBase + staticBump;
const tempDoublePtr = staticTop;
staticTop += memoryAlignment;

const _stdin = staticTop;
staticTop += memoryAlignment;

const _stdout = staticTop;
staticTop += memoryAlignment;

const _stderr = staticTop;
staticTop += memoryAlignment;

const DYNAMICTOP_PTR = staticTop;
staticTop = alignMemory(staticTop + ptrSize);

const STACKTOP = staticTop;
const STACK_MAX = STACKTOP + totalStackMemory;

const dynamicBase = alignMemory(STACK_MAX);

memViews.uint32[DYNAMICTOP_PTR >> 2] = dynamicBase;

let tempRet0 = 0;
const errNoObj = {};

const envImports = {
  setTempRet0(value) {
    tempRet0 = value;
  },

  abortStackOverflow(allocSize) {
    throw new Error("stack overflow");
  },

  abortOnCannotGrowMemory() {
    throw new Error("cannot grow memory");
  },

  enlargeMemory() {
    throw new Error("cannot enlarge memory");
  },

  getTotalMemory() {
    return totalMemory;
  },

  STACKTOP: new WebAssembly.Global({ value: "i32" }, STACKTOP),
  STACK_MAX: new WebAssembly.Global({ value: "i32" }, STACK_MAX),
  DYNAMICTOP_PTR: new WebAssembly.Global({ value: "i32" }, DYNAMICTOP_PTR),
  tempDoublePtr: new WebAssembly.Global({ value: "i32" }, tempDoublePtr),

  ___lock() {},
  ___unlock() {},

  ___setErrNo(value) {
    const { getLoc } = errNoObj;
    if (getLoc != null) memViews.uint32[getLoc() >> 2] = value;
    else console.warn("can't set errno", value);
    return value;
  },

  abort() {
    throw new Error("abort");
  },

  _abort() {
    throw new Error("abort");
  },

  _emscripten_memcpy_big(dest, src, num) {
    memViews.uint8.set(memViews.uint8.subarray(src, src + num), dest);
    return dest;
  },

  _raise(sig) {
    ___setErrNo(38); // ENOSYS
    console.warn("raise() unsupported; calling stub instead");
    return -1;
  },

  __memory_base: new WebAssembly.Global({ value: "i32" }, 1024),
  __table_base: new WebAssembly.Global({ value: "i32" }, 0),
  memory,

  table: new WebAssembly.Table({
    element: "anyfunc",
    initial: 70,
    maximum: 70
  })
};

["ii", "iii", "iiii", "iiiii", "jj", "vi", "vii", "viii", "viiiiii"].forEach(
  sig => {
    const name = `nullFunc_${sig}`;
    envImports[name] = {
      [name](x) {
        throw new Error(
          `Invalid function pointer called with signature '${sig}'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this): ${x}`
        );
      }
    }[name];
  }
);

syscallNames = {
  6: "close",
  54: "ioctl",
  140: "llseek",
  145: "readv",
  146: "writev"
};
[6, 54, 140, 145, 146].forEach(n => {
  const name = `___syscall${n}`;
  const altName = syscallNames[n];
  envImports[name] = {
    [altName](x) {
      throw new Error(`syscall ${n} (${altName}) not supported yet`);
    }
  }[altName];
});

module.exports = {
  importObj: { global: globalImports, env: envImports, errNoObj },
  errNoObj
};

},{}]},{},[1]);
