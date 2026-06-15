import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { COUNTRIES, INDUSTRIES, DEFAULT_BUSINESS_HOURS, DAYS, getCurrencyForCountry } from "@/lib/constants";
import holawebLogo from "@/assets/holaweb-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_auth_id", data.session.user.id)
        .maybeSingle();
      if (userRow) throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-accent/40 px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 justify-center mb-8">
          <img src={holawebLogo.url} alt="Holaweb" className="h-40 w-auto" />
          <span className="font-subhead text-sm uppercase tracking-[0.18em] text-muted-foreground">Business OS</span>
        </div>
        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Get started</TabsTrigger>
          </TabsList>
          <TabsContent value="signin"><SignInCard /></TabsContent>
          <TabsContent value="signup"><SignUpWizard /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, "Password is required"),
});

function SignInCard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof signInSchema>) {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  }

  async function onGoogle() {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setGoogleLoading(false);
      return toast.error((result.error as Error).message ?? "Google sign-in failed");
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your Holaweb workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-xs text-danger">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-xs text-danger">{form.formState.errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
          </Button>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={onGoogle} disabled={googleLoading}>
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Continue with Google
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
  );
}

// --- 5-step Sign Up Wizard ---
const step1Schema = z.object({
  business_name: z.string().trim().min(2, "Business name required").max(120),
  industry: z.string().min(1, "Pick an industry"),
  country_code: z.string().min(2),
});
const step2Schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Min 8 characters"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });
const step3Schema = z.object({
  whatsapp_number: z.string().trim().max(40).optional().or(z.literal("")),
  wa_number_id: z.string().trim().max(80).optional().or(z.literal("")),
});
const step5Schema = z.object({
  service_name: z.string().trim().min(2).max(120),
  price: z.coerce.number().min(0),
});

type WizardData = {
  step1: z.infer<typeof step1Schema>;
  step2: z.infer<typeof step2Schema>;
  step3: z.infer<typeof step3Schema>;
  hours: typeof DEFAULT_BUSINESS_HOURS;
  step5: z.infer<typeof step5Schema>;
};

function SignUpWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Partial<WizardData>>({ hours: DEFAULT_BUSINESS_HOURS });
  const [submitting, setSubmitting] = useState(false);

  async function finalize(d: WizardData) {
    setSubmitting(true);
    try {
      const country = COUNTRIES.find((c) => c.code === d.step1.country_code)!;
      const { data: signUp, error: sErr } = await supabase.auth.signUp({
        email: d.step2.email,
        password: d.step2.password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: d.step2.full_name } },
      });
      if (sErr) throw sErr;
      const authUserId = signUp.user?.id;
      if (!authUserId) throw new Error("Account created — please check your email to verify, then sign in.");

      // If email confirmation is enabled, session may be null. Try sign-in to get RLS context.
      if (!signUp.session) {
        const { error: siErr } = await supabase.auth.signInWithPassword({ email: d.step2.email, password: d.step2.password });
        if (siErr) throw siErr;
      }

      // Whitelisted internal emails: attach to Holaweb HQ admin workspace
      const WHITELIST = ["holaweb.africa@gmail.com", "k37.ings@gmail.com"];
      if (WHITELIST.includes(d.step2.email.toLowerCase())) {
        const HQ_ID = "22222222-2222-2222-2222-222222222222";
        await supabase.from("users").insert({
          tenant_id: HQ_ID, supabase_auth_id: authUserId, full_name: d.step2.full_name, email: d.step2.email, role: "owner",
        });
        toast.success("Welcome back — attached to Holaweb HQ");
        navigate({ to: "/admin" });
        return;
      }



      const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .insert({
          name: d.step1.business_name,
          industry: d.step1.industry,
          country: country.name,
          country_code: country.code,
          email: d.step2.email,
          whatsapp_number: d.step3.whatsapp_number || null,
          wa_phone_number: d.step3.whatsapp_number || null,
          wa_number_id: d.step3.wa_number_id || null,
          business_hours: d.hours,
        })
        .select()
        .single();
      if (tErr) throw tErr;

      const { error: uErr } = await supabase.from("users").insert({
        tenant_id: tenant.id,
        supabase_auth_id: authUserId,
        full_name: d.step2.full_name,
        email: d.step2.email,
        role: "owner",
      });
      if (uErr) throw uErr;

      const { error: svcErr } = await supabase.from("services").insert({
        tenant_id: tenant.id,
        name: d.step5.service_name,
        duration_minutes: 60,
        price_cents: Math.round(d.step5.price * 100),
        currency: country.currency,
        active: true,
      });
      if (svcErr) throw svcErr;

      toast.success("Workspace created!");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Create your workspace</CardTitle>
          <span className="text-xs text-muted-foreground">Step {step} of 5</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {step === 1 && <Step1 defaults={data.step1} onNext={(v) => { setData((d) => ({ ...d, step1: v })); setStep(2); }} />}
        {step === 2 && <Step2 defaults={data.step2} onBack={() => setStep(1)} onNext={(v) => { setData((d) => ({ ...d, step2: v })); setStep(3); }} />}
        {step === 3 && <Step3 defaults={data.step3} onBack={() => setStep(2)} onNext={(v) => { setData((d) => ({ ...d, step3: v })); setStep(4); }} />}
        {step === 4 && <Step4 defaults={data.hours!} onBack={() => setStep(3)} onNext={(h) => { setData((d) => ({ ...d, hours: h })); setStep(5); }} />}
        {step === 5 && (
          <Step5
            country={data.step1?.country_code ?? "NG"}
            defaults={data.step5}
            submitting={submitting}
            onBack={() => setStep(4)}
            onNext={(v) => finalize({ ...(data as WizardData), step5: v })}
          />
        )}
      </CardContent>
    </Card>
  );
}

function Step1({ defaults, onNext }: { defaults?: z.infer<typeof step1Schema>; onNext: (v: z.infer<typeof step1Schema>) => void }) {
  const form = useForm<z.infer<typeof step1Schema>>({ resolver: zodResolver(step1Schema), defaultValues: defaults ?? { business_name: "", industry: "", country_code: "" } });
  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Business name</Label>
        <Input {...form.register("business_name")} placeholder="Your business name" />
        {form.formState.errors.business_name && <p className="text-xs text-danger">{form.formState.errors.business_name.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Industry</Label>
        <Select value={form.watch("industry")} onValueChange={(v) => form.setValue("industry", v, { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
          <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
        </Select>
        {form.formState.errors.industry && <p className="text-xs text-danger">{form.formState.errors.industry.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Country</Label>
        <Select value={form.watch("country_code")} onValueChange={(v) => form.setValue("country_code", v, { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
          <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        {form.formState.errors.country_code && <p className="text-xs text-danger">{form.formState.errors.country_code.message}</p>}
      </div>
      <Button type="submit" className="w-full">Continue <ArrowRight className="h-4 w-4" /></Button>
    </form>
  );
}

function Step2({ defaults, onBack, onNext }: { defaults?: z.infer<typeof step2Schema>; onBack: () => void; onNext: (v: z.infer<typeof step2Schema>) => void }) {
  const form = useForm<z.infer<typeof step2Schema>>({ resolver: zodResolver(step2Schema), defaultValues: defaults ?? { full_name: "", email: "", password: "", confirm: "" } });
  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
      <div className="space-y-1.5"><Label>Full name</Label><Input {...form.register("full_name")} />{form.formState.errors.full_name && <p className="text-xs text-danger">{form.formState.errors.full_name.message}</p>}</div>
      <div className="space-y-1.5"><Label>Email</Label><Input type="email" {...form.register("email")} />{form.formState.errors.email && <p className="text-xs text-danger">{form.formState.errors.email.message}</p>}</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Password</Label><Input type="password" {...form.register("password")} />{form.formState.errors.password && <p className="text-xs text-danger">{form.formState.errors.password.message}</p>}</div>
        <div className="space-y-1.5"><Label>Confirm</Label><Input type="password" {...form.register("confirm")} />{form.formState.errors.confirm && <p className="text-xs text-danger">{form.formState.errors.confirm.message}</p>}</div>
      </div>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button><Button type="submit" className="flex-1">Continue <ArrowRight className="h-4 w-4" /></Button></div>
    </form>
  );
}

function Step3({ defaults, onBack, onNext }: { defaults?: z.infer<typeof step3Schema>; onBack: () => void; onNext: (v: z.infer<typeof step3Schema>) => void }) {
  const form = useForm<z.infer<typeof step3Schema>>({ resolver: zodResolver(step3Schema), defaultValues: defaults ?? { whatsapp_number: "", wa_number_id: "" } });
  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
      <p className="text-xs text-muted-foreground">Find these in Meta Business Manager → WhatsApp → API Setup. You can add this later in Settings.</p>
      <div className="space-y-1.5"><Label>WhatsApp Business Number</Label><Input placeholder="+234..." {...form.register("whatsapp_number")} /></div>
      <div className="space-y-1.5"><Label>WhatsApp Number ID</Label><Input placeholder="123456789012345" {...form.register("wa_number_id")} /></div>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button><Button type="submit" className="flex-1">Continue <ArrowRight className="h-4 w-4" /></Button></div>
    </form>
  );
}

function Step4({ defaults, onBack, onNext }: { defaults: typeof DEFAULT_BUSINESS_HOURS; onBack: () => void; onNext: (v: typeof DEFAULT_BUSINESS_HOURS) => void }) {
  const [hours, setHours] = useState(defaults);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Set the days and times your business is open.</p>
      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const d = hours[key as keyof typeof hours];
          return (
            <div key={key} className="grid grid-cols-12 gap-2 items-center py-1.5">
              <Switch className="col-span-1" checked={d.active} onCheckedChange={(v) => setHours({ ...hours, [key]: { ...d, active: v } })} />
              <Label className="col-span-3 text-sm">{label}</Label>
              <Input className="col-span-4" type="time" value={d.open} disabled={!d.active} onChange={(e) => setHours({ ...hours, [key]: { ...d, open: e.target.value } })} />
              <Input className="col-span-4" type="time" value={d.close} disabled={!d.active} onChange={(e) => setHours({ ...hours, [key]: { ...d, close: e.target.value } })} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button><Button type="button" className="flex-1" onClick={() => onNext(hours)}>Continue <ArrowRight className="h-4 w-4" /></Button></div>
    </div>
  );
}

function Step5({ country, defaults, submitting, onBack, onNext }: { country: string; defaults?: z.infer<typeof step5Schema>; submitting: boolean; onBack: () => void; onNext: (v: z.infer<typeof step5Schema>) => void }) {
  const { symbol, currency } = getCurrencyForCountry(country);
  const form = useForm<z.infer<typeof step5Schema>>({ resolver: zodResolver(step5Schema), defaultValues: defaults ?? { service_name: "", price: 0 } });
  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
      <p className="text-xs text-muted-foreground">Add your first service to start taking bookings.</p>
      <div className="space-y-1.5"><Label>Service name</Label><Input {...form.register("service_name")} placeholder="e.g. Consultation" />{form.formState.errors.service_name && <p className="text-xs text-danger">{form.formState.errors.service_name.message}</p>}</div>
      <div className="space-y-1.5"><Label>Price ({currency} {symbol})</Label><Input type="number" min={0} step="0.01" {...form.register("price")} /></div>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={onBack} disabled={submitting}><ArrowLeft className="h-4 w-4" /> Back</Button><Button type="submit" className="flex-1" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create workspace</Button></div>
    </form>
  );
}
