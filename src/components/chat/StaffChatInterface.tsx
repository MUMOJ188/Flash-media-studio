import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminChatWindow from "./AdminChatWindow";
import { MessageCircle, Clock } from "lucide-react";

interface Job {
  id: string;
  title: string;
  client_id: string;
  status: string;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  job_id: string | null;
  created_at: string;
  is_read: boolean;
}

interface Conversation {
  id: string;
  title: string;
  client_id: string;
  client: Profile;
  unread_messages: number;
  latest_message?: Message;
  status?: string;
  is_general?: boolean;
}

const StaffChatInterface = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    let messagesChannel: any = null;

    const getUser = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user:', userError);
        setLoading(false);
        return;
      }
      
      if (!user) {
        setLoading(false);
        return;
      }
      
      setUser(user);
      
      // Fetch conversations
      await fetchJobsWithMessages();

      // Set up real-time subscription after user is loaded
      const channelName = `staff-chat-${user.id}`;
      
      messagesChannel = supabase
        .channel(channelName)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'messages'
          },
          async () => {
            await fetchJobsWithMessages();
          }
        )
        .subscribe();
      
      setLoading(false);
    };

    getUser();

    return () => {
      if (messagesChannel) {
        supabase.removeChannel(messagesChannel);
      }
    };
  }, []);

  const fetchJobsWithMessages = async () => {
    try {
      // Get jobs with messages
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // Get general messages (without job_id)
      const { data: generalMessages, error: generalMsgError } = await supabase
        .from('messages')
        .select('*')
        .is('job_id', null)
        .order('created_at', { ascending: false });

      if (generalMsgError) throw generalMsgError;

      // Get unique client IDs from both jobs and general messages
      const jobClientIds = jobs?.map(job => job.client_id) || [];
      const generalClientIds = [...new Set(generalMessages?.map(msg => msg.sender_id).filter(id => id !== user?.id) || [])];
      const allClientIds = [...new Set([...jobClientIds, ...generalClientIds])];

      // Get profiles for all clients
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email')
        .in('user_id', allClientIds);

      if (profilesError) throw profilesError;

      // Process job-based conversations
      const jobConversations = await Promise.all(
        (jobs || []).map(async (job) => {
          const client = profiles?.find(p => p.user_id === job.client_id);
          
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id)
            .eq('recipient_id', user?.id)
            .eq('is_read', false);

          const { data: latestMessage } = await supabase
            .from('messages')
            .select('*')
            .eq('job_id', job.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            id: job.id,
            title: job.title,
            client_id: job.client_id,
            status: job.status,
            client: client || { id: '', user_id: job.client_id, full_name: 'Unknown Client', email: '' },
            unread_messages: unreadCount || 0,
            latest_message: latestMessage,
            is_general: false
          };
        })
      );

      // Process general conversations (group by client)
      const generalConversations = await Promise.all(
        generalClientIds.map(async (clientId) => {
          const client = profiles?.find(p => p.user_id === clientId);
          
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .is('job_id', null)
            .eq('sender_id', clientId)
            .eq('recipient_id', user?.id)
            .eq('is_read', false);

          const latestMessage = generalMessages?.find(msg => 
            msg.sender_id === clientId || msg.recipient_id === clientId
          );

          return {
            id: `general_${clientId}`,
            title: 'General Chat',
            client_id: clientId,
            client: client || { id: '', user_id: clientId, full_name: 'Unknown Client', email: '' },
            unread_messages: unreadCount || 0,
            latest_message: latestMessage,
            is_general: true
          };
        })
      );

      // Combine and filter conversations that have messages
      const allConversations = [...jobConversations, ...generalConversations]
        .filter(conv => conv.latest_message)
        .sort((a, b) => {
          const aTime = new Date(a.latest_message?.created_at || 0).getTime();
          const bTime = new Date(b.latest_message?.created_at || 0).getTime();
          return bTime - aTime;
        });

      setConversations(allConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({ 
        title: "Error", 
        description: "Failed to load chat conversations",
        variant: "destructive" 
      });
    }
  };

  const markMessagesAsRead = async (conversation: Conversation) => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('messages')
        .update({ is_read: true })
        .eq('recipient_id', user.id);

      if (conversation.is_general) {
        query = query.is('job_id', null).eq('sender_id', conversation.client_id);
      } else {
        query = query.eq('job_id', conversation.id);
      }

      await query;
      await fetchJobsWithMessages();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (conversation.unread_messages > 0) {
      markMessagesAsRead(conversation);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-96 bg-muted rounded-md"></div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3 h-[600px]">
      {/* Chat List */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Active Conversations
            </CardTitle>
            <CardDescription>
              Client messages and chat conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[480px]">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                  <p className="text-sm">Messages will appear here when clients start chatting</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`p-4 cursor-pointer hover:bg-muted/50 border-b transition-colors ${
                        selectedConversation?.id === conversation.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleConversationSelect(conversation)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">
                              {conversation.client?.full_name || 'Client'}
                            </h4>
                            {conversation.unread_messages > 0 && (
                              <Badge variant="destructive" className="px-1.5 py-0.5 text-xs">
                                {conversation.unread_messages}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mb-1">
                            {conversation.title}
                          </p>
                          {conversation.latest_message && (
                            <p className="text-xs text-muted-foreground truncate">
                              {conversation.latest_message.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {conversation.latest_message && new Date(conversation.latest_message.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Chat Window */}
      <div className="lg:col-span-2">
        <Card className="h-full">
          {selectedConversation ? (
            <>
              <CardHeader>
                <CardTitle className="text-lg">
                  Chat with {selectedConversation.client?.full_name || 'Client'}
                </CardTitle>
                <CardDescription>
                  {selectedConversation.is_general ? (
                    'General Chat'
                  ) : (
                    <>
                      Job: {selectedConversation.title} • Status: <Badge variant="outline">{selectedConversation.status}</Badge>
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminChatWindow 
                  jobId={selectedConversation.is_general ? undefined : selectedConversation.id}
                  clientId={selectedConversation.client_id} 
                />
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
                <p>Choose a client conversation from the list to start chatting</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default StaffChatInterface;