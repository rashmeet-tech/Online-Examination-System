import { useState, useEffect, useRef } from 'react';
import { schedule, allocate, pageRep, banker } from './utils/osAlgorithms';

let tok = sessionStorage.getItem('os-exam-token') || '';
const api = async (p, o = {}) => {
  let r; try {
    r = await fetch('/api' + p, { ...o, headers: { 'Content-Type': 'application/json', Authorization: tok }, body: o.body && JSON.stringify(o.body) });
  } catch { throw new Error('Cannot reach backend. Is it running on port 5000?'); }
  let d; try { d = await r.json(); } catch { throw new Error('The server returned an unreadable response. Check that the backend is running.'); }
  if (!r.ok) throw new Error(d.error || 'Request failed'); return d;
};
const nums = s => s.trim().split(/[\s,]+/).filter(Boolean).map(Number);
const COL = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#be185d', '#65a30d'];
const Err = ({ m }) => m ? <div className="err">{m}</div> : null;

export default function App() {
  const [u, setU] = useState(null), [tab, setTab] = useState('home'), [checking, setChecking] = useState(Boolean(tok));
  useEffect(() => {
    if (!tok) return;
    api('/me').then(setU).catch(() => { tok = ''; sessionStorage.removeItem('os-exam-token'); })
      .finally(() => setChecking(false));
  }, []);
  if (checking) return <div className="boot"><span className="spinner" /> Restoring your session…</div>;
  if (!u) return <Login onLogin={x => { setU(x); setTab('home'); }} />;
  const admin = u.role === 'admin';
  const tabs = admin ? [['home', 'Dashboard'], ['exams', 'Manage Exams'], ['results', 'Submissions'], ['cpu', 'CPU Scheduling'], ['mem', 'Memory Management'],
    ['page', 'Page Replacement'], ['bank', "Banker's Algorithm"], ['mon', 'Live OS Monitor']] : [['home', 'My Exams'], ['results', 'My Results']];
  return <div className="app"><aside>
    <div className="brand-mark">OS<span>LAB</span></div><p className="side-caption">{admin ? 'CONTROL CENTER' : 'EXAMINATION PORTAL'}</p>
    <div className="profile"><span className="avatar">{u.name.slice(0, 1).toUpperCase()}</span><span><b>{u.name}</b><small>{admin ? 'Administrator' : `Student · ${u.id}`}</small></span></div>
    <nav aria-label="Main navigation">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
    <button className="logout" onClick={() => { tok = ''; sessionStorage.removeItem('os-exam-token'); setU(null); }}>Log out</button></aside>
    <main><div className="topbar"><span>{admin ? 'OS Examination System' : 'Student Portal'}</span><span className="live-pill"><i /> Local demo</span></div>
      {tab === 'home' && (admin ? <AdminHome /> : <StudentHome u={u} />)}
      {tab === 'exams' && <ManageExams />}{tab === 'results' && <Results />}
      {tab === 'cpu' && <Cpu />}{tab === 'mem' && <Mem />}{tab === 'page' && <Paging />}{tab === 'bank' && <Bank />}{tab === 'mon' && <Monitor />}</main></div>;
}

function Login({ onLogin }) {
  const [reg, setReg] = useState(false), [f, setF] = useState({ id: '', name: '', password: '' }), [err, setErr] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return;
    setErr(''); setOk('');
    if (!f.id.trim() || !f.password) return setErr('Enter ID and password');
    if (reg && !f.name.trim()) return setErr('Enter your full name');
    if (reg && f.password.length < 8) return setErr('Use a password with at least 8 characters');
    setBusy(true);
    try {
      if (reg) { await api('/register', { method: 'POST', body: f }); setOk('Account created. You can now sign in.'); setReg(false); setF({ ...f, password: '' }); }
      else { const d = await api('/login', { method: 'POST', body: f }); tok = d.token; sessionStorage.setItem('os-exam-token', tok); onLogin(d.user); }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return <div className="login-shell"><div className="login-brand"><div className="brand-mark">OS<span>LAB</span></div><p>Examinations, managed with clarity.</p></div>
    <div className="login-card"><div className="eyebrow">STUDENT & ADMIN ACCESS</div><h1>{reg ? 'Create student account' : 'Welcome back'}</h1>
    <p className="muted">{reg ? 'Register to access available examinations.' : 'Sign in to continue to your examination workspace.'}</p>
    <label className="field-label" htmlFor="login-id">{reg ? 'Student ID' : 'ID or username'}</label>
    <input id="login-id" autoComplete="username" placeholder={reg ? 'e.g. S106' : 'Enter your ID'} value={f.id} onChange={e => setF({ ...f, id: e.target.value })} />
    {reg && <><label className="field-label" htmlFor="full-name">Full name</label><input id="full-name" autoComplete="name" placeholder="Your name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></>}
    <label className="field-label" htmlFor="login-password">Password</label>
    <input id="login-password" type="password" autoComplete={reg ? 'new-password' : 'current-password'} placeholder={reg ? 'At least 8 characters' : 'Enter your password'} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && go()} />
    <Err m={err} />{ok && <div className="ok">{ok}</div>}
    <button className="btn primary wide" onClick={go} disabled={busy}>{busy ? 'Please wait…' : reg ? 'Create account' : 'Sign in'}</button>
    <button className="text-button" onClick={() => { setReg(!reg); setErr(''); setOk(''); }}>{reg ? 'Back to sign in' : 'New student? Create an account'}</button>
    {!reg && <div className="demo-hint"><b>Demo access</b><span>Admin: admin / admin123</span><span>Student: S101 / student123</span></div>}</div></div>;
}

function StudentHome({ u }) {
  const [ex, setEx] = useState(null), [rs, setRs] = useState([]), [live, setLive] = useState(null), [res, setRes] = useState(null), [err, setErr] = useState('');
  const load = () => { api('/exams').then(setEx).catch(e => setErr(e.message)); api('/results').then(setRs).catch(() => { }); };
  useEffect(load, []);
  const start = async id => { setErr(''); try { setLive(await api('/exams/' + id + '/start', { method: 'POST' })); } catch (e) { setErr(e.message); } };
  if (live) return <Exam ex={live} onDone={r => { setLive(null); setRes(r); load(); }} />;
  if (res) return <ResultView r={res} onBack={() => setRes(null)} />;
  const avg = rs.length ? (rs.reduce((s, r) => s + r.pct, 0) / rs.length).toFixed(1) : 0, best = rs.length ? Math.max(...rs.map(r => r.pct)) : 0;
  return <><h2>Welcome, {u.name}</h2><Err m={err} />
    <div className="grid">{[['Available Exams', ex ? ex.filter(e => !e.done).length : '…'], ['Completed', rs.length], ['Average Score', avg + '%'], ['Best Score', best + '%']]
      .map(([a, b]) => <div className="card stat" key={a}>{a}<b>{b}</b></div>)}</div>
    <div className="card"><h3>Available Examinations</h3>
      {!ex ? 'Loading…' : !ex.length ? 'No exams available yet.' : <table><thead><tr><th>Title</th><th>Subject</th><th>Duration</th><th>Marks</th><th></th></tr></thead><tbody>
        {ex.map(e => <tr key={e.id}><td>{e.title}</td><td>{e.subject}</td><td>{e.duration} min</td><td>{e.total} (pass {e.pass}%)</td>
          <td>{e.done ? 'Completed' : <button className="btn" onClick={() => { if (confirm(`Instructions:\n• Timer: ${e.duration} min, auto-submit at 0\n• One attempt only\nStart now?`)) start(e.id); }}>Start</button>}</td></tr>)}</tbody></table>}</div></>;
}

function Exam({ ex, onDone }) {
  const [i, setI] = useState(0), [ans, setAns] = useState(ex.answers || {}), [rev, setRev] = useState({}), [t, setT] = useState(Number.isInteger(ex.remainingSeconds) ? ex.remainingSeconds : ex.duration * 60), [err, setErr] = useState(''), [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true; setSubmitting(true); setErr('');
    try { onDone(await api('/exams/' + ex.id + '/submit', { method: 'POST', body: { answers: ans } })); }
    catch (e) { setErr(e.message); submittingRef.current = false; setSubmitting(false); }
  };
  const chooseAnswer = (question, value) => {
    const next = { ...ans, [question]: value };
    setAns(next);
    api(`/exams/${ex.id}/answers/${question}`, { method: 'PUT', body: { answer: value } }).catch(e => setErr(e.message));
  };
  const clearAnswer = question => {
    const next = { ...ans }; delete next[question]; setAns(next);
    api(`/exams/${ex.id}/answers/${question}`, { method: 'PUT', body: { answer: null } }).catch(e => setErr(e.message));
  };
  // Real countdown: when it reaches 0 the exam is auto-submitted and evaluated by the server
  useEffect(() => { if (t <= 0) { submit(); return; } const k = setTimeout(() => setT(t - 1), 1000); return () => clearTimeout(k); }, [t]);
  const q = ex.questions[i], mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
  return <div className="card exam-card"><div className="exam-heading"><div><div className="eyebrow">TIMED EXAMINATION</div><h2>{ex.title}</h2></div><div className={'timer' + (t < 60 ? ' urgent' : '')}><span>TIME REMAINING</span>{mm}:{ss}</div></div><Err m={err} />
    <div className="exam-progress"><span>Question {i + 1} of {ex.questions.length}</span><span>{Object.keys(ans).length} answered</span><div><i style={{ width: `${((i + 1) / ex.questions.length) * 100}%` }} /></div></div>
    <section className="question-panel"><div className="question-meta">QUESTION {String(i + 1).padStart(2, '0')} <span>{q.m} {q.m === 1 ? 'mark' : 'marks'}</span></div><h3>{q.q}</h3>
    {q.o.map((o, k) => <label key={k} className={'opt' + (ans[i] === k ? ' sel' : '')}>
      <input type="radio" name={`question-${i}`} checked={ans[i] === k} onChange={() => chooseAnswer(i, k)} disabled={t <= 0 || submitting} /> <span className="choice-letter">{'ABCD'[k]}</span><span>{o}</span></label>)}
    </section>
    <div className="exam-actions">
    <button className="btn secondary" disabled={!i || submitting} onClick={() => setI(i - 1)}>Previous</button>
    <button className="btn secondary" disabled={i === ex.questions.length - 1 || submitting} onClick={() => setI(Math.min(i + 1, ex.questions.length - 1))}>Save &amp; Next</button>
    <button className="btn secondary" disabled={submitting} onClick={() => { const r = { ...rev }; r[i] ? delete r[i] : r[i] = 1; setRev(r); }}>{rev[i] ? 'Unmark review' : 'Mark for review'}</button>
    {ans[i] !== undefined && <button className="btn text-button" disabled={submitting} onClick={() => clearAnswer(i)}>Clear answer</button>}
    </div>
    <h4 className="palette-title">Question palette <small>Green = answered · amber = review</small></h4>
    <div className="pal">{ex.questions.map((_, k) => <button key={k} className={(rev[k] ? 'rev' : ans[k] !== undefined ? 'ans' : '') + (k === i ? ' cur' : '')} onClick={() => setI(k)}>{k + 1}</button>)}</div><br />
    <button className="btn danger" disabled={submitting} onClick={() => { if (confirm(`Answered ${Object.keys(ans).length}/${ex.questions.length}. Submit?`)) submit(); }}>{submitting ? 'Submitting…' : 'Submit examination'}</button></div>;
}

function ResultView({ r, onBack }) {
  const pie = [['Correct', r.correct, '#16a34a'], ['Wrong', r.wrong, '#dc2626'], ['Unattempted', r.unattempted, '#94a3b8']];
  return <div className="card"><h2>EXAM RESULT</h2><h3>{r.exam}</h3>
    <p>Score: <b>{r.score} / {r.total}</b> &nbsp; Percentage: <b>{r.pct}%</b></p>
    <p>Total questions: {r.count} | Attempted: {r.correct + r.wrong} | Correct: {r.correct} | Wrong: {r.wrong} | Unattempted: {r.unattempted}</p>
    <h2 className={r.status === 'PASS' ? 'pass' : 'fail'}>Status: {r.status}</h2>
    <div className="bar">{pie.map(([n, v, c]) => v > 0 && <div key={n} className="seg" style={{ background: c, flex: v }}>{n}: {v}</div>)}</div>
    {onBack && <button className="btn" onClick={onBack}>Back</button>}</div>;
}

function Results() {
  const [rs, setRs] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('/results').then(setRs).catch(e => setErr(e.message)); }, []);
  return <div className="card"><h3>Results / Submissions</h3><Err m={err} />{!rs ? 'Loading…' : !rs.length ? 'No submissions yet.' :
    <table><thead><tr><th>Student</th><th>Exam</th><th>Score</th><th>%</th><th>C/W/U</th><th>Status</th><th>Date</th></tr></thead><tbody>
      {rs.map(r => <tr key={r.id}><td>{r.studentName} ({r.studentId})</td><td>{r.exam}</td><td>{r.score}/{r.total}</td><td>{r.pct}</td>
        <td>{r.correct}/{r.wrong}/{r.unattempted}</td><td className={r.status === 'PASS' ? 'pass' : 'fail'}>{r.status}</td><td>{new Date(r.at).toLocaleString()}</td></tr>)}</tbody></table>}</div>;
}

function AdminHome() {
  const [s, setS] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('/stats').then(setS).catch(e => setErr(e.message)); }, []);
  return <><h2>Admin Dashboard</h2><Err m={err} />{s && <div className="grid">{[['Students', s.students], ['Exams', s.exams], ['Questions', s.questions],
    ['Submissions', s.submissions], ['Average Score', s.avg + '%'], ['Pass %', s.passPct + '%']].map(([a, b]) => <div className="card stat" key={a}>{a}<b>{b}</b></div>)}</div>}
    <Results /></>;
}

function ManageExams() {
  const [list, setList] = useState([]), [f, setF] = useState({ title: '', subject: '', duration: 30, pass: 40 }), [qs, setQs] = useState(''), [err, setErr] = useState(''), [ok, setOk] = useState('');
  const load = () => api('/exams').then(setList).catch(e => setErr(e.message)); useEffect(() => { load(); }, []);
  const create = async () => {
    setErr(''); setOk('');
    if (!f.title.trim()) return setErr('Enter an exam title.');
    if (!Number.isInteger(+f.duration) || +f.duration < 1 || +f.duration > 240) return setErr('Duration must be a whole number from 1 to 240 minutes.');
    if (!Number.isFinite(+f.pass) || +f.pass < 0 || +f.pass > 100) return setErr('Pass mark must be from 0% to 100%.');
    // Format per line: question | A | B | C | D | correct(A-D) | marks
    const lines = qs.split(/\r?\n/).map((text, index) => ({ text, line: index + 1 })).filter(x => x.text.trim());
    if (!lines.length || lines.length > 200) return setErr('Add between 1 and 200 questions.');
    const questions = []; for (const { text, line } of lines) {
      const p = text.split('|').map(x => x.trim()), c = 'ABCD'.indexOf((p[5] || '').toUpperCase()), marks = Number(p[6]);
      if (p.length !== 7 || p.some((value, index) => index < 6 && !value) || c < 0 || !Number.isFinite(marks) || marks <= 0 || marks > 1000)
        return setErr(`Line ${line}: use question | A | B | C | D | correct (A–D) | marks.`);
      if (p[0].length > 500 || p.slice(1, 5).some(value => value.length > 250))
        return setErr(`Line ${line}: keep the question under 500 characters and each option under 250.`);
      questions.push({ q: p[0], o: p.slice(1, 5), a: c, m: marks });
    }
    try { await api('/exams', { method: 'POST', body: { ...f, questions } }); setOk('Exam created'); setQs(''); load(); } catch (e) { setErr(e.message); }
  };
  const remove = async id => {
    if (!confirm('Delete this exam? Exams with submissions or active attempts are protected.')) return;
    setErr(''); setOk('');
    try { await api('/exams/' + id, { method: 'DELETE' }); setOk('Exam deleted.'); load(); }
    catch (e) { setErr(e.message); }
  };
  return <><div className="card"><h3>Create Examination</h3>
    <input placeholder="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /> <input placeholder="Subject" value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} />
    <input type="number" title="Duration (min)" value={f.duration} onChange={e => setF({ ...f, duration: e.target.value })} style={{ width: 80 }} /> min
    <input type="number" title="Pass %" value={f.pass} onChange={e => setF({ ...f, pass: e.target.value })} style={{ width: 80 }} /> pass %
    <p>Questions, one per line: <code>question | A | B | C | D | correct(A-D) | marks</code></p>
    <textarea rows={6} value={qs} onChange={e => setQs(e.target.value)} placeholder="What is a thread? | Lightweight process | A file | A disk | A cable | A | 2" />
    <Err m={err} />{ok && <div className="ok">{ok}</div>}<button className="btn" onClick={create}>Create Exam</button></div>
    <div className="card"><h3>Exams</h3><table><thead><tr><th>Title</th><th>Questions</th><th>Marks</th><th>Duration</th><th></th></tr></thead><tbody>
      {list.map(e => <tr key={e.id}><td>{e.title}</td><td>{e.count}</td><td>{e.total}</td><td>{e.duration}m</td>
        <td><button className="btn danger" onClick={() => remove(e.id)}>Delete</button></td></tr>)}</tbody></table></div></>;
}

function Cpu() {
  const [txt, setTxt] = useState('P1 0 5 2\nP2 1 3 1\nP3 2 4 3'), [algo, setAlgo] = useState('FCFS'), [q, setQ] = useState(2), [out, setOut] = useState(null), [err, setErr] = useState('');
  const run = () => {
    setErr('');
    const ps = txt.split('\n').filter(l => l.trim()).map(l => { const p = l.trim().split(/\s+/); return { id: p[0], at: +p[1], bt: +p[2], pr: +(p[3] ?? 0) }; });
    if (!ps.length || ps.some(x => !Number.isInteger(x.at) || !Number.isInteger(x.bt) || !Number.isInteger(x.pr) || x.bt <= 0 || x.at < 0)) return setErr('Each line: PID Arrival Burst Priority (whole numbers; burst > 0)');
    if (algo === 'RR' && !(q > 0)) return setErr('Quantum must be > 0');
    try { setOut({ main: schedule(ps, algo, +q), all: ['FCFS', 'SJF', 'PRIORITY', 'RR'].map(a => [a, schedule(ps, a, +q).avg]) }); }
    catch (e) { setErr(e.message); }
  };
  return <div className="card"><h3>CPU Scheduling Simulator</h3><p>Enter: PID Arrival Burst Priority (lower number = higher priority)</p>
    <textarea rows={5} value={txt} onChange={e => setTxt(e.target.value)} />
    <select value={algo} onChange={e => setAlgo(e.target.value)}>{['FCFS', 'SJF', 'PRIORITY', 'RR'].map(a => <option key={a}>{a}</option>)}</select>
    {algo === 'RR' && <> Quantum <input type="number" value={q} onChange={e => setQ(e.target.value)} style={{ width: 70 }} /></>}
    <button className="btn" onClick={run}>Run</button><Err m={err} />
    {out && <><h4>Gantt Chart</h4><div className="bar">{out.main.g.map((s, k) => <div key={k} className="seg" style={{ background: COL[+(s.id.replace(/\D/g, '')) % 8], flex: s.e - s.s }}>{s.id}<br />{s.s}–{s.e}</div>)}</div>
      <table><thead><tr><th>PID</th><th>AT</th><th>BT</th><th>CT</th><th>TAT</th><th>WT</th><th>RT</th></tr></thead><tbody>
        {out.main.rows.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.at}</td><td>{r.bt}</td><td>{r.ct}</td><td>{r.tat}</td><td>{r.wt}</td><td>{r.rt}</td></tr>)}</tbody></table>
      <p>Avg Waiting: <b>{out.main.avg.wt}</b> | Avg Turnaround: <b>{out.main.avg.tat}</b> | Avg Response: <b>{out.main.avg.rt}</b></p>
      <h4>Algorithm Comparison</h4><table><thead><tr><th>Algorithm</th><th>Avg WT</th><th>Avg TAT</th><th>Avg RT</th></tr></thead><tbody>
        {out.all.map(([a, v]) => <tr key={a}><td>{a}</td><td>{v.wt}</td><td>{v.tat}</td><td>{v.rt}</td></tr>)}</tbody></table></>}</div>;
}

function Mem() {
  const [bl, setBl] = useState('100 500 200 300 600'), [pr, setPr] = useState('212 417 112 426'), [algo, setAlgo] = useState('FIRST'), [out, setOut] = useState(null), [err, setErr] = useState('');
  const run = () => {
    setErr(''); const b = nums(bl), p = nums(pr);
    if (!b.length || !p.length || [...b, ...p].some(x => !(x > 0))) return setErr('Enter positive numbers for blocks and processes');
    try { setOut(allocate(b, p, algo)); } catch (e) { setErr(e.message); }
  };
  return <div className="card"><h3>Memory Management (Contiguous Allocation)</h3>
    Memory blocks (KB): <input value={bl} onChange={e => setBl(e.target.value)} style={{ width: 280 }} /><br /><br />
    Process sizes (KB): <input value={pr} onChange={e => setPr(e.target.value)} style={{ width: 280 }} /><br /><br />
    <select value={algo} onChange={e => setAlgo(e.target.value)}><option value="FIRST">First Fit</option><option value="BEST">Best Fit</option><option value="WORST">Worst Fit</option></select>
    <button className="btn" onClick={run}>Allocate</button><Err m={err} />
    {out && <><h4>Memory Map</h4><div className="bar" style={{ flexDirection: 'column' }}>{out.blocks.map(b => <div key={b.i} style={{ display: 'flex', margin: '3px 0', alignItems: 'center' }}>
      <span style={{ width: 90 }}>Block {b.i + 1} ({b.size})</span><div style={{ display: 'flex', flex: 1, border: '1px solid #94a3b8', height: 34 }}>
        {b.ps.map(x => <div key={x.id} className="seg" style={{ background: COL[+x.id.slice(1) % 8], flex: x.s, padding: 6 }}>{x.id} ({x.s})</div>)}
        {b.free > 0 && <div style={{ flex: b.free, background: '#e2e8f0', textAlign: 'center', padding: 6, fontSize: 12 }}>Free {b.free}</div>}</div></div>)}</div>
      <table><thead><tr><th>Process</th><th>Size</th><th>Allocated to</th></tr></thead><tbody>{out.res.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.size}</td>
        <td>{r.block ? 'Block ' + r.block : <span className="fail">NOT ALLOCATED (wait)</span>}</td></tr>)}</tbody></table>
      <p>Allocated: <b>{out.allocated} KB</b> | Free: <b>{out.free} KB</b> | Internal fragmentation: <b>{out.internal} KB</b> | External fragmentation: <b>{out.external} KB</b></p></>}</div>;
}

function Paging() {
  const [ref, setRef] = useState('7 0 1 2 0 3 0 4 2 3'), [fr, setFr] = useState(3), [algo, setAlgo] = useState('FIFO'), [out, setOut] = useState(null), [err, setErr] = useState('');
  const run = () => {
    setErr(''); const r = nums(ref);
    if (!r.length || r.some(x => !Number.isInteger(x)) || !Number.isInteger(+fr) || +fr < 1) return setErr('Enter whole-number page IDs and a whole-number frame count >= 1');
    try { setOut({ m: pageRep(r, +fr, algo), all: ['FIFO', 'LRU', 'OPT'].map(a => [a, pageRep(r, +fr, a)]) }); }
    catch (e) { setErr(e.message); }
  };
  return <div className="card"><h3>Page Replacement</h3>Reference string: <input value={ref} onChange={e => setRef(e.target.value)} style={{ width: 300 }} /> Frames:
    <input type="number" value={fr} onChange={e => setFr(e.target.value)} style={{ width: 60 }} />
    <select value={algo} onChange={e => setAlgo(e.target.value)}><option>FIFO</option><option>LRU</option><option value="OPT">Optimal</option></select>
    <button className="btn" onClick={run}>Run</button><Err m={err} />
    {out && <><table><thead><tr><th>Step</th><th>Page</th>{Array.from({ length: +fr }, (_, k) => <th key={k}>Frame {k + 1}</th>)}<th>Hit/Fault</th></tr></thead><tbody>
      {out.m.steps.map((s, k) => <tr key={k}><td>{k + 1}</td><td>{s.pg}</td>{Array.from({ length: +fr }, (_, j) => <td key={j}>{s.frames[j] ?? '-'}</td>)}
        <td className={s.hit ? 'pass' : 'fail'}>{s.hit ? 'Hit' : 'Fault'}</td></tr>)}</tbody></table>
      <p>Faults: <b>{out.m.faults}</b> | Hits: <b>{out.m.hits}</b> | Hit ratio: <b>{out.m.hitRatio}</b> | Fault ratio: <b>{out.m.faultRatio}</b></p>
      <h4>Comparison</h4>{out.all.map(([a, v]) => <div key={a} style={{ margin: '4px 0' }}>{a}: {v.faults} faults<div style={{ background: COL[0], height: 10, width: (v.faults / out.m.steps.length * 100) + '%' }} /></div>)}</>}</div>;
}

function Bank() {
  const [al, setAl] = useState('0 1 0\n2 0 0\n3 0 2\n2 1 1\n0 0 2'), [mx, setMx] = useState('7 5 3\n3 2 2\n9 0 2\n2 2 2\n4 3 3'), [av, setAv] = useState('3 3 2'), [out, setOut] = useState(null), [err, setErr] = useState('');
  const rows = s => s.split('\n').filter(l => l.trim()).map(nums);
  const run = () => {
    setErr(''); const a = rows(al), m = rows(mx), v = nums(av), k = v.length;
    if (!a.length || a.length !== m.length || [...a, ...m].some(r => r.length !== k || r.some(x => isNaN(x) || x < 0)) || v.some(x => isNaN(x) || x < 0)) return setErr('Matrices must have the same rows and each row must have as many columns as the Available vector');
    if (a.some((r, i) => r.some((x, j) => x > m[i][j]))) return setErr('Allocation cannot exceed Maximum');
    try { setOut(banker(a, m, v)); } catch (e) { setErr(e.message); }
  };
  return <div className="card"><h3>Banker's Algorithm (Deadlock Avoidance)</h3>
    <p>Allocation matrix (row per process)</p><textarea rows={5} value={al} onChange={e => setAl(e.target.value)} />
    <p>Maximum matrix</p><textarea rows={5} value={mx} onChange={e => setMx(e.target.value)} />
    <p>Available vector</p><input value={av} onChange={e => setAv(e.target.value)} /><br /><button className="btn" onClick={run}>Check Safety</button><Err m={err} />
    {out && <><h4>Need Matrix (Max − Allocation)</h4><table><tbody>{out.need.map((r, i) => <tr key={i}><td>P{i}</td>{r.map((x, j) => <td key={j}>{x}</td>)}</tr>)}</tbody></table>
      <h4>Safe sequence: {out.safe ? out.seq.join(' → ') : '— none —'}</h4>
      <h2 className={out.safe ? 'pass' : 'fail'}>{out.safe ? 'SYSTEM IS IN SAFE STATE' : 'SYSTEM IS IN UNSAFE STATE'}</h2></>}</div>;
}

// Live monitor: reads the real simulated processes created by exam start/submit
function Monitor() {
  const [ps, setPs] = useState([]), [err, setErr] = useState('');
  useEffect(() => { const f = () => api('/procs').then(setPs).catch(e => setErr(e.message)); f(); const k = setInterval(f, 2000); return () => clearInterval(k); }, []);
  const mem = ps.filter(p => p.state !== 'TERMINATED').reduce((s, p) => s + p.memKB, 0), cnt = s => ps.filter(p => p.state === s).length;
  return <div className="card"><h3>Live OS Monitor (driven by real exam activity)</h3><Err m={err} />
    <div className="grid">{[['Running', cnt('RUNNING')], ['Terminated', cnt('TERMINATED')], ['Memory in use', mem + ' KB'], ['Total processes', ps.length]].map(([a, b]) => <div className="card stat" key={a}>{a}<b>{b}</b></div>)}</div>
    {!ps.length ? 'No processes yet. Log in as a student, start an exam and submit it — processes will appear here.' :
      <table><thead><tr><th>PID</th><th>Name</th><th>State</th><th>Memory</th></tr></thead><tbody>{ps.map(p => <tr key={p.pid}><td>{p.pid}</td><td>{p.name}</td><td>{p.state}</td><td>{p.memKB} KB</td></tr>)}</tbody></table>}</div>;
}
