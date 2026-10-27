const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync('src/lib/shared-chat-presentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('module','exports',output)(m,m.exports);const {sharedChatPresentation}=m.exports;
const item=(id,kind,data)=>({id,kind,data,ownerId:'author'});
const base={items:[],membership:{membership_id:'member'},votes:[]};
test('shared chat reconstructs canonical threads without browser examples or foreign-channel messages',()=>{
 const data={...base,items:[item('c','channel',{name:'Team',memberIds:['member']}),item('root','message',{channelId:'c',text:'Root',createdAt:'2026-10-27T10:00:00Z',isUrgent:true,tags:['pilot']}),item('reply','message',{channelId:'c',replyToId:'root',text:'Reply'}),item('foreign','message',{channelId:'missing',text:'Hidden'}),item('orphan','message',{channelId:'c',replyToId:'missing',text:'No parent'})]};
 const view=sharedChatPresentation(data);assert.equal(view.channels[0].id,'c');assert.equal(view.messages.length,1);assert.equal(view.messages[0].id,'root');assert.equal(view.messages[0].replies[0].id,'reply');assert.equal(view.messages[0].isUrgent,true);assert.deepEqual(view.messages[0].tags,['pilot']);assert.deepEqual(sharedChatPresentation(base),{channels:[],messages:[]});
});
test('poll counts and own vote use shared aggregate; missing/expired deadline closes poll',()=>{
 const data={...base,items:[item('c','channel',{name:'Team'}),item('p','message',{channelId:'c',poll:{question:'Choice',options:['A','B'],closesAt:'2000-01-01T00:00:00Z'}})],votes:[{message_id:'p',choice:1,total:3,my_vote:true}]};
 const poll=sharedChatPresentation(data).messages[0].poll;assert.equal(poll.isClosed,true);assert.equal(poll.options[1].votes,3);assert.equal(poll.voters.member,'1');
 delete data.items[1].data.poll.closesAt;assert.equal(sharedChatPresentation(data).messages[0].poll.isClosed,true);
});
