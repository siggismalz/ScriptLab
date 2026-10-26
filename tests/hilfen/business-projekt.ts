import {neuesProjekt,type EditorBlock} from '../../src/kern/projekt';
export function businessTestProjekt(){
 const p=neuesProjekt('python');p.name='CSV-Prüfung';
 const lesen:EditorBlock={type:'sl_biz_lesen_csv',id:'lesen',data:JSON.stringify({konfiguration:{format:'CSV',pfad:'quelle.csv',optionen:{trennzeichen:';'}},eingaben:{}})};
 const schreiben:EditorBlock={type:'sl_biz_schreiben_csv',id:'schreiben',data:JSON.stringify({konfiguration:{format:'CSV',pfad:'ergebnis.csv',konflikt:'FEHLER',optionen:{}},eingaben:{tabelle:{referenz:'lesen'}}})};
 lesen.next={block:schreiben};p.editor.blocks!.blocks[0].next={block:lesen};return p;
}
