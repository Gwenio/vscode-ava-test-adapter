# AVA Test Adapter Change Log

---

1. [Version 0](#version-0)
    1. [V0 Release 4, 04-10-2019](#v0-release-4-04-10-2019)
        1. [V0R4 Patch 1, 12-10-2019](#v0r4-patch-1-12-10-2019)
    2. [V0 Release 3, 24-08-2019](#v0-release-3-24-08-2019)
        1. [V0R3 Patch 3, 26-09-2019](#v0r3-patch-3-26-09-2019)
        2. [V0R3 Patch 2, 13-09-2019](#v0r3-patch-2-13-09-2019)
        3. [V0R3 Patch 1, 03-09-2019](#v0r3-patch-1-03-09-2019)
    3. [V0 Release 2, 20-08-2019](#v0-release-2-20-08-2019)
        1. [V0R2 Patch 1, 20-08-2019](#v0r2-patch-1-20-08-2019)
    4. [V0 Release 1, 14-08-2019](#v0-release-1-14-08-2019)
        1. [V0R1 Patch 3, 14-08-2019](#v0r1-patch-3-14-08-2019)
        2. [V0R1 Patch 2, 14-08-2019](#v0r1-patch-2-14-08-2019)
        3. [V0R1 Patch 1, 14-08-2019](#v0r1-patch-1-14-08-2019)

---

## Version 0

### V0 Release 4, 04-10-2019

Fixes:

- Corrected VSCode settings schema.
- Fixed file watcher to properly generate events when a worker is connected.
- Fixed [issue #11](https://github.com/Gwenio/vscode-ava-test-adapter/issues/11).

Features:

- Can now configure the worker timeout.
- The worker process can now be debugged from VSCode.
- Can now set test and debug sessions to occur serially.
  This can help avoid issues in the adapter and prevent running tests that interfere with each other.

#### V0R4 Patch 1, 12-10-2019

Fixes:

- Adresses [issue #13](https://github.com/Gwenio/vscode-ava-test-adapter/issues/13).
- `avaExplorer.serialRuns` now has the proper scope set in the settings schema.

---

### V0 Release 3, 24-08-2019

- Implemented support for multiple AVA configuration files.
- Now properly adjusts to setting changes without needing a reload.
- Supports debugging suites in addition to individual tests.

#### V0R3 Patch 3, 26-09-2019

- Fixed [issue #6](https://github.com/Gwenio/vscode-ava-test-adapter/issues/6).
- Fixed [issue #7](https://github.com/Gwenio/vscode-ava-test-adapter/issues/7).
- Now only reloads settings that are changed instead of all settings.

#### V0R3 Patch 2, 13-09-2019

- Stability improvements.

#### V0R3 Patch 1, 03-09-2019

- Now logs AVA errors to the 'AVA Tests' output channel in VSCode.

---

### V0 Release 2, 20-08-2019

- Combine specialized workers into monolithic worker.
- Worker is persistent instead of spawning per operation.
- Adjusted Rollup configuration for smaller bundles.

#### V0R2 Patch 1, 20-08-2019

- Include veza and binarytf package.json files in '.vsix'.
- Fixed worker being unable to locate veza node module.

---

### V0 Release 1, 14-08-2019

- Initial release.

#### V0R1 Patch 3, 14-08-2019

- Workers now search for node modules relative to `cwd`.
- Workers now spawn successfully.

#### V0R1 Patch 2, 14-08-2019

- Include vscode-test-adapter-api in main Rollup bundle.
- Include vscode-test-adapter-util in main Rollup bundle.
- Fixed plugin not loading.

#### V0R1 Patch 1, 14-08-2019

- Fixed issue preventing configuration loading.
- Remove micromatch dependency.
- Exclude type definitions from '.vsix'.
