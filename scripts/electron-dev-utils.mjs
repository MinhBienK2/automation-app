const ANSI_ESCAPE_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export function isSuccessfulElectronWatchBuild(text) {
  const normalized = stripAnsi(text).replace(/\s+/g, " ").trim();
  return /Found 0 errors?\. Watching for file changes\./i.test(normalized);
}

export function createElectronWatchOutputHandler({
  onInitialReady = () => {},
  onSuccessfulRebuild,
}) {
  let watchReady = false;
  let bufferedOutput = "";

  function handleLine(line) {
    if (!isSuccessfulElectronWatchBuild(line)) return;

    if (watchReady) {
      onSuccessfulRebuild();
      return;
    }

    watchReady = true;
    onInitialReady();
  }

  return {
    handleStdoutChunk(chunk) {
      bufferedOutput += chunk.toString();
      const lines = bufferedOutput.split(/\r?\n/);
      bufferedOutput = lines.pop() ?? "";
      for (const line of lines) {
        handleLine(line);
      }
    },
    flush() {
      if (!bufferedOutput) return;
      handleLine(bufferedOutput);
      bufferedOutput = "";
    },
  };
}

function stripAnsi(text) {
  return text.replace(ANSI_ESCAPE_PATTERN, "");
}
