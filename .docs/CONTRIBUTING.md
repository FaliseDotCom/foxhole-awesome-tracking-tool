# Contributing to F.A.T.T.

Contributions are welcome: bug reports, fixes, new hex geometry, icon updates, and ideas.

## Licence of contributions

F.A.T.T. is released under the [PolyForm Noncommercial License 1.0.0](../LICENSE). By opening
a pull request you agree that:

1. your contribution is your own work, or you have the right to submit it;
2. it is licensed to the project and everyone else under the same PolyForm Noncommercial
   License 1.0.0;
3. the maintainer (Sander Falise) may also release it under other licence terms in future,
   so the project can change licence without tracking down every contributor.

Do not submit Foxhole game assets or other third-party material unless its licence allows it,
and say where it came from.

## Getting started

See the [README](../README.md) for how the project fits together and how to run it. Before
opening a pull request (the deploy only runs the unit tests, so the browser tests are up to
you):

```bash
cd .app
npm run lint
npm test
cd ..
php .api/tests/warlog-diff-test.php
```

Keep pull requests focused on one change and describe what you changed and why.
