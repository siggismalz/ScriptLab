import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
/** Nur Testharness: eigene feste Prüfdateien im vorhandenen Windows-Job. */
export function businessPruefjob(python:string,script:string,basis:string,sekunden=30):Promise<{code:number|null;ausgabe:string;fehler:string}>{
 return new Promise((fertig,ablehnen)=>{
 const p=spawn(resolve('artifacts/native/ScriptLab.Testhost.exe'),['--script',script,'--basis',basis,'--limit-ms',String(sekunden*1000),'--token',randomBytes(24).toString('hex'),'--sprache','python','--interpreter',python],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],cwd:basis});
 let ausgabe='',fehler='';p.stdout.setEncoding('utf8');p.stderr.setEncoding('utf8');p.stdout.on('data',d=>{ausgabe=(ausgabe+d).slice(-262144);});p.stderr.on('data',d=>{fehler=(fehler+d).slice(-262144);});p.stdin.on('error',()=>{});
 const timer=setTimeout(()=>p.kill(),(sekunden+5)*1000);p.once('error',e=>{clearTimeout(timer);ablehnen(e);});p.once('close',code=>{clearTimeout(timer);fertig({code,ausgabe,fehler});});
 });
}
