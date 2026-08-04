# Repository assets

Six files in this repository have nothing to do with the HTTP service. They are
deliberate multi-format fixtures, and mistaking them for abandoned clutter is
the likeliest way to damage this repository. This page is the
**owning document for fixture provenance** across the documentation corpus: it
inventories the ten files the repository consisted of before this documentation
pass, records the properties that were verified on disk for each, and states the
policy that keeps the six fixtures untouched. Every other page links here rather
than restating any of it.

Source files this page derives from, and the complete file universe it
describes: `LoginTest.java`, `industry.csv`, `test.txt.txt`, `sample.doc`,
`demo.jpg`, `100Pages.pdf`, `server.js`, `package.json`, `package-lock.json`
and `README.md`.

## Why this repository contains non-application files

The service is 14 lines of Node.js that answers every ordinary request reaching
its *request listener* with the same status, the same content type and the same
14-byte greeting; the exceptions Node handles itself, and the framing that
varies per request, are owned by
[api/http-api.md](api/http-api.md). The repository around it is considerably
more varied, and that is on purpose. Its stated identity is
`hao-backprop-test`, a "test project for backprop integration" — the tagline
carried by lines 1 and 2 of the **pre-documentation** `README.md`, the
two-line placeholder this documentation pass replaced (repository baseline
commit `5b4acbb`; the current `README.md:L2` is blank, so that text is no
longer readable at those lines). It exists to be *processed* by tooling, not to
be shipped as a product.

Tooling that walks a repository has to cope with far more than one language and
one encoding: text and binary, tiny and enormous, well-formed and deliberately
malformed, LF and CRLF, populated and empty. The cheapest way to exercise all of
that is to keep a small spread of real files committed next to the application.
The six fixtures are that spread, and between them they cover:

- a **compiled-language source file** that does not compile — `LoginTest.java`
- a **delimited data file** with a header row and no identifiers —
  `industry.csv`
- an **empty text file**, with a doubled extension — `test.txt.txt`
- **three binary formats** at three orders of magnitude — `sample.doc`,
  `demo.jpg` and `100Pages.pdf`

Each fixture's oddity *is* the fixture. An empty file, a file that fails to
compile, and a 9.5 MB binary are all awkward inputs, and awkward inputs are
exactly what a repository-walking tool needs to be tested against. Repairing or
removing any of them would delete the property that made it worth committing —
which is why the [preservation policy](#preservation-policy) below is stated in
absolute terms rather than as a preference.

## Complete repository inventory

The table below is the **pre-documentation baseline**: the ten files that made
up this repository before this documentation pass began, with the byte size and
content-line count each had at that point. It is recorded at that baseline
because that is the state in which the "why is there a PDF in a Node project?"
question arises, and because it is the last point at which every one of the ten
files can be quoted from a single verified snapshot.

| File | Bytes | Content lines | Role |
| --- | --- | --- | --- |
| `100Pages.pdf` | 9,456,545 | binary | Fixture — PDF format, and the largest file in the repository |
| `demo.jpg` | 2,123,398 | binary | Fixture — image format, at a size where streaming versus buffering matters |
| `sample.doc` | 98,304 | binary | Fixture — legacy binary DOC format |
| `industry.csv` | 749 | 44 | Fixture — delimited data, 1 header row plus 43 category labels |
| `server.js` | 342 | 14 | **The application.** The only JavaScript module. Read [architecture/code-walkthrough.md](architecture/code-walkthrough.md) for the annotated line-by-line reading, and [api/server-module.md](api/server-module.md) for the code-level reference |
| `package.json` | 251 | 11 | npm manifest |
| `package-lock.json` | 247 | 13 | Lockfile, `lockfileVersion: 3`, zero dependency entries |
| `LoginTest.java` | 128 | 12 | Fixture — Java source that does not compile, on purpose |
| `README.md` | 73 | 2 (before the rewrite) | The only markdown file in the repository at the baseline |
| `test.txt.txt` | 0 | 0 | Fixture — empty plain text |

Sizes were read with `stat -c '%s' <file>` and line counts with `wc -l <file>`,
both read-only, both on Linux. `stat -c` is the GNU form and is **not**
portable, so the same measurements elsewhere are:

| Platform | Exact byte size of a file |
| --- | --- |
| Linux (GNU coreutils) | `stat -c '%s' <file>` |
| macOS and the BSDs | `stat -f '%z' <file>` |
| Windows PowerShell | `(Get-Item <file>).Length` |
| Any of the three | `node -e "console.log(require('fs').statSync('<file>').size)"` |

Only the Linux row and the Node form were executed for this page; the other two
are given without captured output rather than with invented output. The Node form
was checked against the table above and reports the same bytes, which is worth
knowing because Node is the one program this repository already requires:

```bash
node -e "for (const f of ['sample.doc','demo.jpg','100Pages.pdf']) console.log(require('fs').statSync(f).size, f)"
```

```text
98304 sample.doc
2123398 demo.jpg
9456545 100Pages.pdf
```

Every size in this page is quoted in **exact bytes** precisely so that it does
not depend on which of those commands a reader has. Six of the ten rows are
fixtures and are documented one by one below. The remaining four —
`server.js`, `package.json`, `package-lock.json` and `README.md` — are the
application and its metadata, and this page deliberately stops at naming them.

`server.js` in particular is described here only by its shape: **14 content
lines, being 11 lines of code and 3 blank separators.** What those lines do is
documented twice over elsewhere, and neither account is repeated here:

- [architecture/code-walkthrough.md](architecture/code-walkthrough.md) reads the
  file one line at a time.
- [api/server-module.md](api/server-module.md) documents the seven symbols those
  lines declare.

Restating either would create a second copy to keep in sync, and this page would
be the copy that went stale.

### Reconciling the baseline against the repository today

Four of those ten files grew during this documentation pass, and the numbers
above will therefore not match what `stat` reports now:

| File | Baseline | Why it changed |
| --- | --- | --- |
| `server.js` | 342 bytes, 14 content lines | Gained a JSDoc annotation layer and a comment on every line of code. **All 11 executable statements are byte-identical** — only comments were added |
| `README.md` | 73 bytes, 2 content lines | Rewritten from a two-line placeholder into the canonical overview |
| `package.json` | 251 bytes, 11 content lines | Gained `engines`, a `start` script, the documentation scripts and `devDependencies` |
| `package-lock.json` | 247 bytes, 13 content lines | Regenerated once `devDependencies` existed |

**All six fixtures are byte-for-byte unchanged**, at the sizes given above. That
is the point of the preservation policy, and it is the one row-set in the
inventory that is guaranteed to still match a fresh `stat` today.

Line-number citations for `server.js` throughout this corpus — `server.js:L7`
and the like — refer to the original 14-line layout, not to physical line
numbers in the annotated file. The annotations shifted the physical lines; the
citation scheme deliberately did not follow them.

## LoginTest.java

A 128-byte Java source file: 12 content lines, declaring package
`com.blitzyTest` and a `public class LoginTest` whose `main` method body is the
single bare identifier `Web`. Source: `LoginTest.java:L1-L12`.

| Line | Content |
| --- | --- |
| L1 | `package com.blitzyTest;` |
| L2 | blank |
| L3 | `public class LoginTest {` |
| L4 | blank |
| L5 | `public static void main(String[] args) {` — tab-indented |
| L6 | blank |
| L7 | `Web` — a bare, unresolved identifier, **with no terminating semicolon** |
| L8, L9 | whitespace only (two tabs each) |
| L10 | `}` closing `main` |
| L11 | blank |
| L12 | `}` closing the class |

**It will not compile, and that is intentional.** It is not a bug awaiting a
fix, not a placeholder someone forgot to finish, and not evidence of a truncated
commit. Two independent defects put it beyond `javac`: `Web` resolves to
nothing — there is no import that would define it, no class of that name
anywhere in the repository, and no build configuration that could supply one —
and the statement has no semicolon, so it does not parse either. Source:
`LoginTest.java:L7`.

Three practical consequences follow:

- **Nothing in this repository compiles it.** There is no `pom.xml`, no
  `build.gradle`, no `javac` invocation in any script, and no CI configuration
  of any kind. No documented workflow builds Java, so the file's
  non-compilability is never reached, let alone a problem.
- **The JavaScript toolchain does not read it.** JSDoc is scoped to `server.js`
  alone by `jsdoc.json`, so the Java file is invisible to `npm run docs:api`.
- **Do not "fix" it.** A version that compiled would no longer be a fixture for
  non-compilable input, which is the only reason it is here.

It carries one further verified property worth recording, because it is easy to
destroy by accident: `LoginTest.java` uses **CRLF line terminators**, and it is
the only file in the repository that does — every other text file uses bare LF.
`file` reports it as `Java source, ASCII text, with CRLF line terminators`. A
well-meaning editor that normalises line endings on save would rewrite all 12
lines and change the file's bytes without changing a character of its visible
content.

## industry.csv

A 749-byte single-column data file of 44 content lines: one header row holding
the column name `Industry`, then 43 industry category labels. Source:
`industry.csv:L1` for the header, `industry.csv:L2-L44` for the labels. The
first label is `Accounting/Finance` and the last is `Other`:

```text
Industry
Accounting/Finance
Advertising/Public Relations
Aerospace/Aviation
...
Transportation/Logistics
Other
```

Two properties matter if anything ever consumes it.

**The values are display labels, not identifiers.** The file is a single column
and nothing else — verified by it containing zero comma characters across all 44
lines — so there is no numeric ID, no stable key, and no version marker to join
on. Any consumer that needs stable identity for these categories has to maintain
its own label-to-ID mapping, and accept that the mapping breaks silently the
first time a label is reworded. Joining on these values means joining on display
text.

**Twenty-one of the 44 lines contain a forward slash** — roughly half the
labels, not all of them. `Accounting/Finance` and `Transportation/Logistics` are
each one single value that happens to contain a `/`, not two values, so
splitting a row on anything but the comma delimiter shears a label in half. The
last label, `Other`, carries no slash at all.

Nothing in the service reads this file. `server.js` opens no file at all — every
request gets the same catch-all response — so `industry.csv` is input for
tooling that wants some data to work on, and nothing more.

## test.txt.txt

**Exactly zero bytes, on purpose.** On Linux, `wc -c` and `stat -c '%s'` both
report `0`, and `file` reports it simply as `empty`. The portable check is the
same one used for every other size on this page —
`node -e "console.log(require('fs').statSync('test.txt.txt').size)"` prints `0`
on any platform.

The emptiness is the fixture. A zero-length file exercises the empty-input path
in anything that reads, parses, hashes or uploads a file — the path that is
easiest to leave untested and quickest to crash. The doubled `.txt.txt`
extension is a second fixture in the same file, and it is **genuine, not a typo
in this documentation**: it exercises naive extension parsing, which tends to
split on the first dot rather than the last.

**Do not prune it, and do not populate it.** An empty file with a duplicated
extension looks exactly like an accident, which is precisely why it is
documented here rather than left to be discovered and tidied away by someone
acting in good faith. Adding so much as a newline would destroy the property it
exists to provide.

## sample.doc, demo.jpg and 100Pages.pdf

Three binary fixtures spanning three formats and three orders of magnitude.
None is text, none is human-readable in a diff, and none is read by the service.

| File | Exact bytes | Decimal | Verified format | Exercises |
| --- | --- | --- | --- | --- |
| `sample.doc` | 98,304 | 98 KB | `Composite Document File V2 Document`, written by Microsoft Word 9.0 | The legacy OLE2 Word container — neither plain text nor a modern zipped format |
| `demo.jpg` | 2,123,398 | 2.1 MB | `JPEG image data, Exif standard`, baseline, 3840x2160 | Image handling at a payload size where streaming versus buffering starts to matter |
| `100Pages.pdf` | 9,456,545 | 9.5 MB | `PDF document, version 1.7` | Multi-page document handling, and the largest single file in the repository |

Formats in the table were identified with `file <name>`, and byte counts with
`stat -c '%s' <name>` — both read-only, both on Linux. `file` is a Unix utility:
it is present on Linux and macOS, and on Windows it is not, so a reader there can
confirm a format from the byte counts and the format names above rather than by
re-running the command. The byte counts themselves are portable through the
`node -e` form given in
[Complete repository inventory](#complete-repository-inventory).

The filename `100Pages.pdf` advertises
its page count, but this documentation does not assert one: the file is a
PDF 1.7 that stores its page objects in compressed object streams, so the count
cannot be confirmed without decompressing it, and an unverified number has no
place here.

### The size convention, and why `du` disagrees

The **Decimal** column above uses decimal units throughout, which is the
convention across this entire corpus:

- 1 KB = 1,000 bytes
- 1 MB = 1,000,000 bytes

So 98,304 bytes is 98 KB, 2,123,398 bytes is 2.1 MB, and 9,456,545 bytes is
9.5 MB. The exact byte counts sit beside them in the table so no rounding is
ever load-bearing.

A reader who checks with `du -h` will see different numbers, and the
documentation is not wrong. `du` is a Unix utility — Linux and macOS have it,
Windows does not — and `du -h` reports **binary** units, 1 KiB = 1,024 bytes and
1 MiB = 1,048,576 bytes, while labelling them `K` and `M`:

```bash
du -h sample.doc demo.jpg 100Pages.pdf
```

That command prints one size per file, tab-separated. Its values are set
side by side with the decimal ones here, because a size matrix belongs in a
table rather than in a transcript:

| File | `du -h` (binary) | This corpus (decimal) | Exact bytes |
| --- | --- | --- | --- |
| `sample.doc` | `96K` | 98 KB | 98,304 |
| `demo.jpg` | `2.1M` | 2.1 MB | 2,123,398 |
| `100Pages.pdf` | `9.1M` | 9.5 MB | 9,456,545 |

The two unit columns describe identical files. `sample.doc` is
98,304 bytes either way: 98.3 thousand bytes, and also exactly 96 KiB. The gap
widens with size, which is why `100Pages.pdf` reads 9.5 MB decimal but 9.1M from
`du`. `demo.jpg` happens to read `2.1` in both conventions — a coincidence at
that magnitude, not a sign that it is the one file the two agree on.

`ls -lh` — Unix again, and again absent on Windows — uses the same binary units
as `du -h` and agrees with it. PowerShell's `Get-ChildItem` sidesteps the whole
question by reporting a raw `Length` in bytes, as does the `node -e` form above.
If a size matters, read the exact byte count with whichever of those your
platform has and compare it against the **Exact bytes** column, which is
unit-free by design.

## Preservation policy

**All six fixtures are preserved exactly as they are.** None may be deleted,
repaired, reformatted, re-encoded, recompressed, populated, renamed, or replaced
— not by a person, not by a linter, and not by an editor's save hook. This is a
hard boundary rather than a preference, and it applies to the whole of each
file: its bytes, its size, its line endings, and its name.

The reason is the same in every case. Each fixture was committed *for* the
property that makes it look broken. The empty file is valuable because it is
empty; the Java file is valuable because it does not compile; the doubled
extension is valuable because it is malformed; the 9.5 MB PDF is valuable
because it is large. Every one of those properties is destroyed by the change a
well-intentioned cleanup would make to it.

| Action | Allowed? |
| --- | --- |
| Read them, or copy them elsewhere for a test | Yes |
| Delete any of them | No |
| Repair `LoginTest.java` so that it compiles | No — non-compilability is the fixture |
| Normalise `LoginTest.java` line endings from CRLF to LF | No — it changes the bytes of all 12 lines |
| Add any content to `test.txt.txt`, including a newline | No — 0 bytes is the fixture |
| Rename `test.txt.txt` to a single extension | No — the doubled extension is the fixture |
| Reformat, re-encode, or add an ID column to `industry.csv` | No |
| Recompress, downscale, or replace the three binary fixtures | No |
| Add any of them to `.gitignore` | No — all six are tracked deliberately, and `git check-ignore` confirms none is currently ignored |

When a tool in this repository trips over one of these files, **the tool's
configuration is what changes, never the fixture.** The repository already
follows that rule three times over: `jsdoc.json` scopes JSDoc to `server.js`
alone, `.markdownlint-cli2.jsonc` scopes linting to markdown, and
`tools/check-links.js` walks only markdown. Each narrows the tool so that the
fixtures are simply out of its path — which is the pattern to copy for any tool
added later.

One consequence is worth stating plainly, because it is the most common reason
someone reaches for the delete key. The three binary fixtures total 11,678,247
bytes of the baseline's 11,680,037 — **99.98% of the repository** — while all
seven text files put together come to 1,790 bytes. Cloning this repository
therefore transfers about 11.7 MB to support an application of 14 lines. That
ratio is expected, not a defect: it is the unavoidable cost of keeping real
binary inputs under version control, and shrinking it would mean deleting the
fixtures.

## See also

- [../README.md](../README.md) — the canonical overview, whose Project structure
  and repository assets section this page expands.
- [README.md](README.md) — the documentation index, which names this page as the
  owner of fixture provenance.
- [architecture/code-walkthrough.md](architecture/code-walkthrough.md) — the
  annotated line-by-line reading of `server.js`, the one file in this inventory
  that *is* the application.
- [api/server-module.md](api/server-module.md) — the code-level reference for
  the seven documented symbols in `server.js`.
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — the documentation conventions, and
  the contribution rule that defers fixture policy to this page.
