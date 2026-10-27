import type { BusinessSnapshot } from './business-workspace.functions';
import type { TeamChannel, SharedChatMessage } from './team-communication';
const text=(v:unknown)=>typeof v==='string'?v:'';
export function sharedChatPresentation(data:BusinessSnapshot):{channels:TeamChannel[];messages:SharedChatMessage[]}{
 const channels=data.items.filter(i=>i.kind==='channel').map(i=>({id:i.id,name:text(i.data['name']),topic:text(i.data['topic']),isPrivate:true,memberCount:Array.isArray(i.data['memberIds'])?i.data['memberIds'].length:0}));
 const permitted=new Set(channels.map(c=>c.id));
 const rows=data.items.filter(i=>i.kind==='message'&&permitted.has(text(i.data['channelId'])));
 const date=(v:unknown)=>{const value=text(v);return Number.isFinite(Date.parse(value))?new Date(value).toLocaleString():value;};
 const ordered=[...rows].sort((a,b)=>(Date.parse(text(a.data['createdAt']))||0)-(Date.parse(text(b.data['createdAt']))||0)||a.id.localeCompare(b.id));
 const messages=ordered.filter(i=>!text(i.data['replyToId'])).map(i=>{
  const raw=i.data['poll'];
  const poll=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:undefined;
  const closesAt=Date.parse(text(poll?.['closesAt']));
  const options=Array.isArray(poll?.['options'])?poll['options']:[];
  const myVote=data.votes.find(v=>v.message_id===i.id&&v.my_vote);
  return {id:i.id,channelId:text(i.data['channelId']),senderId:i.ownerId||'',senderName:text(i.data['senderName']),senderDept:text(i.data['senderDept']),text:text(i.data['text']),timestamp:date(i.data['createdAt']),isUrgent:i.data['isUrgent']===true,conversationType:text(i.data['type']),tags:Array.isArray(i.data['tags'])?i.data['tags'].filter((t):t is string=>typeof t==='string'):[],mentions:text(i.data['text']).match(/@\w+/g)||[],
   replies:ordered.filter(r=>r.data['replyToId']===i.id&&r.data['channelId']===i.data['channelId']).map(r=>({id:r.id,messageId:i.id,senderId:r.ownerId||'',senderName:text(r.data['senderName']),senderDept:text(r.data['senderDept']),text:text(r.data['text']),timestamp:date(r.data['createdAt'])})),
   ...(poll?{poll:{id:i.id,question:text(poll['question']),options:options.map((o,index)=>({id:String(index),text:text(o),votes:data.votes.find(v=>v.message_id===i.id&&v.choice===index)?.total||0})),voters:myVote?{[data.membership.membership_id]:String(myVote.choice)}:{},isClosed:!Number.isFinite(closesAt)||closesAt<=Date.now(),isAnonymous:false,createdBy:i.ownerId||'',createdAt:text(i.data['createdAt'])}}:{}),
  };
 });
 return {channels,messages};
}
