import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users } from "lucide-react";
import { BookingsPage } from "@/components/crm/BookingsPanel";
import { CustomersPage } from "@/components/crm/CustomersPanel";
import { PageHeader } from "@/components/shell/PageHeader";

const searchSchema = z.object({
  tab: z.enum(["bookings", "customers"]).catch("bookings").default("bookings"),
});

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM · Holaweb Business OS" }] }),
  validateSearch: searchSchema,
  component: CrmPage,
});

function CrmPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      <PageHeader
        title="CRM"
        description="Bookings and customers in one place."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as "bookings" | "customers" } })}
      >
        <TabsList>
          <TabsTrigger value="bookings"><Calendar className="h-3.5 w-3.5 mr-1.5" /> Bookings</TabsTrigger>
          <TabsTrigger value="customers"><Users className="h-3.5 w-3.5 mr-1.5" /> Customers</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings" className="mt-4"><BookingsPage /></TabsContent>
        <TabsContent value="customers" className="mt-4"><CustomersPage /></TabsContent>
      </Tabs>
    </div>
  );
}
