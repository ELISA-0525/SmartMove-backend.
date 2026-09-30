import { useEffect, useRef, useState } from 'react';
import { mutate } from '../shared.js';

export const RowActions = ({ onEdit, onDelete }) => (
  <td onClick={(e) => e.stopPropagation()}>
    <div className="acts">
      <button className="btn sm" type="button" onClick={onEdit}>Edit</button>
      <button className="btn sm danger" type="button" onClick={onDelete}>Delete</button>
    </div>
  </td>
);

function Dlg({ onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === ref.current) onClose(); }}>{children}</dialog>;
}

// dlg = { mode: 'edit' | 'delete', row }. fields = [{ name, label, type, options }]
export function CrudDialogs({ dlg, setDlg, res, k, fields, noun, onDone }) {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (!dlg) return null;
  const close = () => { setDlg(null); setErr(''); };
  async function run(method, body) {
    setBusy(true); setErr('');
    try { onDone(await mutate(res, method, dlg.row[k], body, dlg.row.remoteId)); close(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run('PUT', Object.fromEntries(fields.map(({ name, type }) => [name, type === 'number' ? Number(f.get(name)) : String(f.get(name)).trim()])));
  }
  return (
    <Dlg onClose={close}>
      {dlg.mode === 'delete' ? (
        <>
          <h2>Delete {noun}?</h2>
          <p style={{ margin: '8px 0 16px' }}><b>{dlg.row.label}</b> will be removed. This cannot be undone.</p>
          {err && <div className="msg">{err}</div>}
          <div className="tools"><button className="btn danger" type="button" disabled={busy} onClick={() => run('DELETE')}>{busy ? 'Deleting...' : 'Delete'}</button><button className="btn" type="button" onClick={close}>Cancel</button></div>
        </>
      ) : (
        <form onSubmit={save}>
          <h2>Edit {noun}</h2>
          {fields.map(({ name, label, type = 'text', options }) => (
            <label key={name}>{label}
              {options ? <select name={name} defaultValue={dlg.row[name]}>{options.map((o) => <option key={o}>{o}</option>)}</select>
                : <input name={name} type={type} defaultValue={dlg.row[name]} required />}
            </label>
          ))}
          {err && <div className="msg" style={{ marginTop: 12 }}>{err}</div>}
          <div className="tools" style={{ marginTop: 16 }}><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Update'}</button><button className="btn" type="button" onClick={close}>Cancel</button></div>
        </form>
      )}
    </Dlg>
  );
}

export const LocalNote = ({ on, res }) => on && (
  <div className="note">The backend has no <code>PUT/DELETE /api/{res}/:id</code> yet, so changes are saved in this browser only.</div>
);
