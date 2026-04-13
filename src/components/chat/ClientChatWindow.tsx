import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  job_id?: string;
  created_at: string;
  is_read: boolean;
  file_url?: string;
  file_name?: string;
}

interface SenderProfile {
  full_name?: string;
  avatar_url?: string;
}

interface ClientChatWindowProps {
  jobId?: string;
  adminId?: string;
}

const ClientChatWindow = ({ jobId, adminId }: ClientChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cachedAdminId, setCachedAdminId] = useState<string | null>(adminId || null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [senderProfiles, setSenderProfiles] = useState<Record<string, SenderProfile>>({});
  const fileRef = useRef<HTMLInputElement>(null);
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
      
      // Fetch messages - pass user directly to avoid stale state
      await fetchMessages(user);
      
      // Fetch and cache admin ID
      if (!cachedAdminId) {
        const { data: adminId, error: adminError } = await supabase
          .rpc('get_admin_for_messaging') as { data: string | null, error: any };
        
        if (adminError) {
          console.error('Error fetching admin:', adminError);
        } else if (adminId) {
          setCachedAdminId(adminId);
        }
      }

      // Set up real-time subscription after user is loaded
      // Remove filter to avoid WebSocket errors - RLS policies handle security
      const channelName = jobId 
        ? `client-messages-${user.id}-job-${jobId}`
        : `client-messages-${user.id}-general`;
      
      messagesChannel = supabase
        .channel(channelName)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'messages'
          },
          async () => {
            await fetchMessages(user);
          }
        )
        .subscribe();
      
      setLoading(false);
    };

    getUser();

    return () => {
      if (messagesChannel) {
        console.log('[ClientChat] Cleaning up channel');
        supabase.removeChannel(messagesChannel);
      }
    };
  }, [jobId, cachedAdminId]);

  const fetchMessages = async (currentUser?: any) => {
    try {
      const userToUse = currentUser || user;
      
      if (!userToUse?.id) {
        console.log('[ClientChat] No user ID, skipping fetch');
        return;
      }

      console.log('[ClientChat] Fetching messages for user:', userToUse.id, 'jobId:', jobId);

      let query = supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userToUse.id},recipient_id.eq.${userToUse.id}`);

      // If jobId is provided, filter by job_id, otherwise get messages without job_id (general chat)
      if (jobId) {
        query = query.eq('job_id', jobId);
      } else {
        query = query.is('job_id', null);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        console.error('[ClientChat] Error fetching messages:', error);
        return;
      }
      
      console.log('[ClientChat] Fetched messages:', data?.length || 0);
      setMessages((data as any) || []);

      // Mark unread messages as read
      const unreadMessages = (data as any)?.filter((m: Message) => 
        m.recipient_id === userToUse.id && !m.is_read
      );
      
      if (unreadMessages && unreadMessages.length > 0) {
        const messageIds = unreadMessages.map((m: Message) => m.id);
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', messageIds);
      }
      
      // Generate signed URLs for all file attachments and fetch sender profiles
      if (data) {
        const urlMapping: Record<string, string> = {};
        const profileMapping: Record<string, SenderProfile> = {};
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        
        // Fetch all sender profiles
        for (const senderId of senderIds) {
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('user_id', senderId)
              .single();
            
            if (profileError) {
              console.error('[ClientChat] Error fetching profile for sender:', senderId, profileError);
            } else if (profile) {
              console.log('[ClientChat] Fetched profile for sender:', senderId, profile);
              profileMapping[senderId] = profile;
            }
          } catch (err) {
            console.error('[ClientChat] Exception fetching profile for sender:', senderId, err);
          }
        }
        
        setSenderProfiles(profileMapping);
        
        for (const message of data) {
          if (message.file_url) {
            console.log('[ClientChat] Generating signed URL for:', message.file_url);
            try {
              const { data: signedData, error: signedError } = await supabase.storage
                .from('chat-files')
                .createSignedUrl(message.file_url, 3600); // 1 hour validity
              
              if (!signedError && signedData?.signedUrl) {
                urlMapping[message.file_url] = signedData.signedUrl;
                console.log('[ClientChat] Signed URL created successfully');
              } else {
                console.error('[ClientChat] Error creating signed URL:', signedError);
              }
            } catch (err) {
              console.error('[ClientChat] Exception creating signed URL:', err);
            }
          }
        }
        setFileUrls(urlMapping);
        console.log('[ClientChat] Total signed URLs created:', Object.keys(urlMapping).length);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    console.log('[ClientChat] Uploading file:', fileName, 'Size:', file.size);
    
    const { data, error } = await supabase.storage
      .from('chat-files')
      .upload(fileName, file);

    if (error) {
      console.error('[ClientChat] File upload error:', error);
      throw error;
    }
    
    console.log('[ClientChat] File uploaded successfully:', fileName);
    
    // Return the file path, not URL - we'll generate signed URLs when displaying
    return { url: fileName, name: file.name };
  };

  const sendMessage = async () => {
    if ((!text.trim() && !selectedFile) || !user) {
      console.log('[ClientChat] Cannot send - no text/file or no user');
      return;
    }

    try {
      setUploading(true);
      console.log('[ClientChat] Starting to send message...');

      // Fetch admin ID if not cached
      let recipientId = cachedAdminId;
      if (!recipientId) {
        console.log('[ClientChat] Fetching admin ID...');
        const { data: adminId, error: adminError } = await supabase
          .rpc('get_admin_for_messaging') as { data: string | null, error: any };
        
        if (adminError) {
          console.error('[ClientChat] Error fetching admin:', adminError);
          toast({ 
            title: "Error", 
            description: "Failed to get admin contact. Please try again.",
            variant: "destructive" 
          });
          setUploading(false);
          return;
        }
        
        if (!adminId) {
          console.error('[ClientChat] No admin found in database');
          toast({ 
            title: "Error", 
            description: "No admin available to receive message. Please try again.",
            variant: "destructive" 
          });
          setUploading(false);
          return;
        }
        
        recipientId = adminId;
        setCachedAdminId(recipientId);
        console.log('[ClientChat] Admin ID cached:', recipientId);
      }

      let fileUrl = null;
      let fileName = null;

      if (selectedFile) {
        console.log('[ClientChat] Uploading file...');
        const uploadResult = await uploadFile(selectedFile);
        fileUrl = uploadResult.url;
        fileName = uploadResult.name;
        console.log('[ClientChat] File uploaded:', fileUrl);
      }

      const messageData: any = {
        sender_id: user.id,
        recipient_id: recipientId,
        message: text || (selectedFile ? `Sent a file: ${selectedFile.name}` : ''),
        file_url: fileUrl,
        file_name: fileName,
      };

      // Only add job_id if it's provided
      if (jobId) {
        messageData.job_id = jobId;
      }

      console.log('[ClientChat] Inserting message:', messageData);
      const { error } = await supabase
        .from('messages')
        .insert(messageData);

      if (error) {
        console.error('[ClientChat] Message insert error:', error);
        throw error;
      }
      
      console.log('[ClientChat] Message sent successfully');
      setText("");
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      toast({ title: "Message sent successfully" });
    } catch (error) {
      console.error('[ClientChat] Send message error:', error);
      toast({ 
        title: "Error", 
        description: "Failed to send message",
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  const getAvatarUrl = (senderId: string) => {
    const profile = senderProfiles[senderId];
    if (!profile?.avatar_url) {
      console.log('[ClientChat] No avatar_url for sender:', senderId, 'Profile:', profile);
      return undefined;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(profile.avatar_url);
    
    console.log('[ClientChat] Avatar URL for sender:', senderId, 'URL:', publicUrl);
    return publicUrl;
  };

  const getSenderInitials = (senderId: string) => {
    const profile = senderProfiles[senderId];
    const name = profile?.full_name || 'User';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return <div className="animate-pulse h-72 bg-muted rounded-md"></div>;
  }

  return (
    <div className="grid gap-4">
      <div className="h-72 overflow-y-auto rounded-md border p-4 bg-background">
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={m.sender_id === user?.id ? "text-right" : "text-left"}>
              <div className={`flex gap-2 ${m.sender_id === user?.id ? "flex-row-reverse" : "flex-row"} items-end`}>
                <Avatar className="h-8 w-8" key={`${m.sender_id}-${senderProfiles[m.sender_id]?.avatar_url || 'no-avatar'}`}>
                  {senderProfiles[m.sender_id]?.avatar_url && <AvatarImage src={getAvatarUrl(m.sender_id)} alt={senderProfiles[m.sender_id]?.full_name || 'User'} />}
                  <AvatarFallback className="text-xs">{getSenderInitials(m.sender_id)}</AvatarFallback>
                </Avatar>
                <div className={`inline-block max-w-[85%] rounded-md border p-3 ${
                  m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}>
                  <p className="text-sm">{m.message}</p>
                  {m.file_url && fileUrls[m.file_url] && (
                    <div className="mt-2">
                      {m.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img 
                          src={fileUrls[m.file_url]} 
                          alt={m.file_name} 
                          className="max-w-full rounded border cursor-pointer hover:opacity-80"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = fileUrls[m.file_url];
                            link.download = m.file_name || 'download';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-xs underline hover:no-underline"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = fileUrls[m.file_url!];
                            link.download = m.file_name || 'download';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          📎 {m.file_name}
                        </Button>
                      )}
                    </div>
                  )}
                  <span className="block mt-1 text-[10px] opacity-70">
                    {new Date(m.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-2">
        {selectedFile && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>📎 {selectedFile.name}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedFile(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              ✕
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            📎
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message to the admin..."
            className="min-h-10"
            disabled={uploading}
          />
          <Button onClick={sendMessage} variant="default" disabled={uploading}>
            {uploading ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClientChatWindow;