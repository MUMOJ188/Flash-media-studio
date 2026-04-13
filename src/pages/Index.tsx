import kenyaFlag from "@/assets/kenya-flag.jpg";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/nasa3.png";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <main>
      <Helmet>
        <title>Flash Media Studios | Nyeri, Kenya — Jobs & Payments</title>
        <meta name="description" content="Modern client job management for Flash Media Studios in Nyeri. Submit requests, track status, chat, and pay via M-Pesa." />
        <link rel="canonical" href="/" />
      </Helmet>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[var(--gradient-surface)]" aria-hidden />
        <div className="container mx-auto grid gap-8 py-20 md:grid-cols-2 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight flex items-center gap-2">
              <img
               src={kenyaFlag}
               alt="Kenya flag"
               className="inline-block h-8 w-8 rounded-sm"
               style={{ objectFit: "cover" }}
            />
             Flash Media Studios - Nyeri, Kenya
             </h1>
            <p className="text-lg text-muted-foreground max-w-prose">
              A mobile-friendly portal for clients and staff to submit design jobs, track progress, review drafts, chat, and complete secure M-Pesa payments.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="hero" className="transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5">
                <Link to="/auth">Get Started</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <img
              src={heroImage}
              alt="M-Pesa payment workflow illustration with mobile screens and secure confirmation"
              loading="lazy"
              className="w-full rounded-lg shadow-[var(--shadow-elevate)]"
            />
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(1200px_300px_at_20%_-20%,hsl(var(--primary)/0.12),transparent),radial-gradient(1200px_300px_at_80%_-20%,hsl(var(--primary-glow)/0.14),transparent)]" />
          </div>
        </div>
      </section>
      <section className="border-t">
        <div className="container mx-auto py-12 grid gap-6 md:grid-cols-3">
          <Feature title="Secure Payments" description="STK Push with callbacks for instant confirmations." />
          <Feature title="Real-time Chat" description="1-to-1 messaging with image/file sharing for clarity." />
          <Feature title="Order Tracking" description="From request to completion with status updates." />
        </div>
      </section>
    </main>
  );
};

const Feature = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-lg border p-6 bg-card shadow-sm">
    <h3 className="text-lg font-semibold">{title}</h3>
    <p className="text-sm text-muted-foreground mt-2">{description}</p>
  </div>
);

export default Index;
