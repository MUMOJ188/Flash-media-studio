import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FolderOpen, Users, FileText, Plus, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import StaffChatInterface from "@/components/chat/StaffChatInterface";

const AdminDashboard = () => {
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const { toast } = useToast();

  const generateFullSystemReport = async () => {
    try {
      toast({ title: "Generating full system report...", description: "This may take a moment" });

      // Fetch ALL data from database (no date filtering)
      const { data: allJobs } = await supabase
        .from('jobs')
        .select('*, service_id');

      const { data: allPayments } = await supabase
        .from('payments')
        .select('*');

      const { data: allClients } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin');

      const { data: services } = await supabase
        .from('services')
        .select('*');

      // Calculate comprehensive statistics
      const totalClients = allClients?.length || 0;
      const totalJobs = allJobs?.length || 0;
      const completedJobs = allJobs?.filter(j => j.status === 'completed').length || 0;
      const pendingJobs = allJobs?.filter(j => j.status === 'in_progress' || j.status === 'new').length || 0;
      const cancelledJobs = allJobs?.filter(j => j.status === 'cancelled').length || 0;
      
      const totalRevenue = allPayments?.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const outstandingPayments = allJobs?.filter(j => !j.payment_confirmed).reduce((sum, j) => sum + Number(j.invoice_amount || 0), 0) || 0;
      
      // Most requested service
      const serviceCounts: Record<string, number> = {};
      allJobs?.forEach(job => {
        if (job.service_id) {
          serviceCounts[job.service_id] = (serviceCounts[job.service_id] || 0) + 1;
        }
      });
      const mostRequestedServiceId = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const mostRequestedService = services?.find(s => s.id === mostRequestedServiceId)?.name || 'N/A';

      // Get date range
      const oldestDate = allJobs?.reduce((oldest, job) => {
        const jobDate = new Date(job.created_at);
        return jobDate < oldest ? jobDate : oldest;
      }, new Date()) || new Date();
      
      const startDate = oldestDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const endDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      // Clients per month
      const clientsByMonth: Record<string, number> = {};
      allClients?.forEach(client => {
        const monthYear = new Date(client.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        clientsByMonth[monthYear] = (clientsByMonth[monthYear] || 0) + 1;
      });

      // Jobs per month
      const jobsByMonth: Record<string, number> = {};
      allJobs?.forEach(job => {
        const monthYear = new Date(job.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        jobsByMonth[monthYear] = (jobsByMonth[monthYear] || 0) + 1;
      });

      // Revenue per month
      const revenueByMonth: Record<string, number> = {};
      allPayments?.filter(p => p.status === 'completed').forEach(payment => {
        const monthYear = new Date(payment.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        revenueByMonth[monthYear] = (revenueByMonth[monthYear] || 0) + Number(payment.amount);
      });

      // Revenue per service
      const revenueByService: Record<string, number> = {};
      allJobs?.forEach(job => {
        if (job.service_id && job.payment_confirmed) {
          const serviceName = services?.find(s => s.id === job.service_id)?.name || 'Unknown';
          revenueByService[serviceName] = (revenueByService[serviceName] || 0) + Number(job.invoice_amount || 0);
        }
      });

      // Top clients by bookings
      const clientBookings: Record<string, number> = {};
      allJobs?.forEach(job => {
        const clientName = allClients?.find(c => c.user_id === job.client_id)?.full_name || 'Unknown';
        clientBookings[clientName] = (clientBookings[clientName] || 0) + 1;
      });
      const topClients = Object.entries(clientBookings).sort((a, b) => b[1] - a[1]).slice(0, 5);

      // Generate PDF
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      let currentY = 20;
      
      // Header
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('FLASH MEDIA STUDIOS - SYSTEM REPORT', pageWidth / 2, currentY, { align: 'center' });
      
      currentY += 15;
      pdf.setFontSize(18);
      pdf.text('Full System Report', pageWidth / 2, currentY, { align: 'center' });
      
      currentY += 10;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, pageWidth / 2, currentY, { align: 'center' });
      
      currentY += 7;
      pdf.text(`Period: ${startDate} - ${endDate}`, pageWidth / 2, currentY, { align: 'center' });

      currentY += 10;

      // Executive Summary
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Executive Summary', 14, currentY);
      
      currentY += 5;
      autoTable(pdf, {
        startY: currentY,
        head: [['Metric', 'Value']],
        body: [
          ['Total Clients Registered', totalClients.toString()],
          ['Total Jobs Created', totalJobs.toString()],
          ['Total Revenue Collected', `KES ${totalRevenue.toLocaleString()}`],
          ['Total Outstanding Balances', `KES ${outstandingPayments.toLocaleString()}`],
          ['Most Requested Service', mostRequestedService],
        ],
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;

      // Client Statistics
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Client Statistics', 14, currentY);
      
      currentY += 5;
      autoTable(pdf, {
        startY: currentY,
        head: [['Month', 'New Clients']],
        body: Object.entries(clientsByMonth).map(([month, count]) => [month, count.toString()]),
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;

      // Top Clients
      if (currentY > 250) {
        pdf.addPage();
        currentY = 20;
      }
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Top Clients by Bookings', 14, currentY);
      
      currentY += 5;
      autoTable(pdf, {
        startY: currentY,
        head: [['Client Name', 'Total Bookings']],
        body: topClients.map(([name, count]) => [name, count.toString()]),
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;

      // Job Statistics
      if (currentY > 250) {
        pdf.addPage();
        currentY = 20;
      }
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Job / Booking Statistics', 14, currentY);
      
      currentY += 5;
      autoTable(pdf, {
        startY: currentY,
        head: [['Status', 'Count']],
        body: [
          ['Total Jobs', totalJobs.toString()],
          ['Completed', completedJobs.toString()],
          ['Pending', pendingJobs.toString()],
          ['Cancelled', cancelledJobs.toString()],
        ],
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;

      // Jobs Per Month
      if (currentY > 220) {
        pdf.addPage();
        currentY = 20;
      }
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Jobs Per Month', 14, currentY);
      
      currentY += 5;
      autoTable(pdf, {
        startY: currentY,
        head: [['Month', 'Jobs Created']],
        body: Object.entries(jobsByMonth).map(([month, count]) => [month, count.toString()]),
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;

      // Financial Summary
      if (currentY > 220) {
        pdf.addPage();
        currentY = 20;
      }
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Financial Summary', 14, currentY);
      
      currentY += 5;
      autoTable(pdf, {
        startY: currentY,
        head: [['Month', 'Revenue (KES)']],
        body: Object.entries(revenueByMonth).map(([month, amount]) => [month, amount.toLocaleString()]),
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;

      // Revenue Per Service
      if (currentY > 220) {
        pdf.addPage();
        currentY = 20;
      }
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Revenue Per Service Type', 14, currentY);
      
      currentY += 5;
      autoTable(pdf, {
        startY: currentY,
        head: [['Service', 'Revenue (KES)']],
        body: Object.entries(revenueByService).map(([service, amount]) => [service, amount.toLocaleString()]),
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
      });

      // Footer
      const finalY = (pdf as any).lastAutoTable.finalY || 150;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Flash Media Studios', 14, finalY + 20);
      pdf.text('Contact: info@flashmediastudios.co.ke', 14, finalY + 26);
      pdf.text('Phone: +254 XXX XXX XXX', 14, finalY + 32);
      
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Generated by Flash Media Studios System', pageWidth / 2, finalY + 48, { align: 'center' });
      pdf.text(`Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, pageWidth / 2, finalY + 54, { align: 'center' });
      
      pdf.setTextColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.line(14, finalY + 68, 90, finalY + 68);
      
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Authorized Signature', 14, finalY + 74);

      // Download
      const fileName = `full_system_report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      setReportsDialogOpen(false);
      toast({ title: "Report generated successfully", description: `Downloaded ${fileName}` });
    } catch (error) {
      console.error('Error generating full system report:', error);
      toast({ title: "Error", description: "Failed to generate full system report", variant: "destructive" });
    }
  };

  const generateReport = async (type: 'daily' | 'weekly' | 'monthly') => {
    try {
      toast({ title: "Generating report...", description: "Please wait" });

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      let periodText: string;

      if (type === 'daily') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
        periodText = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      } else if (type === 'weekly') {
        startDate = new Date(now.setDate(now.getDate() - 7));
        const endDate = new Date();
        periodText = `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date();
        periodText = `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }

      // Fetch data from database
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*, service_id')
        .gte('created_at', startDate.toISOString());

      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .gte('created_at', startDate.toISOString());

      const { data: newClients } = await supabase
        .from('profiles')
        .select('*')
        .gte('created_at', startDate.toISOString());

      const { data: services } = await supabase
        .from('services')
        .select('*');

      // Calculate statistics
      const totalBookings = jobs?.length || 0;
      const completedBookings = jobs?.filter(j => j.status === 'completed').length || 0;
      const pendingBookings = jobs?.filter(j => j.status === 'in_progress' || j.status === 'new').length || 0;
      const cancelledBookings = jobs?.filter(j => j.status === 'cancelled').length || 0;
      
      const totalRevenue = payments?.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const outstandingPayments = jobs?.filter(j => !j.payment_confirmed).reduce((sum, j) => sum + Number(j.invoice_amount || 0), 0) || 0;
      
      const newClientsCount = newClients?.length || 0;

      // Find most requested service
      const serviceCounts: Record<string, number> = {};
      jobs?.forEach(job => {
        if (job.service_id) {
          serviceCounts[job.service_id] = (serviceCounts[job.service_id] || 0) + 1;
        }
      });
      const mostRequestedServiceId = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const mostRequestedService = services?.find(s => s.id === mostRequestedServiceId)?.name || 'N/A';

      // Generate PDF
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Header
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('FLASH MEDIA STUDIOS', pageWidth / 2, 20, { align: 'center' });
      
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      const reportTypeText = type === 'daily' ? 'Daily Report' : type === 'weekly' ? 'Weekly Report' : 'Monthly Report';
      pdf.text(reportTypeText, pageWidth / 2, 35, { align: 'center' });
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, pageWidth / 2, 45, { align: 'center' });
      pdf.text(`Period: ${periodText}`, pageWidth / 2, 52, { align: 'center' });

      // Summary Highlights
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary Highlights', 14, 60);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      autoTable(pdf, {
        startY: 65,
        head: [['Metric', 'Value']],
        body: [
          ['Total Bookings', totalBookings.toString()],
          ['Completed Bookings', completedBookings.toString()],
          ['Pending Bookings', pendingBookings.toString()],
          ['Cancelled Bookings', cancelledBookings.toString()],
          ['Total Revenue Collected', `KES ${totalRevenue.toLocaleString()}`],
          ['Total Outstanding Payments', `KES ${outstandingPayments.toLocaleString()}`],
          ['Number of New Clients', newClientsCount.toString()],
          ['Most Requested Service', mostRequestedService],
        ],
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
      });

      // Footer
      const finalY = (pdf as any).lastAutoTable.finalY || 150;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Flash Media Studios', 14, finalY + 20);
      pdf.text('Contact: info@flashmediastudios.co.ke', 14, finalY + 26);
      pdf.text('Phone: +254 XXX XXX XXX', 14, finalY + 32);
      
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Generated by Flash Media Studios System', pageWidth / 2, finalY + 48, { align: 'center' });
      pdf.text(`Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, pageWidth / 2, finalY + 54, { align: 'center' });
      
      pdf.setTextColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.line(14, finalY + 68, 90, finalY + 68);
      
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Authorized Signature', 14, finalY + 74);

      // Download
      const fileName = `${type}_report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      setReportsDialogOpen(false);
      toast({ title: "Report generated successfully", description: `Downloaded ${fileName}` });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    }
  };

  return (
    <main className="container mx-auto py-8 space-y-8">
      <Helmet>
        <title>Staff Dashboard | Flash Media Studios</title>
        <meta name="description" content="Manage client jobs, track orders, and handle requests at Flash Media Studios." />
        <link rel="canonical" href="/staff/dashboard" />
      </Helmet>

      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Staff Dashboard</h1>
            <p className="text-muted-foreground">Manage client orders and studio operations</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Overview</TabsTrigger>
              <TabsTrigger value="messages" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Messages</TabsTrigger>
              <TabsTrigger value="actions" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Quick Actions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Job Management
              </CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  View and manage all client jobs, update status, and confirm payments.
                </p>
                <Button asChild className="w-full">
                  <Link to="/staff/manage-jobs">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Manage Jobs
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Log New Request
              </CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Manually log requests received via email, WhatsApp, or in-person.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/staff/log-request">
                    <Plus className="mr-2 h-4 w-4" />
                    Log Request
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Client Management
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  View client profiles, contact information, and order history.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/staff/clients">
                    <Users className="mr-2 h-4 w-4" />
                    View Clients
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Reports
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Generate and download detailed business reports for various time periods.
                </p>
                <Dialog open={reportsDialogOpen} onOpenChange={setReportsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download Reports
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Download Report</DialogTitle>
                      <DialogDescription>
                        Select a report type to generate and download as PDF
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                      <Button 
                        onClick={() => generateReport('daily')} 
                        className="w-full"
                        variant="outline"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Download Today's Report
                      </Button>
                      <Button 
                        onClick={() => generateReport('weekly')} 
                        className="w-full"
                        variant="outline"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Download Weekly Report
                      </Button>
                      <Button 
                        onClick={() => generateReport('monthly')} 
                        className="w-full"
                        variant="outline"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Download Monthly Report
                      </Button>
                      <Button 
                        onClick={generateFullSystemReport} 
                        className="w-full"
                        variant="outline"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Download Full System Report
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>
          </TabsContent>
          
          <TabsContent value="messages">
            <StaffChatInterface />
          </TabsContent>
          
          <TabsContent value="actions">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common tasks and shortcuts for managing Flash Media Studios operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Active Jobs</h3>
                      <p className="text-sm text-muted-foreground">Jobs currently in progress</p>
                    </div>
                    <Button asChild size="sm">
                      <Link to="/staff/manage-jobs?status=in_progress">View Active</Link>
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Pending Payments</h3>
                      <p className="text-sm text-muted-foreground">Jobs awaiting payment confirmation</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/staff/manage-jobs?status=completed">View Pending</Link>
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">New Requests</h3>
                      <p className="text-sm text-muted-foreground">Recently submitted job requests</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/staff/manage-jobs?status=new">View New</Link>
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Manual Entry</h3>
                      <p className="text-sm text-muted-foreground">Log offline requests</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/staff/log-request">Log Request</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

export default AdminDashboard;
