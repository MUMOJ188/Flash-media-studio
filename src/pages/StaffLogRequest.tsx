import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const StaffLogRequest = () => {
  const { toast } = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast({ title: "Request logged (demo)", description: "Connect Supabase to store jobs and notify clients." });
    (e.currentTarget as HTMLFormElement).reset();
  };

  return (
    <main className="container mx-auto py-8">
      <Helmet>
        <title>Staff: Log Request | Flash Media Studios</title>
        <meta name="description" content="Log requests received via email, WhatsApp, or in-person into the system." />
        <link rel="canonical" href="/staff/log-request" />
      </Helmet>

      <section className="mx-auto max-w-2xl rounded-lg border p-6 bg-card shadow-sm">
        <h1 className="text-2xl font-semibold mb-6">Log a New Client Request</h1>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="channel">Channel</Label>
              <Select>
                <SelectTrigger id="channel"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="in-person">In-person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client Name</Label>
              <Input id="client" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact (Email/Phone)</Label>
              <Input id="contact" required />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="type">Request Type</Label>
              <Select>
                <SelectTrigger id="type"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Poster">Poster</SelectItem>
                  <SelectItem value="Logo">Logo</SelectItem>
                  <SelectItem value="Branding">Branding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" required placeholder="e.g., Rebrand for Flash Transport" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" required placeholder="Key details, objectives, references, and deliverables." />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input id="deadline" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="files">Attachments</Label>
              <Input id="files" type="file" multiple />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="hero">Log Request</Button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default StaffLogRequest;
