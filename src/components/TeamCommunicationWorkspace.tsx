import React, { useState } from "react";
import {
  MessageSquare,
  Hash,
  Send,
  Users,
  AlertTriangle,
  BarChart2,
  Paperclip,
  CheckCircle2,
  Clock,
  Shield,
  CornerDownRight,
  Plus,
  Lock,
  ExternalLink,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  type TeamChannel,
  type SharedChatMessage,
  type SharedChatPoll,
  DEFAULT_CHANNELS,
  DEFAULT_CHAT_MESSAGES,
  canUserAccessChannel,
  voteOnChatPoll,
} from "@/lib/team-communication";
import type { Persona } from "@/components/RoleAwareSidebar";

interface TeamCommunicationWorkspaceProps {
  sharedContent?: React.ReactNode;
  persona: Persona;
  onOpenProjectDetail?: (projectId: string) => void;
  onOpenDocument?: (docId: string) => void;
}

export function TeamCommunicationWorkspace({
  sharedContent,
  persona,
  onOpenProjectDetail,
  onOpenDocument,
}: TeamCommunicationWorkspaceProps) {
  if (persona.kind === "client") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-950/20">
        <Lock className="mx-auto size-8 text-rose-600 dark:text-rose-400 mb-2" />
        <h3 className="text-sm font-bold text-foreground">Access Restricted — Internal Channels</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Team communication channels, engineering threads, and live polls are restricted to internal employees and leads. Client communication occurs through the OEM Delivery Dashboard.
        </p>
      </div>
    );
  }

  // Scope channels by authenticated persona membership
  const accessibleChannels = sharedContent ? [] : DEFAULT_CHANNELS.filter((c) => canUserAccessChannel(c, persona));
  const [activeChannelId, setActiveChannelId] = useState<string>(() => accessibleChannels[0]?.id || "chan-general");
  const [messages, setMessages] = useState<SharedChatMessage[]>(sharedContent ? [] : DEFAULT_CHAT_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Poll Creation Modal
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOpt1, setPollOpt1] = useState("");
  const [pollOpt2, setPollOpt2] = useState("");
  const [pollOpt3, setPollOpt3] = useState("");

  const activeChannel = accessibleChannels.find((c) => c.id === activeChannelId) || accessibleChannels[0];
  const channelMessages = messages.filter((m) => m.channelId === (activeChannel?.id || activeChannelId));

  // Send Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChannel) return;

    const newMsg: SharedChatMessage = {
      id: `MSG-${Date.now().toString().slice(-4)}`,
      channelId: activeChannel.id,
      senderId: persona.id || "usr-current",
      senderName: persona.person,
      senderDept: persona.departmentId?.toUpperCase() || "ADMIN",
      text: inputText.trim(),
      timestamp: "Just now",
      isUrgent,
      mentions: inputText.match(/@\w+/g) || [],
      replies: [],
    };

    setMessages([...messages, newMsg]);
    setInputText("");
    setIsUrgent(false);
  };

  // Send Reply
  const handleSendReply = (messageId: string) => {
    if (!replyText.trim()) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          replies: [
            ...m.replies,
            {
              id: `REP-${Date.now().toString().slice(-4)}`,
              messageId,
              senderId: persona.id || "usr-current",
              senderName: persona.person,
              senderDept: persona.departmentId?.toUpperCase() || "ADMIN",
              text: replyText.trim(),
              timestamp: "Just now",
            },
          ],
        };
      })
    );
    setReplyText("");
    setReplyingToMessageId(null);
  };

  // Vote on Poll with strict closed-poll guard
  const handleVote = (messageId: string, optionId: string) => {
    const userId = persona.id || persona.person;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.poll) return m;

        const result = voteOnChatPoll(m.poll, optionId, userId);
        if (!result.success || !result.poll) return m;

        return {
          ...m,
          poll: result.poll,
        };
      })
    );
  };

  // Create Poll
  const handleCreatePoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollQuestion.trim() || !pollOpt1.trim() || !pollOpt2.trim()) return;

    const options = [
      { id: "OPT-1", text: pollOpt1.trim(), votes: 0 },
      { id: "OPT-2", text: pollOpt2.trim(), votes: 0 },
    ];
    if (pollOpt3.trim()) {
      options.push({ id: "OPT-3", text: pollOpt3.trim(), votes: 0 });
    }

    const pollMsg: SharedChatMessage = {
      id: `MSG-POLL-${Date.now().toString().slice(-4)}`,
      channelId: activeChannelId,
      senderId: persona.id || "usr-current",
      senderName: persona.person,
      senderDept: persona.departmentId?.toUpperCase() || "ADMIN",
      text: `📊 Team Technical Poll: ${pollQuestion.trim()}`,
      timestamp: "Just now",
      isUrgent: false,
      mentions: [],
      replies: [],
      poll: {
        id: `POLL-${Date.now().toString().slice(-4)}`,
        question: pollQuestion.trim(),
        options,
        voters: {},
        isClosed: false,
        isAnonymous: false,
        createdBy: persona.person,
        createdAt: "Just now",
      },
    };

    setMessages([...messages, pollMsg]);
    setIsPollModalOpen(false);
    setPollQuestion("");
    setPollOpt1("");
    setPollOpt2("");
    setPollOpt3("");
  };

  return (
    <div className="space-y-4">
      {!sharedContent && <span className="inline-flex rounded border border-amber-500/30 px-2 py-1 text-[10px] text-amber-600" title="Browser-local examples. Shared account communication is separate.">DEMO</span>}
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Team Chat
            </span>
            <span className="text-xs text-muted-foreground"></span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground mt-1">
            Team Chat
          </h2>
          <p className="text-xs text-muted-foreground">
            Role-governed channels, multi-department thread replies, and structured links to tasks, documents and projects.
          </p>
        </div>

        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Notice: Chat agreement or poll results never substitute for formal financial or stage approval.</span>
        </div>
      </div>

      {/* Main Grid: Channels Sidebar + Chat Stream */}
      {sharedContent ?? <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[580px]">
        {/* Left: Channels List */}
        <div className="p-3 rounded-xl bg-card border border-border shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">
            <span>Channels ({accessibleChannels.length})</span>
            <Users className="w-3.5 h-3.5" />
          </div>

          <div className="space-y-1">
            {accessibleChannels.map((chan) => (
              <button
                key={chan.id}
                onClick={() => setActiveChannelId(chan.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                  activeChannelId === chan.id
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Hash className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{chan.name}</span>
                </div>
                <span className="text-[10px] opacity-80 shrink-0">{chan.memberCount}</span>
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-border/60 text-[11px] text-muted-foreground px-2">
            Active Persona: <strong className="text-foreground">{persona.person}</strong> ({persona.label})
          </div>
        </div>

        {/* Right: Messages Stream */}
        <div className="md:col-span-3 flex flex-col rounded-xl bg-card border border-border shadow-sm overflow-hidden">
          {/* Channel Info Bar */}
          <div className="p-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                <Hash className="w-4 h-4 text-primary" />
                <span>{activeChannel?.name ?? "General"}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{activeChannel?.topic ?? ""}</p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPollModalOpen(true)}
              disabled={!activeChannel}
              className="h-7 text-xs gap-1.5 font-semibold text-primary"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Create Poll
            </Button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[460px]">
            {channelMessages.map((msg) => {
              const isMe = msg.senderName.toLowerCase().includes(persona.person.toLowerCase());

              return (
                <div key={msg.id} className="space-y-2 p-3 rounded-lg bg-muted/20 border border-border/60">
                  {/* Sender Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary uppercase">
                        {msg.senderDept}
                      </span>
                      <span className="font-bold text-xs text-foreground">{msg.senderName}</span>
                      <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                      {msg.isUrgent && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          URGENT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Message Body */}
                  <p className="text-xs text-foreground leading-relaxed">{msg.text}</p>

                  {/* Record Link (if present) */}
                  {msg.recordLink && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/80 text-secondary-foreground text-xs font-mono border border-border/50">
                      <Paperclip className="w-3 h-3 text-muted-foreground" />
                      <span className="font-bold">{msg.recordLink.reference}:</span>
                      <span className="text-muted-foreground">{msg.recordLink.title}</span>
                    </div>
                  )}

                  {/* Interactive Poll (if present) */}
                  {msg.poll && (
                    <div className="p-3 rounded-lg bg-card border border-border/80 space-y-2.5 mt-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <BarChart2 className="w-4 h-4 text-primary" />
                        <span>{msg.poll.question}</span>
                      </div>

                      <div className="space-y-1.5">
                        {msg.poll.options.map((opt) => {
                          const totalVotes = msg.poll?.options.reduce((s, o) => s + o.votes, 0) || 1;
                          const pct = Math.round((opt.votes / Math.max(1, totalVotes)) * 100);
                          const hasVoted = msg.poll?.voters[persona.id || persona.person] === opt.id;

                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleVote(msg.id, opt.id)}
                              className={`w-full text-left p-2 rounded border text-xs transition-all relative overflow-hidden ${
                                hasVoted
                                  ? "border-primary bg-primary/10 font-semibold"
                                  : "border-border hover:bg-muted/40"
                              }`}
                            >
                              <div
                                className="absolute top-0 bottom-0 left-0 bg-primary/15 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                              <div className="relative flex items-center justify-between z-10">
                                <span>{opt.text}</span>
                                <span className="text-[11px] font-bold text-muted-foreground">
                                  {opt.votes} ({pct}%)
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Replies List */}
                  {msg.replies.length > 0 && (
                    <div className="pl-4 border-l-2 border-border/70 space-y-1.5 mt-2">
                      {msg.replies.map((rep) => (
                        <div key={rep.id} className="text-xs">
                          <span className="font-semibold text-foreground">{rep.senderName}</span>{" "}
                          <span className="text-[10px] text-muted-foreground">({rep.senderDept})</span>:{" "}
                          <span className="text-muted-foreground">{rep.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Button */}
                  <div className="pt-1 flex items-center gap-2">
                    {replyingToMessageId === msg.id ? (
                      <div className="flex items-center gap-2 w-full mt-1">
                        <input
                          type="text"
                          placeholder="Write a reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="flex-1 h-7 px-2 text-xs rounded border border-input bg-background"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSendReply(msg.id)}
                          className="h-7 text-xs px-2.5 bg-primary text-primary-foreground font-semibold"
                        >
                          Reply
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReplyingToMessageId(null)}
                          className="h-7 text-xs px-2"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyingToMessageId(msg.id)}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        <CornerDownRight className="w-3 h-3" />
                        Reply ({msg.replies.length})
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Chat Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-muted/20 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`Message in ${activeChannel?.name ?? "channel"}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={!activeChannel}
                className="flex-1 h-9 px-3 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button type="submit" size="sm" disabled={!activeChannel} className="h-9 px-3.5 bg-primary text-primary-foreground font-semibold gap-1.5">
                <Send className="w-3.5 h-3.5" />
                Send
              </Button>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                />
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">Mark Urgent</span>
              </label>
              <span className="text-[11px]">Tip: Use @Name to mention authorized participants.</span>
            </div>
          </form>
        </div>
      </div>

      {/* Create Poll Modal */}
      </>}
      <Dialog open={isPollModalOpen} onOpenChange={setIsPollModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Create Team Technical Poll</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Collect engineering consensus across departments. Does not replace formal sign-offs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePoll} className="space-y-3 mt-2 text-xs">
            <div>
              <label className="font-semibold block mb-1">Poll Question</label>
              <input
                type="text"
                required
                placeholder="e.g. Which dual-footprint layout should we adopt?"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="w-full h-8 px-2 rounded border border-input bg-background text-xs"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Option 1</label>
              <input
                type="text"
                required
                placeholder="Option 1 text..."
                value={pollOpt1}
                onChange={(e) => setPollOpt1(e.target.value)}
                className="w-full h-8 px-2 rounded border border-input bg-background text-xs"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Option 2</label>
              <input
                type="text"
                required
                placeholder="Option 2 text..."
                value={pollOpt2}
                onChange={(e) => setPollOpt2(e.target.value)}
                className="w-full h-8 px-2 rounded border border-input bg-background text-xs"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Option 3 (Optional)</label>
              <input
                type="text"
                placeholder="Option 3 text..."
                value={pollOpt3}
                onChange={(e) => setPollOpt3(e.target.value)}
                className="w-full h-8 px-2 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsPollModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                Launch Poll
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
