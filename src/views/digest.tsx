import type { NightDigest } from '../digest/types.js';

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class={digest.badLines > 0 ? 'warn' : 'mute'}>bad lines: {digest.badLines}</p>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">job</th><th scope="col">owner</th><th scope="col">runs</th>
                <th scope="col">retries</th><th scope="col">last status</th><th scope="col">last error</th>
                <th scope="col">first at</th><th scope="col">last at</th>
              </tr>
            </thead>
            <tbody>
              {[...digest.rows].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0).map((row) => (
                <tr>
                  <td>{row.job}</td><td>{row.owner ?? '—'}</td><td>{row.runs}</td>
                  <td>{row.retries >= 3 ? <span class="warn">{row.retries} · high retries</span> : row.retries}</td>
                  <td>{row.lastStatus === 'fail' ? <span class="warn">fail</span> : row.lastStatus}</td>
                  <td>{row.lastError ?? '—'}</td><td>{row.firstAt}</td><td>{row.lastAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
