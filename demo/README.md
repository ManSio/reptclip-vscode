# Demo: bounded grep

A throwaway demonstration of the change in `fix/bounded-grep`. It needs no VS
Code, no build, and no network.

```powershell
git switch demo/bounded-grep
npx tsx demo/grep-timeout.ts
```

Actual output on the machine the change was measured on (Windows, Node 24):

```
REFUSED     1 ms  textbook nested quantifier (refused before running)
         Invalid commands: line 1 (grep "(a+)+" .): pattern "(a+)+" has nested quantifiers, which can freeze the editor
STOPPED  1107 ms  optional item in a repeated group (hangs without the bound)
         pattern "^(.*a){10}$" ran for more than 1000 ms and was stopped; narrow the paths, simplify the pattern, or pa
STOPPED  1006 ms  alternation that repeats (hangs without the bound)
         pattern "^(a|aa)+$" ran for more than 1000 ms and was stopped; narrow the paths, simplify the pattern, or pass
OK          4 ms  a number with an optional dot (linear, must work)  (1 section(s))
OK          3 ms  a URL shape (linear, must work)  (1 section(s))
OK          4 ms  literal search for the same hostile text (-F, no regex)  (1 section(s))

after all cases, a normal search still works: yes
```

What to look at:

1. The first case is refused by the pattern check, before any file is read: the
   textbook `(a+)+` shape.
2. The next two would freeze the extension host on the current `main`; here they
   stop at the bound and return an error instead.
3. The two ordinary patterns that an earlier, wider pattern check refused now
   work.
4. `-F` never builds a regex, so it is unaffected.
5. The last line shows the process is still healthy after two stopped searches.

To see the difference against the current behaviour, run the same script on
`main` — it will hang on the second case and you will have to kill it.

The bound in the extension is 15 seconds (`DEFAULT_GREP_TIMEOUT_MS`); the demo
passes 1 second so it finishes quickly. The value is a parameter, not a
constant, on purpose: it is the number that needs your judgement.
