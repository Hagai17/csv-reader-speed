// A fast reader for broken CSV, written for the csv-reader-speed-01 contest. run(input) answers exactly what the
// reference reader answers for {text, header} — {columns, rows, errors} under the same broken-row policy — but it
// reads the text in runs instead of character by character:
//
//   - a whole record whose line holds no quote and no stray CR is cut into fields by the native split;
//   - plain fields are located with a tight delimiter scan and sliced out of the input;
//   - quoted fields are located with indexOf and, when their body is plain, sliced out whole;
//   - only the genuinely tangled spots (a stray CR inside a field, doubled quotes, CRs inside quotes, junk after
//     a closing quote, a quote that never closes) fall back to a part-by-part rebuild.
//
// No dependencies, no state kept between calls.

// How a field ended.
const COMMA = 1;
const BREAK = 2;
const EOF = 3;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // next unread index
  let line = 1; // the line that index is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1; // a leading BOM is dropped

  // The record under construction: the line it starts on and the index it takes in rows (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // Scratch results of the field scanners below: how the field ended, and how many characters the last plain
  // scan actually kept (dropped stray CRs do not count).
  let ended = EOF;
  let kept = 0;

  function fail(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Pads or cuts a finished record to the first record's width and files it (or, for the first record, sets the
  // width and, on a header run, the columns).
  function finish(fields) {
    if (width < 0) {
      width = fields.length;
      if (header) {
        columns = fields;
        return;
      }
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  // Reads a plain run starting at pos, on top of `prefix` ("" normally, the quoted part for quote junk, a
  // literal '"' after a quote that never closes). Sets ended and kept, advances pos and line.
  function scanPlain(prefix) {
    const start = pos;
    let i = pos;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c > 44) {
        i += 1; // the bulk of field text: letters, digits and most punctuation sit above ','
        continue;
      }
      if (c === 44) {
        kept = i - start;
        pos = i + 1;
        ended = COMMA;
        return prefix + text.slice(start, i);
      }
      if (c === 10) {
        kept = i - start;
        pos = i + 1;
        line += 1;
        ended = BREAK;
        return prefix + text.slice(start, i);
      }
      if (c === 13) {
        if (text.charCodeAt(i + 1) === 10) {
          kept = i - start;
          pos = i + 2;
          line += 1;
          ended = BREAK;
          return prefix + text.slice(start, i);
        }
        return scanPlainTangled(start, prefix); // a stray CR: dropped, and the field rebuilt around it
      }
      i += 1; // spaces, quotes and the rest below ',' are literal here
    }
    kept = n - start;
    pos = n;
    ended = EOF;
    return prefix + text.slice(start, n);
  }

  // The slow half of a plain scan, entered when a stray CR turns up: rebuilds the field from slices between the
  // characters that matter, dropping each lone CR with its error.
  function scanPlainTangled(start, prefix) {
    const parts = prefix === '' ? [] : [prefix];
    let seg = start;
    let i = start;
    let count = 0;
    for (;;) {
      if (i >= n) {
        parts.push(text.slice(seg, n));
        kept = count + (n - seg);
        pos = n;
        ended = EOF;
        return parts.join('');
      }
      const c = text.charCodeAt(i);
      if (c === 44 || c === 10 || (c === 13 && text.charCodeAt(i + 1) === 10)) {
        parts.push(text.slice(seg, i));
        kept = count + (i - seg);
        if (c === 44) {
          pos = i + 1;
          ended = COMMA;
        } else {
          pos = i + (c === 10 ? 1 : 2);
          line += 1;
          ended = BREAK;
        }
        return parts.join('');
      }
      if (c === 13) {
        fail('stray_cr');
        parts.push(text.slice(seg, i));
        count += i - seg;
        i += 1;
        seg = i;
        continue;
      }
      i += 1;
    }
  }

  // What follows a closing quote: a delimiter ends the field at once; anything else is junk appended as it
  // stands, read as a plain run over the quoted part, and reported when it keeps at least one character.
  function afterClose(value) {
    if (pos >= n) {
      ended = EOF;
      return value;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      ended = COMMA;
      return value;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      ended = BREAK;
      return value;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      ended = BREAK;
      return value;
    }
    const joined = scanPlain(value);
    if (kept > 0) fail('quote_junk');
    return joined;
  }

  // Rebuilds a quoted field whose body cannot be sliced out whole (doubled quotes or CRs inside), starting just
  // after the opening quote at `open`. A closing quote is known to exist. Leaves pos just past it.
  function quotedTangled(open) {
    const parts = [];
    let seg = open + 1;
    let i = open + 1;
    for (;;) {
      const c = text.charCodeAt(i);
      if (c === 34) {
        if (text.charCodeAt(i + 1) === 34) {
          parts.push(text.slice(seg, i), '"');
          i += 2;
          seg = i;
          continue;
        }
        parts.push(text.slice(seg, i));
        pos = i + 1;
        return parts.join('');
      }
      if (c === 13) {
        // CRLF and a lone CR inside quotes are each read as one LF.
        parts.push(text.slice(seg, i), '\n');
        line += 1;
        i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
        seg = i;
        continue;
      }
      if (c === 10) line += 1;
      i += 1;
    }
  }

  // Reads a field whose first character (at pos) is a quote.
  function scanQuoted() {
    const open = pos;
    const openLine = line;
    // The closing quote is the first quote not followed by another; indexOf finds the candidates.
    let scan = open + 1;
    let close = -1;
    let doubled = false;
    for (;;) {
      const q = text.indexOf('"', scan);
      if (q === -1) break;
      if (text.charCodeAt(q + 1) === 34) {
        doubled = true;
        scan = q + 2;
        continue;
      }
      close = q;
      break;
    }
    if (close === -1) {
      // The quote never closes: it is a literal character, the line count rewinds to its line, and the rest of
      // the field is read again as a plain one.
      pos = open + 1;
      line = openLine;
      fail('unterminated_quote');
      return scanPlain('"');
    }
    if (!doubled) {
      // Slice the body out whole unless a CR hides in it. An LF inside changes the line count, which the
      // bounded searches notice first; only a body that truly spans lines pays for a counting pass.
      const body = text.slice(open + 1, close);
      if (body.indexOf('\r') === -1) {
        if (body.indexOf('\n') !== -1) {
          let lfs = 0;
          for (let i = 0; i < body.length; i += 1) if (body.charCodeAt(i) === 10) lfs += 1;
          line += lfs;
        }
        pos = close + 1;
        return afterClose(body);
      }
    }
    return afterClose(quotedTangled(open));
  }

  while (pos < n) {
    // A line with no characters is no record.
    const c0 = text.charCodeAt(pos);
    if (c0 === 10) {
      pos += 1;
      line += 1;
      continue;
    }
    if (c0 === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      continue;
    }

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Whole-record fast lane: when the rest of the line holds no quote and no CR but the one a CRLF ends with,
    // nothing in it can be quoted, span lines or stray, so the native split cuts exactly the fields the general
    // path would.
    let segEnd = text.indexOf('\n', pos);
    const hasLF = segEnd !== -1;
    if (!hasLF) segEnd = n;
    const q = text.indexOf('"', pos);
    if (q === -1 || q >= segEnd) {
      const r = text.indexOf('\r', pos);
      if (r === -1 || r >= segEnd || (hasLF && r === segEnd - 1)) {
        const bodyEnd = hasLF && r === segEnd - 1 ? segEnd - 1 : segEnd;
        finish(text.slice(pos, bodyEnd).split(','));
        pos = hasLF ? segEnd + 1 : n;
        line += 1;
        continue;
      }
    }

    // General path: field by field.
    const fields = [];
    let lastQuoted = false;
    for (;;) {
      let value;
      if (text.charCodeAt(pos) === 34) {
        lastQuoted = true;
        value = scanQuoted();
      } else {
        lastQuoted = false;
        // The plain scan, inlined: the same walk scanPlain makes with an empty prefix.
        const start = pos;
        let i = pos;
        let done = false;
        while (i < n) {
          const c = text.charCodeAt(i);
          if (c > 44) {
            i += 1;
            continue;
          }
          if (c === 44) {
            value = text.slice(start, i);
            pos = i + 1;
            ended = COMMA;
            done = true;
            break;
          }
          if (c === 10) {
            value = text.slice(start, i);
            pos = i + 1;
            line += 1;
            ended = BREAK;
            done = true;
            break;
          }
          if (c === 13) {
            if (text.charCodeAt(i + 1) === 10) {
              value = text.slice(start, i);
              pos = i + 2;
              line += 1;
              ended = BREAK;
            } else {
              value = scanPlainTangled(start, '');
            }
            done = true;
            break;
          }
          i += 1;
        }
        if (!done) {
          value = text.slice(start, n);
          pos = n;
          ended = EOF;
        }
      }
      fields.push(value);
      if (ended !== COMMA) break;
    }

    // A line that held only stray CRs leaves a single empty plain field: no record (its errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    finish(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
