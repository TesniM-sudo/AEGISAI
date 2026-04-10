import { Mail, Phone, MapPin } from "lucide-react";

const Contact = () => {
  return (
    <section className="mx-auto max-w-4xl px-4 pt-10 sm:px-6 md:px-10">
      <div className="glass-card premium-border rounded-[40px] p-8 sm:p-12 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Get in touch</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Contact Support</h1>
        <p className="mt-4 text-sm text-muted-foreground max-w-2xl">
          Have questions about your account, trading limits, or need technical assistance with our AegisAI? Our support team is here to help.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]">
            <Phone className="h-6 w-6 text-cyan-400" />
            <h3 className="mt-4 text-lg font-medium text-foreground">Phone</h3>
            <p className="mt-2 text-sm text-muted-foreground">Give us a call</p>
            <p className="mt-2 font-semibold text-foreground">1-800-AEGIS-AI</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]">
            <Mail className="h-6 w-6 text-emerald-400" />
            <h3 className="mt-4 text-lg font-medium text-foreground">Email</h3>
            <p className="mt-2 text-sm text-muted-foreground">Drop us a line</p>
            <p className="mt-2 font-semibold text-foreground">contact@aegisai.com</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]">
            <MapPin className="h-6 w-6 text-indigo-400" />
            <h3 className="mt-4 text-lg font-medium text-foreground">Location</h3>
            <p className="mt-2 text-sm text-muted-foreground">Visit our office</p>
            <p className="mt-2 font-semibold text-foreground">123 Market St, SF, CA</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
