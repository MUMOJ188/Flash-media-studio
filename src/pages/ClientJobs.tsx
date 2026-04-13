import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText } from "lucide-react";

const ClientJobs = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to client order tracking page
    navigate("/client/track-orders", { replace: true });
  }, [navigate]);

  return (
    <>
      <Helmet>
        <title>Redirecting to Order Tracking - Flash Media Studios</title>
        <meta name="description" content="Redirecting to order tracking page for Flash Media Studios clients." />
      </Helmet>

      <div className="container mx-auto p-6 space-y-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Redirecting...</CardTitle>
            <CardDescription>
              Taking you to your order tracking page
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => navigate("/client/track-orders")}
              className="w-full"
            >
              Go to Order Tracking
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ClientJobs;