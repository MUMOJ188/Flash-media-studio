import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import ClientChatWindow from "@/components/chat/ClientChatWindow";
import { JobPaymentDialog } from "@/components/JobPaymentDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Package, 
  XCircle,
  DollarSign,
  Bell
} from "lucide-react";

interface Job {
  id: string;
  title: string;
  type: string;
  description: string;
  status: string;
  deadline: string;
  created_at: string;
  updated_at: string;
  payment_confirmed: boolean;
  payment_status: string;
  invoice_amount?: number;
  invoices?: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const statusVariant = (status: string) => {
  switch (status) {
    case "new": return "secondary";
    case "confirmed": return "outline";
    case "in_progress": return "default";
    case "awaiting_feedback": return "outline";
    case "completed": return "default";
    case "paid": return "default";
    default: return "secondary";
  }
};

const statusProgress = (status: string) => {
  switch (status) {
    case "new": return 10;
    case "confirmed": return 25;
    case "in_progress": return 50;
    case "awaiting_feedback": return 75;
    case "completed": return 100;
    case "paid": return 100;
    default: return 0;
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case "new": return <Package className="h-4 w-4" />;
    case "confirmed": return <CheckCircle className="h-4 w-4" />;
    case "in_progress": return <Clock className="h-4 w-4" />;
    case "awaiting_feedback": return <AlertCircle className="h-4 w-4" />;
    case "completed": return <CheckCircle className="h-4 w-4" />;
    case "paid": return <CheckCircle className="h-4 w-4" />;
    default: return <XCircle className="h-4 w-4" />;
  }
};

const ClientOrderTracking = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentDialog, setPaymentDialog] = useState<{
    isOpen: boolean;
    jobId: string;
    jobTitle: string;
    amount: number;
  }>({
    isOpen: false,
    jobId: "",
    jobTitle: "",
    amount: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        await fetchJobs();
        await fetchNotifications();
      }
      setLoading(false);
    };

    getUser();

    const jobsSubscription = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs'
        },
        () => fetchJobs()
      )
      .subscribe();

    const notificationsSubscription = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsSubscription);
      supabase.removeChannel(notificationsSubscription);
    };
  }, []);

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        invoices (
          id,
          amount,
          status,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch jobs",
        variant: "destructive",
      });
    } else {
      setJobs(data || []);
    }
  };

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching notifications:', error);
    } else {
      setNotifications(data || []);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please log in to view your orders.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Track Orders | Flash Media Studios</title>
        <meta name="description" content="Track your job orders and communicate with our team." />
        <link rel="canonical" href="/client/orders" />
      </Helmet>

      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Orders</h1>
            <p className="text-muted-foreground">Track progress and manage your jobs</p>
          </div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{notifications.filter(n => !n.read).length} new</span>
          </div>
        </div>

        {notifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {notifications.slice(0, 3).map((notification) => (
                  <div key={notification.id} className={`p-3 rounded-md border ${!notification.read ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'}`}>
                    <h4 className="font-medium">{notification.title}</h4>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6">
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No orders found. Submit a job to get started!</p>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => (
              <Card key={job.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {statusIcon(job.status)}
                      {job.title}
                    </CardTitle>
                    <Badge variant={statusVariant(job.status)}>
                      {job.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <CardDescription>{job.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress</span>
                        <span>{statusProgress(job.status)}%</span>
                      </div>
                      <Progress value={statusProgress(job.status)} className="w-full" />
                    </div>
                    
                    <Tabs defaultValue="details" className="w-full">
                      <TabsList>
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger 
                          value="messages"
                          onClick={async () => {
                            // Mark messages for this job as read when tab is clicked
                            try {
                              const { data: { user } } = await supabase.auth.getUser();
                              if (user) {
                                const { data: unreadMessages } = await supabase
                                  .from('messages')
                                  .select('id')
                                  .eq('recipient_id', user.id)
                                  .eq('job_id', job.id)
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
                          }}
                        >
                          Messages
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="details" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Type:</span>
                            <p className="font-medium">{job.type}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <p>{job.status.replace('_', ' ')}</p>
                          </div>
                          {job.deadline && (
                            <div>
                              <span className="text-muted-foreground">Deadline:</span>
                              <p>{new Date(job.deadline).toLocaleDateString()}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Last Updated:</span>
                            <p>{new Date(job.updated_at).toLocaleDateString()}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Payment:</span>
                            <div className="flex items-center gap-2 mt-1">
                              <p className={job.payment_confirmed ? "text-green-600" : "text-yellow-600"}>
                                {job.payment_confirmed ? "Confirmed" : "Pending"}
                              </p>
                              {!job.payment_confirmed && job.payment_status === 'invoice_sent' && job.invoices && job.invoices.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">
                                    Invoice: KES {job.invoices[0].amount}
                                  </span>
                                  <Button
                                    size="sm"
                                    onClick={() => setPaymentDialog({
                                      isOpen: true,
                                      jobId: job.id,
                                      jobTitle: job.title,
                                      amount: job.invoices[0].amount,
                                    })}
                                    className="ml-2"
                                  >
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Pay KES {job.invoices[0].amount}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      <TabsContent value="messages">
                        <ClientChatWindow jobId={job.id} />
                      </TabsContent>
                    </Tabs>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        
        <JobPaymentDialog
          isOpen={paymentDialog.isOpen}
          onClose={() => setPaymentDialog(prev => ({ ...prev, isOpen: false }))}
          jobId={paymentDialog.jobId}
          jobTitle={paymentDialog.jobTitle}
          amount={paymentDialog.amount}
        />
      </div>
    </>
  );
};

export default ClientOrderTracking;