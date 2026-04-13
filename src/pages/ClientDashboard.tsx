import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ClientChatWindow from "@/components/chat/ClientChatWindow";
import ClientOrderTracking from "./ClientOrderTracking";
import ClientPaymentHistory from "./ClientPaymentHistory";

const JOB_TYPES = ["Graphic Design", "Logo Design", "Poster Design", "Other"] as const;

const jobFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(JOB_TYPES),
});

type JobFormData = z.infer<typeof jobFormSchema>;

const ClientDashboard = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileList | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [showChat, setShowChat] = useState(false);

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "Other",
    },
  });

  // Fetch unread message count
  const fetchUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadMessageCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Set up realtime subscription for messages
  useEffect(() => {
    fetchUnreadCount();

    const messagesChannel = supabase
      .channel('client-messages-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadedFiles(e.target.files);
  };

  const uploadFiles = async (userId: string, jobId: string, files: FileList): Promise<string[]> => {
    const uploadPromises = Array.from(files).map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${jobId}_${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('job-files')
        .upload(fileName, file);

      if (error) {
        console.error('File upload error:', error);
        throw error;
      }
      return data.path;
    });

    return Promise.all(uploadPromises);
  };

  const onSubmit = async (data: JobFormData) => {
    try {
      setIsSubmitting(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to submit a job.",
          variant: "destructive",
        });
        return;
      }

      // Create the job record
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          title: data.title,
          description: data.description,
          type: data.type,
          client_id: user.id,
          status: 'new',
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Upload files if any
      let filePaths: string[] = [];
      if (uploadedFiles && uploadedFiles.length > 0) {
        filePaths = await uploadFiles(user.id, job.id, uploadedFiles);
        
        // Update job with file URLs
        if (filePaths.length > 0) {
          const { error: updateError } = await supabase
            .from('jobs')
            .update({ file_url: filePaths.join(',') })
            .eq('id', job.id);

          if (updateError) {
            console.error('Error updating job with file URLs:', updateError);
            throw updateError;
          }
        }
      }

      toast({
        title: "Job submitted successfully!",
        description: `Your job "${data.title}" has been submitted and will be reviewed shortly.`,
      });

      // Reset form
      form.reset();
      setUploadedFiles(null);
      // Reset file input
      const fileInput = document.getElementById('files') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Error submitting job:', error);
      toast({
        title: "Error submitting job",
        description: "There was an error submitting your job. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const initiateMpesa = async (jobId: string, amount: number, phoneNumber: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: { jobId, amount, phoneNumber }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "STK Push Sent",
          description: "Please check your phone to complete the payment.",
        });
      } else {
        throw new Error(data?.error || 'Failed to initiate payment');
      }
    } catch (error) {
      console.error('Error initiating M-Pesa payment:', error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="container mx-auto py-8 space-y-8">
      <Helmet>
        <title>Client Dashboard | M-Pesa Flow Connect</title>
        <meta name="description" content="Submit orders, chat with admin, and pay via M-Pesa." />
        <link rel="canonical" href="/client/dashboard" />
      </Helmet>

      {unreadMessageCount > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-semibold">
                  {unreadMessageCount}
                </div>
                <p className="text-sm font-medium">
                  You have {unreadMessageCount} new message{unreadMessageCount > 1 ? 's' : ''} from admin
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  // Mark all unread messages as read
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      const { data: unreadMessages } = await supabase
                        .from('messages')
                        .select('id')
                        .eq('recipient_id', user.id)
                        .eq('is_read', false);
                      
                      if (unreadMessages && unreadMessages.length > 0) {
                        const messageIds = unreadMessages.map(m => m.id);
                        await supabase
                          .from('messages')
                          .update({ is_read: true })
                          .in('id', messageIds);
                      }
                    }
                  } catch (error) {
                    console.error('Error marking messages as read:', error);
                  }
                  setShowChat(true);
                }}
              >
                View Messages
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Dashboard</TabsTrigger>
          <TabsTrigger value="track-orders" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Track Orders</TabsTrigger>
          <TabsTrigger value="payment-history" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Payment History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-8">
          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Submit Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Logo design for my company" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select job type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {JOB_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Details</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the job requirements, deadline, and any specific instructions..."
                              className="min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="space-y-2">
                      <Label htmlFor="files">Attachments</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          id="files" 
                          type="file" 
                          multiple 
                          onChange={handleFileChange}
                          className="cursor-pointer"
                        />
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {uploadedFiles && uploadedFiles.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {uploadedFiles.length} file(s) selected
                        </p>
                      )}
                    </div>
                    
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Job'
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Track your balance and pay securely via M-Pesa.</p>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => {
                      // For demo - would typically get these from a form or job selection
                      toast({
                        title: "Select a Job",
                        description: "Please go to Track Orders to pay for specific jobs.",
                      });
                    }} 
                    variant="hero"
                  >
                    Pay via M-Pesa
                  </Button>
                  <Button variant="outline">View Payment History</Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="rounded-lg border p-6 bg-card shadow-sm" ref={(el) => {
            if (showChat && el) {
              el.scrollIntoView({ behavior: 'smooth' });
              setShowChat(false);
            }
          }}>
            <h2 className="text-xl font-semibold mb-4">Chat with Admin</h2>
            <ClientChatWindow />
          </section>
        </TabsContent>
        
        <TabsContent value="track-orders">
          <ClientOrderTracking />
        </TabsContent>

        <TabsContent value="payment-history">
          <ClientPaymentHistory />
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default ClientDashboard;
