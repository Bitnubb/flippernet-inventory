/**
 * FLIPPERNET mirror clock. No Sheets/Drive access and no public web app.
 * Only dispatches the existing validated GitHub mirror workflow.
 * Store a fine-grained, single-repo Actions:write token as GITHUB_ACTIONS_TOKEN
 * in Project Settings > Script properties. Never put a token in source.
 */
function dispatchMirror() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('GITHUB_ACTIONS_TOKEN');
    if (!token || !token.trim()) throw new Error('Set GITHUB_ACTIONS_TOKEN in private Script properties before installing the clock.');
    const url = 'https://api.github.com/repos/Bitnubb/flippernet-inventory/actions/workflows/mirror.yml/dispatches';
    let response;
    try {
      response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: 'Bearer ' + token.trim(),
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        payload: JSON.stringify({ref: 'main'}),
        muteHttpExceptions: true,
        followRedirects: false
      });
    } catch (_) {
      throw new Error('GitHub dispatch request failed. No credential or response content logged.');
    }
    const status = response.getResponseCode();
    if (status !== 204) throw new Error('GitHub dispatch HTTP ' + status + '. Check token expiry and single-repo Actions:write permission.');
    const time = new Date().toISOString();
    props.setProperty('LAST_DISPATCH_AT', time);
    console.log('Mirror workflow dispatch accepted at ' + time + '; verify status.json for actual completion.');
  } finally {
    lock.releaseLock();
  }
}

function installScheduler() {
  // A successful dispatch verifies the credential before a recurring trigger is installed.
  dispatchMirror();
  const existing = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'dispatchMirror');
  if (!existing.length) ScriptApp.newTrigger('dispatchMirror').timeBased().everyMinutes(5).create();
  console.log('Five-minute mirror clock installed; existing matching triggers were preserved.');
}
