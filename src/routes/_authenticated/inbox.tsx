import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Inbox as InboxIcon, Search, Send, Archive, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard, StatCardGrid } from "@/components/shell/StatCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { InitialsAvatar } from "@/components/shell/Avatar";
import { relativeTime, formatPhone } from "@/lib/format";
import { listConversations, getConversation, sendMessage, setConversationStatus } from "@/lib/inbox.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox · Holaweb Business OS" }] }),
  component: InboxPage,
});

function InboxPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listConversations);
  const fetchConvo = useServerFn(getConversation);
  const sendMsg = useServerFn(sendMessage);
  const setStatus = useServerFn(setConversationStatus);

  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const listQ = useQuery({ queryKey: ["inbox-list"], queryFn: () => fetchList() });
  const convoQ = useQuery({
    queryKey: ["inbox-convo", activeId],
    enabled: !!activeId,
    queryFn: () => fetchConvo({ data: { id: activeId! } }),
  });

  const filtered = useMemo(() => {
    const list = listQ.data?.conversations ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c: any) =>
      (c.customer?.display_name ?? "").toLowerCase().includes(q) ||
      (c.customer?.wa_phone ?? "").includes(q) ||
      (c.last_message ?? "").toLowerCase().includes(q)
    );
  }, [listQ.data, search]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convoQ.data?.messages.length]);

  const send = useMutation({
    mutationFn: (content: string) => sendMsg({ data: { conversation_id: activeId!, content } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["inbox-convo", activeId] });
      qc.invalidateQueries({ queryKey: ["inbox-list"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });

  const updateStatus = useMutation({
    mutationFn: (status: "open" | "closed" | "archived") => setStatus({ data: { id: activeId!, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox-list"] });
      qc.invalidateQueries({ queryKey: ["inbox-convo", activeId] });
      toast.success("Updated");
    },
  });

  const stats = listQ.data?.stats ?? { open: 0, unread: 0, mine: 0 };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader title="Inbox" description="WhatsApp conversations with your customers." />

      <StatCardGrid>
        <StatCard label="Open" value={stats.open} icon={InboxIcon} />
        <StatCard label="Unread" value={stats.unread} icon={InboxIcon} />
        <StatCard label="Assigned" value={stats.mine} icon={InboxIcon} />
        <StatCard label="Total" value={listQ.data?.conversations.length ?? 0} icon={InboxIcon} />
      </StatCardGrid>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-340px)] min-h-[480px] border rounded-lg overflow-hidden bg-card">
        <aside className="border-r flex flex-col min-h-0">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="pl-8 h-9" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listQ.isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={InboxIcon} title="No conversations" description="New WhatsApp chats will appear here." />
            ) : (
              filtered.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-3 border-b hover:bg-accent/40 transition-colors flex gap-3 items-start",
                    activeId === c.id && "bg-accent/60"
                  )}
                >
                  <InitialsAvatar name={c.customer?.display_name ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{c.customer?.display_name ?? "Unknown"}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{c.last_message_at ? relativeTime(c.last_message_at) : ""}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message ?? formatPhone(c.customer?.wa_phone)}</p>
                  </div>
                  {c.unread_count > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center font-semibold">
                      {c.unread_count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex flex-col min-h-0">
          {!activeId ? (
            <EmptyState icon={InboxIcon} title="Select a conversation" description="Choose a chat from the list to view messages." className="m-auto" />
          ) : convoQ.isLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : convoQ.data ? (
            <>
              <header className="px-4 py-3 border-b flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <InitialsAvatar name={convoQ.data.conversation.customer?.display_name ?? "?"} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{convoQ.data.conversation.customer?.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{formatPhone(convoQ.data.conversation.customer?.wa_phone)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate("closed")} disabled={updateStatus.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />Close
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate("archived")} disabled={updateStatus.isPending}>
                    <Archive className="h-4 w-4 mr-1" />Archive
                  </Button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                {convoQ.data.messages.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">No messages yet</p>
                ) : (
                  convoQ.data.messages.map((m: any) => (
                    <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                        m.direction === "outbound" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border rounded-bl-sm"
                      )}>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={cn("text-[10px] mt-1 opacity-70", m.direction === "outbound" ? "text-primary-foreground" : "text-muted-foreground")}>
                          {relativeTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); if (draft.trim()) send.mutate(draft.trim()); }}
                className="border-t p-3 flex items-end gap-2 bg-background"
              >
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim()) send.mutate(draft.trim()); }
                  }}
                  placeholder="Type a message…"
                  rows={1}
                  className="resize-none min-h-[40px] max-h-32"
                />
                <Button type="submit" disabled={!draft.trim() || send.isPending} size="icon">
                  {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
