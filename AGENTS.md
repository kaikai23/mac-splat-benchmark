# Repository instructions

- When asked to reproduce this experiment on the current Mac, read and execute
  [START_HERE_CODEX.md](START_HERE_CODEX.md). It defines the complete task, reading
  order, commands, recovery rules and acceptance criteria without chat history.
- A request to inspect code, documentation or an existing report does not authorize
  starting measurements. Respect an explicit pause and the user's current scope.
- Preserve the fixed methods, input hashes, camera selection, metrics and protocol.
  Do not update dependencies or substitute historical measurements to make a run pass.
- Keep machine paths, downloads, credentials, logs and results in ignored locations.
  Use a dedicated run/config and retain failed receipts. Never overwrite another run.
- GPU collection, quality inference and heavy setup must run serially. Manage only
  this run's owned processes. Follow the repository recovery instructions for locks.
