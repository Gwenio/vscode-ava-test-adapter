# AVA Test Adapter for Visual Studio Code

Implements an AVA Test Adapter for VSCode [Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer).

[![Build Status](https://elafris.visualstudio.com/vscode-ava-test-adapter/_apis/build/status/Gwenio.vscode-ava-test-adapter?branchName=master)](https://elafris.visualstudio.com/vscode-ava-test-adapter/_build/latest?definitionId=1&branchName=master)

---

## Getting Started

- Install the extension
- Restart VS Code and open the Test view
- Run / Debug your tests using  Test Explorer

The extension is intended to use the same AVA installation as the project.
If it cannot find AVA, install it locally for the project(s).

## Features

- Shows a Test Explorer in the Test sidebar with all detected tests and suites and their state
- Shows a failed test's log when the test is selected in the explorer
- Lets you choose test suites or individual tests in the explorer that should be rerun on file change
- Debug your tests easily from the Test Explorer sidebar.

## Limitations

- Still in early development.
- Does not collect details on why a test failed, yet.
- Does not display log or console output from tests, yet.
- AVA does not provide the location of tests for the Test Explorer CodeLens.

In order to avoid having AVA preprocess test files frequently, it is recommended
that caching be enabled in your AVA configuration.

## Configuration Options

| Property                        | Description                                                             | Default                                |
| ------------------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `avaExplorer.cwd`               | The working directory for AVA relative to the workspace.                | The workspace folder.                  |
| `avaExplorer.configs`           | Array of configurations, see [Sub-Configurations](#sub-configurations). | `[{}]`                                 |
| `avaExplorer.env`               | Environment variables for the background worker.                        | `{}`                                   |
| `avaExplorer.nodePath`          | The path to the Node executable to use.                                 | Searches PATH or VSCode's installation |
| `avaExplorer.nodeArgv`          | The arguments to the Node executable                                    |
| `avaExplorer.debuggerPort`      | The port for running the debug sessions                                 | 9229                                   |
| `avaExplorer.debuggerSkipFiles` | An array of glob patterns for files to skip when debugging              | `[]`                                   |
| `avaExplorer.logpanel`          | If `true` writes a diagnostic log to AVA Explorer Log                   | `false`                                |
| `avaExplorer.logfile`           | A file to write diagnostics to                                          | `null`                                 |

### Sub-Configurations

| Property            | Description                                                | Default |
| ------------------- | ---------------------------------------------------------- | ------- |
| `file`              | The configuration file relative to `avaExplorer.cwd`.      | `null`  |
| `serial`            | If `true` then test will be run serially.                  | `false` |
| `debuggerSkipFiles` | An array of glob patterns for files to skip when debugging | `[]`    |

### Configuration Notes

- `avaExplorer.cwd` should contain the projects local Node modules.
- AVA will expect `avaExplorer.cwd` to contain the project's 'package.json'.
- The config `file` will default to 'ava.config.js' if such a file exist in `avaExplorer.cwd`.
- `avaExplorer.configs` can currently only have one configuration.
- `avaExplorer.env` will be the base environment for tests if not overwritten in their config file.
- `avaExplorer.debuggerSkipFiles` is prepended to the configuration specific `debuggerSkipFiles`.
- `avaExplorer.logpanel` and `avaExplorer.logfile` are for troubleshooting the plugin.

## TypeScript Support

It is recommended that TS files be precompiled or the AVA configuration setup
to use 'ts-node' to compile them.

[See how in the AVA documentation.](https://github.com/avajs/ava/blob/master/docs/recipes/typescript.md)

You can also install 'ts-node' and set `avaExplorer.nodeArgv` to `["-r", "ts-node/register"]`.
This will register 'ts-node' with the Node interpreter before running the tests.

## Developers

- Adam Armstrong

## License

The project's code is under the ISC license, see the LICENSE file for details.

It is also included in files along side the source code.
