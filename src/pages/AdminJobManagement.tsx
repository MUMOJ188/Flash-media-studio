import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Clock, CheckCircle, DollarSign, Edit, Bell, MessageSquare, Receipt, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminChatWindow from "@/components/chat/AdminChatWindow";
import { AdminInvoiceDialog } from "@/components/AdminInvoiceDialog";
import { PaymentReceipt } from "@/components/PaymentReceipt";

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
  client_id: string;
  file_url?: string;
}

interface Profile {
  full_name: string;
  email: string;
  phone: string;
}

interface JobWithClient extends Job {
  profiles?: Profile;
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

const statusIcon = (status: string) => {
  switch (status) {
    case "new": return <Package className="h-4 w-4" />;
    case "confirmed": return <CheckCircle className="h-4 w-4" />;
    case "in_progress": return <Clock className="h-4 w-4" />;
    case "awaiting_feedback": return <Bell className="h-4 w-4" />;
    case "completed": return <CheckCircle className="h-4 w-4" />;
    case "paid": return <DollarSign className="h-4 w-4" />;
    default: return <Package className="h-4 w-4" />;
  }
};

export default function AdminJobManagement() {
  const [jobs, setJobs] = useState<JobWithClient[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobWithClient[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<JobWithClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [invoiceDialog, setInvoiceDialog] = useState<{
    isOpen: boolean;
    jobId: string;
    jobTitle: string;
    clientName: string;
  }>({
    isOpen: false,
    jobId: "",
    jobTitle: "",
    clientName: "",
  });
  const [paymentHistoryDialog, setPaymentHistoryDialog] = useState<{
    isOpen: boolean;
    jobId: string;
    jobTitle: string;
  }>({
    isOpen: false,
    jobId: "",
    jobTitle: "",
  });
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
    fetchJobs();
    fetchUnreadCounts();

    // Set up real-time subscription
    const jobsChannel = supabase
      .channel('admin-jobs-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'jobs' },
        () => fetchJobs()
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('admin-messages-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchUnreadCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, []);

  useEffect(() => {
    if (statusFilter === "all") {
      setFilteredJobs(jobs);
    } else {
      setFilteredJobs(jobs.filter(job => job.status === statusFilter));
    }
  }, [jobs, statusFilter]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Use secure RPC function to check admin role
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (isAdmin !== true) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      toast({
        title: "Authentication Error",
        description: "Please log in as an admin to access this page.",
        variant: "destructive",
      });
    }
  };

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          profiles!jobs_client_id_fkey(full_name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs((data || []) as any);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch jobs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('messages')
        .select('job_id, is_read')
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((msg) => {
        if (msg.job_id) {
          counts[msg.job_id] = (counts[msg.job_id] || 0) + 1;
        }
      });

      setUnreadCounts(counts);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  const updateJobStatus = async (jobId: string, newStatus: string) => {
    setUpdating(jobId);
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Job status updated to ${newStatus.replace('_', ' ')}`,
      });

      if (newStatus === 'completed') {
        toast({
          title: "Notification Sent",
          description: "Client has been notified about job completion.",
        });
      }

      await fetchJobs();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update job status.",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const confirmPayment = async (jobId: string) => {
    setUpdating(jobId);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ 
          payment_confirmed: true,
          status: 'paid'
        })
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: "Payment Confirmed",
        description: "Payment has been marked as confirmed.",
      });

      await fetchJobs();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to confirm payment.",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const fetchPaymentHistory = async (jobId: string) => {
    setLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch payment history.",
        variant: "destructive",
      });
    } finally {
      setLoadingPayments(false);
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

  return (
    <>
      <Helmet>
        <title>Job Management - Flash Media Studios Admin</title>
        <meta name="description" content="Manage client jobs and orders for Flash Media Studios." />
      </Helmet>

      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Job Management</h1>
            <p className="text-muted-foreground">View and manage all client orders</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="new">New Requests</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="awaiting_feedback">Awaiting Feedback</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{jobs.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {jobs.filter(job => job.status === 'in_progress').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {jobs.filter(job => job.status === 'completed').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {jobs.filter(job => job.status === 'completed' && !job.payment_confirmed).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Jobs</CardTitle>
            <CardDescription>
              Manage client orders and update their progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{job.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {job.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{job.profiles?.full_name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">{job.profiles?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {job.type.charAt(0).toUpperCase() + job.type.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcon(job.status)}
                        <Badge variant={statusVariant(job.status)}>
                          {job.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={job.payment_confirmed ? "default" : "secondary"}>
                        {job.payment_confirmed ? "Confirmed" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {job.file_url ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const filePath = job.file_url!.split(',')[0];
                              const { data, error } = await supabase.storage
                                .from('job-files')
                                .createSignedUrl(filePath, 60);
                              
                              if (error) {
                                console.error("Error creating signed URL:", error);
                                throw error;
                              }
                              
                              if (data?.signedUrl) {
                                // Force download instead of opening
                                const link = document.createElement('a');
                                link.href = data.signedUrl;
                                link.download = filePath.split('/').pop() || 'download';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                toast({
                                  title: "Download started",
                                  description: "The file is being downloaded",
                                });
                              }
                            } catch (error) {
                              console.error("Download error:", error);
                              toast({
                                title: "Error",
                                description: "Failed to download file. Please check if the file exists.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          📎 Download File
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">No file</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(job.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedJob(job)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Manage Job: {selectedJob?.title}</DialogTitle>
                            <DialogDescription>
                              Update job status, confirm payment, or chat with the client.
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedJob && (
                            <Tabs defaultValue="status" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="status" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Job Status</TabsTrigger>
                                <TabsTrigger value="messages" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
                                  <MessageSquare className="h-4 w-4" />
                                  Messages
                                  {unreadCounts[selectedJob.id] > 0 && (
                                    <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                                      {unreadCounts[selectedJob.id]}
                                    </Badge>
                                  )}
                                </TabsTrigger>
                              </TabsList>
                              <TabsContent value="status" className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium">Update Status</label>
                                  <div className="grid grid-cols-2 gap-2 mt-2">
                                    {['new', 'confirmed', 'in_progress', 'awaiting_feedback', 'completed'].map((status) => (
                                      <Button
                                        key={status}
                                        variant={selectedJob.status === status ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => updateJobStatus(selectedJob.id, status)}
                                        disabled={updating === selectedJob.id}
                                      >
                                        {status.replace('_', ' ').toUpperCase()}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                                
                                {!selectedJob.payment_confirmed && (
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => confirmPayment(selectedJob.id)}
                                      disabled={updating === selectedJob.id}
                                      className="flex-1"
                                    >
                                      <DollarSign className="h-4 w-4 mr-2" />
                                      Confirm Payment
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => setInvoiceDialog({
                                        isOpen: true,
                                        jobId: selectedJob.id,
                                        jobTitle: selectedJob.title,
                                        clientName: selectedJob.profiles?.full_name || "Client",
                                      })}
                                      disabled={updating === selectedJob.id}
                                      className="flex-1"
                                    >
                                      <Receipt className="h-4 w-4 mr-2" />
                                      Send Invoice
                                    </Button>
                                  </div>
                                )}

                                 <div className="space-y-2 pt-4 border-t">
                                  <p><strong>Client:</strong> {selectedJob.profiles?.full_name || 'Unknown'}</p>
                                  <p><strong>Email:</strong> {selectedJob.profiles?.email}</p>
                                  <p><strong>Description:</strong> {selectedJob.description}</p>
                                  <p><strong>Created:</strong> {new Date(selectedJob.created_at).toLocaleDateString()}</p>
                                  {selectedJob.file_url && (
                                    <div className="space-y-2">
                                      <p><strong>Job Attachments:</strong></p>
                                      <div className="flex flex-wrap gap-2">
                                        {selectedJob.file_url.split(',').map((filePath, index) => {
                                          const fileName = filePath.split('/').pop();
                                          return (
                                            <Button
                                              key={index}
                                              variant="outline"
                                              size="sm"
                                              onClick={async () => {
                                                try {
                                                  const { data } = supabase.storage
                                                    .from('job-files')
                                                    .getPublicUrl(filePath);
                                                  
                                                  if (data.publicUrl) {
                                                    window.open(data.publicUrl, '_blank');
                                                  }
                                                } catch (error) {
                                                  toast({
                                                    title: "Error",
                                                    description: "Failed to download file",
                                                    variant: "destructive",
                                                  });
                                                }
                                              }}
                                            >
                                              📎 {fileName}
                                            </Button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TabsContent>
                              <TabsContent value="messages">
                                <AdminChatWindow jobId={selectedJob.id} clientId={selectedJob.client_id} />
                              </TabsContent>
                            </Tabs>
                          )}
                        </DialogContent>
                        </Dialog>
                        <Dialog
                          open={paymentHistoryDialog.isOpen && paymentHistoryDialog.jobId === job.id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setPaymentHistoryDialog({ isOpen: false, jobId: "", jobTitle: "" });
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPaymentHistoryDialog({
                                  isOpen: true,
                                  jobId: job.id,
                                  jobTitle: job.title,
                                });
                                fetchPaymentHistory(job.id);
                              }}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Payment History: {paymentHistoryDialog.jobTitle}</DialogTitle>
                              <DialogDescription>
                                View all payment receipts for this job
                              </DialogDescription>
                            </DialogHeader>
                            
                            {loadingPayments ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                              </div>
                            ) : payments.length === 0 ? (
                              <div className="text-center py-8">
                                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium mb-2">No Payments Found</h3>
                                <p className="text-muted-foreground">
                                  No payment records exist for this job yet.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {payments.map((payment) => (
                                  <PaymentReceipt
                                    key={payment.id}
                                    amount={payment.amount}
                                    receiptNumber={payment.mpesa_receipt_number || payment.id}
                                    transactionDate={payment.created_at}
                                    phoneNumber={payment.phone_number}
                                    status={payment.status}
                                    jobTitle={paymentHistoryDialog.jobTitle}
                                  />
                                ))}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredJobs.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Jobs Found</h3>
                <p className="text-muted-foreground">
                  {statusFilter === "all" 
                    ? "No jobs have been submitted yet." 
                    : `No jobs with status "${statusFilter.replace('_', ' ')}" found.`
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <AdminInvoiceDialog
          isOpen={invoiceDialog.isOpen}
          onClose={() => setInvoiceDialog(prev => ({ ...prev, isOpen: false }))}
          jobId={invoiceDialog.jobId}
          jobTitle={invoiceDialog.jobTitle}
          clientName={invoiceDialog.clientName}
        />
      </div>
    </>
  );
}
