// Loopback-only component acceptance harness. No database, session or live records.
import { mkdtemp, mkdir, writeFile, symlink, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
const repo=resolve(import.meta.dirname,'..'), root=await mkdtemp(join(tmpdir(),'gh-sales-acceptance-'));
await mkdir(join(root,'app/portal/sales'),{recursive:true});
await mkdir(join(root,'app/api/portal/sales/[projectId]/drawing'),{recursive:true});
await symlink(join(repo,'node_modules'),join(root,'node_modules'),'dir');
await writeFile(join(root,'package.json'),JSON.stringify({name:'local-sales-ui-only',private:true}));
await writeFile(join(root,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',jsx:'preserve',esModuleInterop:true,resolveJsonModule:true,noEmit:true,moduleResolution:'bundler',paths:{'@/*':[repo+'/*']}}}));
await writeFile(join(root,'postcss.config.mjs'),'export default {plugins:{tailwindcss:{},autoprefixer:{}}};');
await writeFile(join(root,'tailwind.config.cjs'),`module.exports={content:[${JSON.stringify(repo+'/app/**/*.{ts,tsx}')},${JSON.stringify(repo+'/components/**/*.{ts,tsx}')}],theme:{extend:{}},plugins:[]};`);
await writeFile(join(root,'next.config.mjs'),`export default {devIndicators:false,webpack(c){c.resolve.alias={'@/lib/sales/actions$':${JSON.stringify(join(root,'mock-actions.ts'))},'@':${JSON.stringify(repo)},...c.resolve.alias};return c;}};`);
await writeFile(join(root,'mock-actions.ts'),`export async function salesAction(projectId,operation,input){return new Promise(resolve=>{window.dispatchEvent(new CustomEvent('local-sales-action',{detail:{projectId,operation,input,resolve}}));});}`);
await writeFile(join(root,'app/layout.tsx'),`import ${JSON.stringify(repo+'/app/globals.css')};export default function Layout({children}){return <html lang="en"><body>{children}</body></html>}`);
// This test route serves only the already-delivered SVG in a disposable loopback app.
await copyFile(join(repo,'assets/sales/golfview-review/masterplan.svg'),join(root,'drawing.svg'));
await writeFile(join(root,'app/api/portal/sales/[projectId]/drawing/route.ts'),`import {readFile} from 'node:fs/promises';export async function GET(){return new Response(await readFile(${JSON.stringify(join(root,'drawing.svg'))}),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'no-store'}});}`);
await writeFile(join(root,'app/portal/sales/page.tsx'),`"use client";
import {useState,useEffect,Suspense} from 'react';import {useSearchParams} from 'next/navigation';
import {SalesWorkspace} from ${JSON.stringify(repo+'/components/sales/workspace')};
import {Workspace} from ${JSON.stringify(repo+'/components/portal/workspace')};
import plan from ${JSON.stringify(repo+'/assets/sales/golfview-review/plan.json')};
const project='b1234567-1234-4234-8234-000000000099',future='b1234567-1234-4234-8234-000000000098';
const stamp='2026-10-31T09:00:00Z';const projects=[{id:project,name:'Golfview'},{id:future,name:'Future project'}];
function fresh(){return {agent:false,settings:{expectedUnits:47},units:Array.from({length:47},(_,i)=>({id:'b1234567-1234-4234-8234-'+String(i+1).padStart(12,'0'),projectId:project,revision:1,number:String(i+1),lot:null,housingType:i%2?'B':'A',bedrooms:3,bathrooms:2,carSpaces:2,floorLevels:2,landAreaSqm:'120.00',buildingAreaSqm:'150.00',features:['Courtyard'],media:[],floorPlans:[],specifications:[],provenance:[],validationWarnings:[],sourceDocument:'Synthetic local acceptance only',status:'available',publicVisible:false,publicPriceVisible:false,publicAskingPrice:null})),prices:[{unitId:'b1234567-1234-4234-8234-000000000001',askingPrice:'123456.78'}],construction:[],release:[],leads:[],publications:[],history:[{id:'local-event',action:'unit.updated',createdAt:stamp}],assignees:[],financeReport:[],publicData:{units:[],revision:0},permissions:Object.fromEntries(['inventory.edit','prices.view','prices.edit','publicPrices.edit','status.edit','crm.view','crm.edit','leads.assign','publication.approve','publication.publish','audit.view','settings.edit','crm.export'].map(p=>[p,true]))};}
function Harness(){const params=useSearchParams(),id=params.get('project')??project;const [data,setData]=useState(()=>{const d=fresh();if(params.get('v2')){d.units=d.units.map((u,i)=>({...u,bedrooms:4-i%3,bathrooms:i%3+1,carSpaces:i%3,buildingAreaSqm:i===46?null:String(100+i*3)+'.00',landAreaSqm:i===45?null:String(200-i)+'.00',publicAskingPrice:i%5===0?null:String(90000+i*10000)+'.00',status:i===19?'available':['available','reserved','not_released','settled'][i%4],releaseStageId:i%3===0?null:i%3===1?'late':'early'}));d.prices=d.units.map((u,i)=>({unitId:u.id,askingPrice:i===46?null:String(1000000-i*1000)+'.00',contractPrice:i<3?['100.00','9.00','1000.00'][i]:null}));d.release=[{id:'late',name:'Release A',sequence:10},{id:'early',name:'Release Z',sequence:2}];d.history=[{id:'local-unit-event',unitId:d.units[0].id,action:'unit.imported',createdAt:stamp,details:{source:'Local test only'}}];d.leads=[{id:'b1234567-1234-4234-8234-000000000088',name:'Local Buyer',email:'local@example.invalid',unitIds:[d.units[0].id],status:'new',revision:1,contactPreference:'email',followUpAt:null,privacyVersion:'local-test',consentAt:stamp,marketingConsent:false}];}return d;}),[operation,setOperation]=useState('');
useEffect(()=>{const listener=e=>{const {operation:op,input,resolve}=e.detail;setOperation(JSON.stringify({op,...input}));
 if(op==='status'||op==='unit'){setData(d=>({...d,units:d.units.map(u=>u.id===input.id?{...u,...input,revision:u.revision+1}:u)}));resolve({ok:true,data:input.id});}
 else if(op==='publicPrice'||op==='prices'){setData(d=>({...d,units:d.units.map(u=>u.id===input.id?{...u,...(op==='publicPrice'?{publicAskingPrice:input.publicAskingPrice||null,publicPriceVisible:input.publicPriceVisible}:{}),revision:u.revision+1}:u),prices:op==='prices'?d.prices.map(p=>p.unitId===input.id?{...p,askingPrice:input.askingPrice||null,contractPrice:input.contractPrice||null}:p):d.prices}));resolve({ok:true,data:input.id});}
 else if(op==='unitActivity')resolve({ok:true,data:data.history.filter(e=>e.unitId===input.id)});
 else if(op==='import')resolve({ok:true,data:{count:1,committed:Boolean(input.commit)}});
 else resolve({ok:true,data:[]});};window.addEventListener('local-sales-action',listener);return()=>window.removeEventListener('local-sales-action',listener);},[]);
let visible=id===project?data:{...data,units:[],prices:[]};if(params.get('restricted'))visible={...visible,prices:[],leads:[],history:[],permissions:Object.fromEntries(Object.keys(visible.permissions).map(k=>[k,false]))};return <Workspace projects={projects} admin={false} sales><p style={{position:"fixed",right:8,top:8,zIndex:2147483647,padding:6,background:"#fff2cc",fontSize:10,color:"#634916"}}>LOCAL SYNTHETIC ACCEPTANCE ONLY · NO SESSION / NO DATABASE</p><output data-testid="operation" className="sr-only">{operation}</output><SalesWorkspace key={id} data={visible} projectId={id} reviewPlan={id===project?plan:undefined} projectName={id===project?'Golfview':'Future project'} projects={projects}/></Workspace>;}
export default function Page(){return <Suspense><Harness/></Suspense>}`);
console.log('Local synthetic Sales Management harness:',root);
const child=spawn(process.execPath,[join(repo,'node_modules/next/dist/bin/next'),'dev',root,'--hostname','127.0.0.1','--port',process.argv[2]??'3034'],{cwd:root,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code??1));
