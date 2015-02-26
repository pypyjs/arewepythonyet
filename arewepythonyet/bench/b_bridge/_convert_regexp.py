
import re
import sys

# Incude an explanatory header.

print "# This is a pythonized version of the octane 'regexp' benchmark."
print "# It was converted to python via a very hacky series of regexes"
print "# and remains copyright its original authors."
print "#"
print "# The idea here is to benchmark the overhead of using PyPy.js for"
print "# string-heavy operations.  All string objects in the benchmark live"
print "# in the PyPy.js VM, while all the regex objects live in native"
print "# javascript.  This test thus does a *lot* copying of strings out of"
print "# the asm.js heap and into native javascript."

# We'll need a couple of imports.

print ""
print "import js"
print "import time"
print "import math"
print "import random"
print ""

# Hack to allow use of a local variable named "chr".

print "_builtin_chr = chr"

# Hack to make math.floor return an integer.

print "def _int_math_floor(x):"
print "    return int(math.floor(x))"

# Now munge each line according to some hand-crafted, very hacky regexes.

for ln in sys.stdin:
    ln = ln.rstrip()
    # Use python function definition syntax. 
    ln = re.sub(r"function ([a-zA-Z0-9_]+)\((.*)\)\s*{", r"def \1(\2):", ln)
    # Handle mutable global variables.
    if re.match(r"^def [a-zA-Z0-9_]+\(", ln):
        ln += "\n  global regExpBenchmark"
        ln += "\n  global _det_rand_x"
    # Use python var declaration syntax.
    ln = re.sub(r"var ([a-zA-Z_])", r"\1", ln)
    # Use python object creation syntax.
    ln = re.sub(r"new ([a-zA-Z_])", r"\1", ln)
    # Use python looping syntax
    ln = re.sub(r"for \(([a-z]+) = ([a-zA-Z0-9 \+\(\)\.]+); \1 < ([a-zA-Z0-9 \+\(\)\.]+); \1\+\+\) {", r"for \1 in xrange(\2, \3):", ln)
    # Use python conditional syntax
    ln = re.sub(r"if \((.+)\) {", r"if (\1):", ln)
    ln = re.sub(r"if \(([^\)]+)\) ", r"if (\1): ", ln)
    # Use python constants.
    ln = re.sub(r" true,", r" True,", ln)
    ln = re.sub(r" false,", r" False,", ln)
    ln = re.sub(r" null,", r" None,", ln)
    ln = re.sub(r" true;", r" True;", ln)
    ln = re.sub(r" false;", r" False;", ln)
    ln = re.sub(r" null;", r" None;", ln)
    # Use python exceptions.
    ln = re.sub(r"throw Error\(", r"raise Exception(", ln)
    # Rename some stdlib functions to python versions.
    ln = re.sub(r"Math.floor", r"_int_math_floor", ln)
    ln = re.sub(r"Math.random", r"random.random", ln)
    ln = re.sub(r"Date.now\(\)", r"time.time() * 1000", ln)
    ln = re.sub(r"([a-z]+)\.charCodeAt\(([a-z]+)\)", r"ord(\1[\2])", ln)
    # Escape js attribute accesses that are python keywords.
    ln = re.sub(r"re\.exec\(", r"getattr(re, 'exec')(", ln)
    # Carefully replace some js string manipulation with python string ops.
    ln = re.sub(r"String.fromCharCode\(", r"_builtin_chr(", ln)
    ln = re.sub(r"str.length", r"len(str)", ln)
    ln = re.sub(r"str.substring\(([a-zA-Z0-9 \+\(\)]+), ([a-zA-Z0-9 \+\(\)]+)\)", r"str[\1:\2]", ln)
    ln = re.sub(r"sum \+= (.+)\.length;", r"sum += int(\1.length);", ln)
    # Use unicode string literals if we need to on the python side.
    # This is necessary to make \xNN and \uNNNN sequences work correctly.
    match = re.match(r"(\s*[a-zA-Z0-9_]+ = )'(.*(\\u|\\x).*)';$", ln)
    if match:
        ln = match.group(1) + "u'" + match.group(2) + "';"
    # Carefully handle differing behaviour of backslash-escapes between js and python.
    # If the backslash preceeds an unrecognized escape char, python will pass it through
    # as a literal backslash while js will drop it.
    def remove_useless_backslash_escapes(literal):
        # Iterate to deal with overlapping matches.
        old_literal = literal
        literal = re.sub(r"([^\\])\\([^bfnrtv'" + '"' + r"\\Xxu])", r"\1\2", literal)
        while old_literal != literal:
            old_literal = literal
            literal = re.sub(r"([^\\])\\([^bfnrtv'" + '"' + r"\\Xxu])", r"\1\2", literal)
        return literal
    def convert_string_literal(match):
        literal = match.group(1)
        return "= '" + remove_useless_backslash_escapes(literal) + "';"
    ln = re.sub(r"= '(.*)';", convert_string_literal, ln)
    # Convert strings to js strings if we need regex-taking methods.
    def convert_string_literal_method(match):
        literal = match.group(1)
        method = match.group(2)
        if literal.startswith("'") and literal.endswith("'"):
            literal = remove_useless_backslash_escapes(literal)
        return "js.String(" + literal + ")." + method + "("
    ln = re.sub(r"([a-zA-Z0-9\[\]]+)\.(replace)\(", convert_string_literal_method, ln)
    ln = re.sub(r"('[^']*')\.(replace)\(", convert_string_literal_method, ln)
    ln = re.sub(r"([a-zA-Z0-9\[\]]+)\.(split)\(", convert_string_literal_method, ln)
    ln = re.sub(r"('[^']*')\.(split)\(", convert_string_literal_method, ln)
    ln = re.sub(r"([a-zA-Z0-9\[\]]+)\.(match)\(", convert_string_literal_method, ln)
    # Carefully convert some js numbers into python numbers.
    ln = re.sub(r"String.fromCharCode\(", r"chr(", ln)
    ln = re.sub(r"for i in (.*) array\.length", r"for i in \1 int(array.length)", ln)
    ln = re.sub(r"str.substring\(([a-zA-Z0-9 \+\(\)]+), ([a-zA-Z0-9 \+\(\)]+)\)", r"str[\1:\2]", ln)
    # Regex literals get passed to js.eval() so they stay as js objects.
    def convert_regexp_literal(match):
        # This is complicated by handling of nested double-quote chars.
        full = match.group(0)
        head = full.split("/", 1)[0]
        tail = full[-1]
        regex = match.group(1)
        flags = match.group(2)
        expr = head + 'js.eval("/'
        if '"' not in regex:
            expr += regex.encode("string-escape")
        else:
            pieces = regex.split('"')
            pieces = [p.encode("string-escape") for p in pieces]
            expr += '" + \'"\' + "'.join(pieces)
        expr += "/" + flags + '")' + tail
        return expr
    ln = re.sub(r"= /(.*)/([a-z]*);", convert_regexp_literal, ln)
    ln = re.sub(r"Exec\(/(.*)/([a-z]*),", convert_regexp_literal, ln)
    ln = re.sub(r"replace\(/(.*)/([a-z]*),", convert_regexp_literal, ln)
    ln = re.sub(r"split\(/(.*)/([a-z]*)\)", convert_regexp_literal, ln)
    ln = re.sub(r"match\(/(.*)/([a-z]*)\)", convert_regexp_literal, ln)
    # Skip closing braces.
    if ln.strip() == "}":
        ln = ""
    # Hack to accommodate asigning to non-existent list slots.
    ln = re.sub(r"variants = \[ str \];", r"variants = [ str ] * n + [ js.undefined ];", ln)
    # Hack to return 'run' function directly.
    if ln == "  this.run = run;":
        ln = "  return run"
    if ln == "  regExpBenchmark.run();":
        ln = "  regExpBenchmark();"
    # Use python comment syntax.
    # This must be done after converting regex literals as they share syntax.
    ln = re.sub(r"^//", r"#", ln)
    ln = re.sub(r" //", r" #", ln)
    # That should do it!
    print ln
