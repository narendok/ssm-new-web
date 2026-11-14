const {test}=require('node:test'),assert=require('node:assert/strict');
const {vaultProjectId,vaultRelatedRecords,attachmentRevisionOptions,vaultDisplayDocuments}=require('../src/lib/shared-vault.ts');
const {verifyControlledFileBytes}=require('../src/lib/controlled-file-integrity.ts');
test('Vault uses explicit canonical project links, never filenames or approval guesses',()=>{
  const projects=[{id:'p',reference:'HLPL-P-01',type:'Project',fields:{}}];
  const doc={id:'d',title:'HLPL-P-01 approved certificate.pdf',metadata:{},document_type:'Certificate',department_id:'qa',record_id:null};
  assert.equal(vaultProjectId(doc,projects),undefined);
  assert.equal(vaultDisplayDocuments([doc],projects)[0].lifecycle,'Draft');
  assert.equal(vaultProjectId({...doc,metadata:{projectId:'p'}},projects),'p');
  assert.equal(vaultProjectId({...doc,metadata:{projectId:'missing'}},projects),undefined);
  const source={id:'r',reference:'REC-01',title:'Source record',type:'Drawing',status:'Draft',fields:{project_id:'p',projectCode:'HLPL-P-01'}};
  assert.equal(vaultProjectId({...doc,record_id:'r'},[...projects,source]),'p');
  assert.equal(vaultProjectId({...doc,record_id:'r',metadata:{projectId:'another'}},[...projects,{...projects[0],id:'another',reference:'HLPL-P-02'},source]),undefined);
  assert.equal(vaultProjectId({...doc,record_id:'r'},[...projects,{...source,fields:{project_id:'p',projectCode:'HLPL-P-02'}}]),undefined);
  const task={id:'t',reference:'TASK-01',title:'Task',type:'Task',status:'Open',fields:{project_id:'p'}};
  const unrelated={id:'u',reference:'REC-02',title:'Unlinked record',type:'Drawing',status:'Draft',fields:{project_id:'elsewhere'}};
  assert.deepEqual(vaultRelatedRecords([...projects,source,task,unrelated],'p').map(record=>record.id),['r']);
  assert.deepEqual(vaultRelatedRecords([...projects,source],'missing'),[]);
  assert.deepEqual(attachmentRevisionOptions([{revision:'02'},{revision:'01'},{revision:'02'},{revision:'invalid'}]),['01','02','03']);
});
test('Private upload completion rejects altered content even with equal byte length',async()=>{
  const bytes=new TextEncoder().encode('test').buffer;
  const checksum=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
  await verifyControlledFileBytes(bytes,{size_bytes:4,checksum});
  await assert.rejects(verifyControlledFileBytes(new TextEncoder().encode('fake').buffer,{size_bytes:4,checksum}),/content does not match/);
  await assert.rejects(verifyControlledFileBytes(bytes,{size_bytes:3,checksum}),/byte length/);
});
