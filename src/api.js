export class State {
  constructor(host, debug) {
    this.intervalId = null;
    this.attemptId = null;
    this.host = host || "parsecgaming.com";
    this.debug = debug || false;
  }

  _log(...args) {
    if (this.debug) {
      console.log(...args);
    }
  }

  async _updateConnection(code) {
    const isExit = code !== null,
          stateStr = isExit ? "LSC_EXIT" :"LSC_EVENTLOOP",
          attemptId = this.attemptId,
          data = {
            "attempt_id": attemptId,
            "state_str": stateStr,
            "platform": "browser"};
    if (isExit) {
      data['exit_code'] = code;
    }
    if (!attemptId) {
      this._log("no attempt id set");
      return;
    }

    this._log(`${isExit ? "exit" : "updating"} connection`);

    return fetch(`https://${this.host}/v1/state/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(data)})
    .then((resp) => resp.json())
    .catch((err) => {
      this._log("error when heartbeating connection", err);
    });
  }

  _clear() {
    if (this.intervalId) {
      this._log("clearing existing interval");
      clearInterval(this.intervalId);
    }
    this.intervalId = null;
  }

  start(attemptId) {
    const INTERVAL = 60 * 1000;
    this._log("starting connection update");
    this._clear();
    this.attemptId = attemptId;
    this.intervalId = setInterval(() => {
      this._updateConnection(null); }, INTERVAL);
  }

  close(code) {
    this._log("closing connection update with", code);
    this._updateConnection(code);
    this._clear();
  }
}
