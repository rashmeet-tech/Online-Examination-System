// Backend: Express + local JSON storage (db.json) so it runs without MongoDB.
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '128kb' }));

const DB = path.join(__dirname, 'db.json');
const hashPassword = password => crypto.createHash('sha256').update(String(password)).digest('hex');
const save = () => {
  const temporaryFile = `${DB}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(temporaryFile, DB);
};
function seed(){
  const users=[{id:'admin',name:'Admin Teacher',role:'admin',pw:hashPassword('admin123')},
    ...[1,2,3,4,5].map(i=>({id:'S10'+i,name:'Student '+i,role:'student',pw:hashPassword('student123')}))];
  const Q=[['What is a process?','Program in execution','A file on disk','A compiler','A cable',0],
   ['Which scheduling is non-preemptive?','Round Robin','FCFS','SRTF','Multilevel feedback',1],
   ['Which page replacement has the lowest faults?','FIFO','LRU','Optimal','Random',2],
   ["Banker's algorithm is used for?",'Deadlock avoidance','Paging','Compilation','Booting',0],
   ['A semaphore is used for?','Synchronization','Printing','Storage','Routing',0],
   ['Which fit picks the smallest sufficient block?','First Fit','Best Fit','Worst Fit','Next Fit',1]];
  return{users,exams:[{id:1,title:'Operating System Mid-Semester',subject:'Operating Systems',duration:10,pass:40,
    questions:Q.map(([q,a,b,c,d,ans])=>({q,o:[a,b,c,d],a:ans,m:2}))}],results:[],procs:[],attempts:[],nextId:2};
}
function loadDatabase() {
  if (!fs.existsSync(DB)) return seed();
  const existing = JSON.parse(fs.readFileSync(DB, 'utf8'));
  if (!existing || !Array.isArray(existing.users) || !Array.isArray(existing.exams)
      || !Array.isArray(existing.results) || !Array.isArray(existing.procs)) {
    throw new Error(`Invalid database structure in ${DB}. The file was left untouched.`);
  }
  return {
    ...existing,
    attempts: Array.isArray(existing.attempts) ? existing.attempts : [],
    nextId: Number.isInteger(existing.nextId) && existing.nextId > 0 ? existing.nextId : 2
  };
}
let db;
try {
  db = loadDatabase();
  if (!fs.existsSync(DB)) save();
} catch (error) {
  console.error(`Could not load the examination database: ${error.message}`);
  process.exit(1);
}
const sess={};
const auth=role=>(req,res,next)=>{const u=sess[req.headers.authorization];
  if(!u)return res.status(401).json({error:'Please login first'});
  if(role&&u.role!==role)return res.status(403).json({error:'Access denied'});req.u=u;next();};
const total=e=>e.questions.reduce((s,q)=>s+q.m,0);
const publicQuestions = exam => exam.questions.map(({ q, o, m }) => ({ q, o, m }));
const publicUser = user => ({ id: user.id, name: user.name, role: user.role });
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validAnswers = (answers, questionCount) => isObject(answers)
  && Object.entries(answers).every(([index, answer]) =>
    /^(0|[1-9]\d*)$/.test(index) && Number(index) < questionCount
      && Number.isInteger(answer) && answer >= 0 && answer <= 3);

app.post('/api/login',(req,res)=>{const{id,password}=req.body||{};
  const normalizedId=String(id||'').trim().toLowerCase();
  const passwordHash=hashPassword(password||'');
  const u=db.users.find(x=>x.id.toLowerCase()===normalizedId
    && crypto.timingSafeEqual(Buffer.from(x.pw, 'hex'), Buffer.from(passwordHash, 'hex')));
  if(!u)return res.status(400).json({error:'Invalid ID or password'});
  const token=crypto.randomUUID();sess[token]=u;res.json({token,user:publicUser(u)});});
app.post('/api/register',(req,res)=>{const{id,name,password}=req.body||{};
  const cleanId=typeof id==='string'?id.trim():'', cleanName=typeof name==='string'?name.trim():'';
  if(!cleanId||cleanId.length>64||!cleanName||cleanName.length>100
      ||typeof password!=='string'||password.length<8||password.length>128)
    return res.status(400).json({error:'Enter an ID and name; password must be 8–128 characters'});
  if(db.users.some(x=>x.id.toLowerCase()===cleanId.toLowerCase()))return res.status(400).json({error:'ID already exists'});
  db.users.push({id:cleanId,name:cleanName,role:'student',pw:hashPassword(password)});save();res.json({ok:true});});
app.get('/api/me',auth(),(req,res)=>res.json(publicUser(req.u)));
app.get('/api/health',(req,res)=>res.json({ok:true,service:'OS Examination System API'}));
app.get('/api/exams',auth(),(req,res)=>res.json(db.exams.map(e=>({id:e.id,title:e.title,subject:e.subject,duration:e.duration,pass:e.pass,count:e.questions.length,total:total(e),
  done:db.results.some(r=>r.examId===e.id&&r.studentId===req.u.id)}))));
// Student starts/resumes an exam -> a simulated process record is created (RUNNING).
app.post('/api/exams/:id/start',auth('student'),(req,res)=>{
  const e=db.exams.find(x=>x.id==req.params.id);if(!e||!e.questions.length)return res.status(404).json({error:'Exam not found or has no questions'});
  if(db.results.some(r=>r.examId===e.id&&r.studentId===req.u.id))return res.status(400).json({error:'Already attempted'});
  let attempt=db.attempts.find(x=>x.examId===e.id&&x.studentId===req.u.id&&x.status==='IN_PROGRESS');
  const pid='EXAM-'+req.u.id+'-'+e.id;
  if(!attempt){
    attempt={examId:e.id,studentId:req.u.id,status:'IN_PROGRESS',startedAt:Date.now(),
      expiresAt:Date.now()+e.duration*60*1000,answers:{}};
    db.attempts.push(attempt);
    db.procs=db.procs.filter(p=>p.pid!==pid);
    db.procs.push({pid,name:'Exam Process ('+req.u.name+')',state:'RUNNING',memKB:64+e.questions.length*8,at:attempt.startedAt});
    save();
  }
  const remainingSeconds=Math.max(0,Math.ceil((attempt.expiresAt-Date.now())/1000));
  res.json({id:e.id,title:e.title,duration:e.duration,remainingSeconds,answers:attempt.answers||{},questions:publicQuestions(e)});});
// Answers are saved as they are selected so a refresh does not erase completed work.
app.put('/api/exams/:id/answers/:index',auth('student'),(req,res)=>{
  const e=db.exams.find(x=>x.id==req.params.id);
  if(!e)return res.status(404).json({error:'Exam not found'});
  const attempt=db.attempts.find(x=>x.examId===e.id&&x.studentId===req.u.id&&x.status==='IN_PROGRESS');
  if(!attempt)return res.status(400).json({error:'Start the exam before saving answers'});
  if(Date.now()>attempt.expiresAt)return res.status(400).json({error:'Time is over. Your previously saved answers are available to submit.'});
  const index=Number(req.params.index), answer=(req.body||{}).answer;
  if(!Number.isInteger(index)||index<0||index>=e.questions.length
      ||(answer!==null&&(!Number.isInteger(answer)||answer<0||answer>3)))
    return res.status(400).json({error:'Invalid question or answer'});
  attempt.answers=attempt.answers||{};
  if(answer===null)delete attempt.answers[index];else attempt.answers[index]=answer;
  save();res.json({ok:true});
});
// Submit: Exam process TERMINATED -> Evaluation & Result processes run.
app.post('/api/exams/:id/submit',auth('student'),(req,res)=>{
  const e=db.exams.find(x=>x.id==req.params.id);if(!e)return res.status(404).json({error:'Exam not found'});
  if(db.results.some(r=>r.examId===e.id&&r.studentId===req.u.id))return res.status(400).json({error:'Already submitted'});
  const attempt=db.attempts.find(x=>x.examId===e.id&&x.studentId===req.u.id&&x.status==='IN_PROGRESS');
  if(!attempt)return res.status(400).json({error:'Start the exam before submitting'});
  const withinDeadline=Date.now()<=attempt.expiresAt+3000;
  const a=withinDeadline?((req.body||{}).answers??attempt.answers??{}):(attempt.answers??{});
  if(!validAnswers(a,e.questions.length))return res.status(400).json({error:'Submitted answers contain an invalid question or option'});
  attempt.answers=a;
  let c=0,w=0,score=0;
  e.questions.forEach((q,i)=>{if(a[i]===undefined)return;if(a[i]===q.a){c++;score+=q.m}else w++;});
  const t=total(e),pct=+(score/t*100).toFixed(1);
  const r={id:db.nextId++,studentId:req.u.id,studentName:req.u.name,examId:e.id,exam:e.title,score,total:t,pct,correct:c,wrong:w,
    unattempted:e.questions.length-c-w,count:e.questions.length,status:pct>=e.pass?'PASS':'FAIL',at:new Date().toISOString()};
  db.results.push(r);
  attempt.status='SUBMITTED';
  db.procs.forEach(p=>{if(p.pid==='EXAM-'+req.u.id+'-'+e.id)p.state='TERMINATED'});
  db.procs.push({pid:'EVAL-'+r.id,name:'Evaluation Process #'+r.id,state:'TERMINATED',memKB:32,at:Date.now()},
                {pid:'RES-'+r.id,name:'Result Process #'+r.id,state:'TERMINATED',memKB:16,at:Date.now()});
  save();res.json(r);});
app.get('/api/results',auth(),(req,res)=>res.json(req.u.role==='admin'?db.results:db.results.filter(r=>r.studentId===req.u.id)));
app.post('/api/exams',auth('admin'),(req,res)=>{const{title,subject,duration,pass,questions}=req.body||{};
  const cleanTitle=typeof title==='string'?title.trim():'', cleanSubject=typeof subject==='string'?subject.trim():'';
  const minutes=Number(duration), passing=pass===undefined?40:Number(pass);
  const validQuestion=question=>isObject(question)&&typeof question.q==='string'&&question.q.trim().length>0
    &&question.q.length<=500&&Array.isArray(question.o)&&question.o.length===4
    &&question.o.every(option=>typeof option==='string'&&option.trim().length>0&&option.length<=250)
    &&Number.isInteger(question.a)&&question.a>=0&&question.a<=3
    &&Number.isFinite(question.m)&&question.m>0&&question.m<=1000;
  if(!cleanTitle||cleanTitle.length>120||cleanSubject.length>120
      ||!Number.isInteger(minutes)||minutes<1||minutes>240
      ||!Number.isFinite(passing)||passing<0||passing>100
      ||!Array.isArray(questions)||questions.length<1||questions.length>200||!questions.every(validQuestion))
    return res.status(400).json({error:'Provide a title, duration (1–240 minutes), pass mark (0–100), and 1–200 valid four-option questions'});
  db.exams.push({id:db.nextId++,title:cleanTitle,subject:cleanSubject||'General',duration:minutes,pass:passing,
    questions:questions.map(q=>({q:q.q.trim(),o:q.o.map(option=>option.trim()),a:q.a,m:q.m}))});
  save();res.json({ok:true});});
app.delete('/api/exams/:id',auth('admin'),(req,res)=>{
  const exam=db.exams.find(e=>e.id==req.params.id);
  if(!exam)return res.status(404).json({error:'Exam not found'});
  if(db.results.some(r=>r.examId===exam.id))return res.status(409).json({error:'Cannot delete an exam with recorded submissions'});
  if(db.attempts.some(a=>a.examId===exam.id&&a.status==='IN_PROGRESS'))return res.status(409).json({error:'Cannot delete an exam with an active attempt'});
  db.exams=db.exams.filter(e=>e.id!==exam.id);save();res.json({ok:true});});
app.get('/api/stats',auth('admin'),(req,res)=>{const r=db.results;
  res.json({students:db.users.filter(u=>u.role==='student').length,exams:db.exams.length,questions:db.exams.reduce((s,e)=>s+e.questions.length,0),
  submissions:r.length,avg:r.length?+(r.reduce((s,x)=>s+x.pct,0)/r.length).toFixed(1):0,passPct:r.length?Math.round(r.filter(x=>x.status==='PASS').length/r.length*100):0});});
app.get('/api/procs',auth('admin'),(req,res)=>res.json(db.procs.map(({pid,name,state,memKB,at})=>({pid,name,state,memKB,at}))));
app.listen(5000,()=>console.log('Backend running on http://localhost:5000'));
