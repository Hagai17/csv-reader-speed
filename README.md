# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Hagai17/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Hagai17/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A drop-in fast reader for broken CSV. Its `run(input)` in `solve.js` returns exactly the reference csv-reader 1.0.0's answer — `{columns, rows, errors}` under the same broken-row policy (stray CRs dropped, junk after a closing quote appended, a quote that never closes read literally, ragged rows padded or cut with the error recorded) — but it reads the text in runs rather than character by character: a record whose line holds no quote and no stray CR is cut into fields by the native `split`, plain fields are found with a tight delimiter scan and sliced out of the input, quoted fields are located with `indexOf` and sliced out whole when their body is plain, and only the tangled spots (doubled quotes, CRs inside quotes, stray CRs, quote junk, unterminated quotes) are rebuilt part by part. No dependencies.

## Run it

```sh
MAKEFUN_INPUT_DIR=/path/to/input MAKEFUN_OUTPUT_DIR=/path/to/output node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=8pf8m8ra&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
