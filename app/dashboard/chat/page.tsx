'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/providers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { formatDateTime } from '@/lib/client-utils';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  createdAt: string;
  isPinned?: boolean;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Load mock messages on component mount
    const loadMessages = async () => {
      if (!user?.departmentId) return;
      try {
        const response = await fetch(`/api/chat/messages-mock?departmentId=${user.departmentId}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            senderId: msg.senderId,
            senderName: msg.sender?.username || msg.sender?.fullName || 'Unknown',
            createdAt: msg.createdAt,
          })));
        }
      } catch (error) {
        console.error('[v0] Failed to load messages:', error);
      }
    };
    loadMessages();
  }, [user?.departmentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user?.departmentId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          departmentId: user.departmentId,
          content: inputValue.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages([
          ...messages,
          {
            id: data.message.id,
            content: data.message.content,
            senderId: user.id,
            senderName: user.username || user.email,
            createdAt: new Date().toISOString(),
          },
        ]);
        setInputValue('');
      }
    } catch (error) {
      console.error('[v0] Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Department Chat</h1>
        <p className="text-muted-foreground mt-2">
          {user?.departmentId ? 'Chat with your department members' : 'No department assigned'}
        </p>
      </div>

      {user?.departmentId ? (
        <Card className="flex flex-col h-[600px]">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    msg.senderId === user.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 max-w-xs ${
                      msg.senderId === user.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {msg.senderId !== user.id && (
                      <p className="text-xs font-semibold mb-1">{msg.senderName}</p>
                    )}
                    <p className="break-words">{msg.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {formatDateTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={sendMessage} className="border-t border-border p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a message... (use @username to mention)"
                className="flex-1 rounded-lg border border-border px-4 py-2 outline-none focus:border-primary"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !inputValue.trim()}>
                <Send size={20} />
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-muted-foreground">
              You are not assigned to any department yet.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Contact your administrator to join a department.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
