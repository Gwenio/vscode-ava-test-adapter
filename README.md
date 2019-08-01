# AVA Test Adapter for Visual Studio Code

Implements an AVA Test Adapter for VSCode [Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer).

---

## Getting Started

- Install the extension
- Restart VS Code and open the Test view
- Run / Debug your tests using  Test Explorer or the CodeLenses in your test file.

## Features

- Shows a Test Explorer in the Test sidebar with all detected tests and suites and their state
- Shows a failed test's log when the test is selected in the explorer
- Lets you choose test suites or individual tests in the explorer that should be rerun on file change

## Configuration Options

| Property                        | Description                                                        | Default                                |
| ------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| `avaExplorer.cwd`               | The working directory for AVA relative to the workspace.           | The workspace folder.                  |
| `avaExplorer.config`            | The location of the AVA config file, relative to `avaExplorer.cwd` | `"ava.config.js"`                      |
| `avaExplorer.env`               | Environment variables to be set when running the tests             |
| `avaExplorer.nodePath`          | The path to the Node executable to use.                            | Searches PATH or VSCode's installation |
| `avaExplorer.nodeArgv`          | The arguments to the Node executable                               |
| `avaExplorer.debuggerPort`      | The port for running the debug sessions                            | 9229                                   |
| `avaExplorer.breakOnFirstLine`  | If `true` injects a breakpoint at the first line of your test      | `false`                                |
| `avaExplorer.debuggerSkipFiles` | An array of glob patterns for files to skip when debugging         | `[]`                                   |
| `avaExplorer.debuggerConfig`    | Name of a launch configuration to debug tests.                     |
| `avaExplorer.logpanel`          | If `true` writes a diagnostic log to AVA Explorer Log              | `false`                                |
| `avaExplorer.logfile`           | A file to write diagnostics to                                     | `null`                                 |

Notes:

- `avaExplorer.config` can be 'package.json' if your AVA configurations are stored there.
- `avaExplorer.logpanel` and `avaExplorer.logfile` are for troubleshooting the plugin.

## Developers

- Adam Armstrong

## License

The project's code is under the ISC license, see the LICENSE file for details.

It is also included in files along side the source code.
