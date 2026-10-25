/**
 * A deliberately flawed Lovable-style app (a dental clinic with online deposits),
 * used for the "try a sample" demo and the engine tests. Credential-shaped strings
 * are assembled at runtime so no secret-looking literal sits in the repo.
 */

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeJwt = (role: string) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "supabase", ref: "abcdefghijklmnop", role, iat: 1700000000, exp: 2000000000 })}.${"x".repeat(43)}`;
const fakeStripe = ["sk", "live", "51NzQ" + "Ab3dE".repeat(5)].join("_");
const fakeOpenAi = "sk-" + "proj-" + "Q7f".repeat(16);

export function sampleClinicFiles(): Record<string, string> {
  return {
    "package.json": JSON.stringify(
      {
        name: "smile-dental",
        private: true,
        type: "module",
        scripts: { dev: "vite", build: "vite build" },
        dependencies: {
          "@supabase/supabase-js": "^2.45.0",
          "@stripe/stripe-js": "^4.0.0",
          stripe: "^16.0.0",
          openai: "^4.50.0",
          react: "^18.3.1",
          "react-dom": "^18.3.1",
          "react-router-dom": "^6.26.0",
          moment: "^2.30.1",
          "react-day-picker": "^8.10.1",
          recharts: "^2.12.7",
          "embla-carousel-react": "^8.1.0",
          "@tanstack/react-query": "^5.56.0",
          zod: "^3.23.8",
        },
        devDependencies: { vite: "^5.4.0", "lovable-tagger": "^1.0.0", typescript: "^5.5.0", tailwindcss: "^3.4.0" },
      },
      null,
      2,
    ),
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>smile-dental</title>
    <meta name="description" content="Lovable Generated Project" />
    <meta property="og:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
    <script src="https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ9"></script>
    <script src="https://widget.intercom.io/widget/abc123"></script>
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`,
    "README.md": "# Welcome to your Lovable project\n\nProject URL: https://lovable.dev/projects/xyz\n",
    ".env": `VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co\nVITE_SUPABASE_ANON_KEY=${fakeJwt("anon")}\nVITE_OPENAI_API_KEY=${fakeOpenAi}\nSTRIPE_SECRET_KEY=${fakeStripe}\n`,
    ".gitignore": "node_modules\ndist\n",
    "tsconfig.json": `{ "compilerOptions": { "strict": false, "noImplicitAny": false, "strictNullChecks": false } }`,
    "src/main.tsx": `import { createRoot } from "react-dom/client";\nimport App from "./App";\ncreateRoot(document.getElementById("root")!).render(<App />);\n`,
    "src/App.tsx": `import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Book from "./pages/Book";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/book" element={<Book />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  </BrowserRouter>
);
export default App;
`,
    "src/integrations/supabase/client.ts": `import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";
const SUPABASE_KEY = "${fakeJwt("service_role")}";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
`,
    "src/lib/ai.ts": `import OpenAI from "openai";
export const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
export async function summarize(notes: string) {
  const r = await openai.chat.completions.create({ model: "gpt-4o", messages: [{ role: "user", content: notes }] });
  return r.choices[0].message.content;
}
`,
    "src/components/Hero.tsx": `export default function Hero() {
  return (
    <section className="py-24 text-center">
      <img src="/hero.jpg" />
      <h1 className="text-5xl font-bold">Your smile, our passion</h1>
      <p className="mt-4 text-lg">Modern dentistry in the heart of Koregaon Park, Pune.</p>
    </section>
  );
}
`,
    "src/components/Testimonials.tsx": `const reviews = [
  { name: "Sarah Johnson", text: "Best dentist ever!", avatar: "https://i.pravatar.cc/150?img=1" },
  { name: "Michael Chen", text: "Painless and quick.", avatar: "https://i.pravatar.cc/150?img=2" },
];
export default function Testimonials() {
  return (
    <section>
      <h2>What our patients say</h2>
      {reviews.map((r, i) => (
        <div key={i}><img src={r.avatar} /><p>{r.text}</p><b>{r.name}</b></div>
      ))}
    </section>
  );
}
`,
    "src/components/Faq.tsx": `const faqs = [
  { question: "Do you accept insurance?", answer: "Yes, most major providers." },
  { question: "Is parking available?", answer: "Free parking behind the clinic." },
];
export default function Faq() {
  return <section id="faq">{faqs.map((f) => <details key={f.question}><summary>{f.question}</summary>{f.answer}</details>)}</section>;
}
`,
    "src/pages/Index.tsx": `import Hero from "@/components/Hero";
import Testimonials from "@/components/Testimonials";
import Faq from "@/components/Faq";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const [services, setServices] = useState([]);
  useEffect(async () => {
    const { data } = await supabase.from("services").select("*");
    setServices(data);
  }, []);
  return (
    <main>
      <Hero />
      <section id="services">{services.map((s, i) => <div key={i}>{s.name}: ₹{s.price}</div>)}</section>
      <Testimonials />
      <Faq />
      <section id="contact">
        <h2>Visit us</h2>
        <p>12 North Main Road, Koregaon Park, Pune 411001</p>
        <p>Call +91 98220 12345 · Mon - Sat 9am - 7pm</p>
        <a href="#book" className="btn">Book an appointment</a>
      </section>
      <footer><a href="#services">Services</a> <a href="#faq">FAQ</a> <a href="#contact">Contact</a></footer>
    </main>
  );
}
`,
    "src/pages/Book.tsx": `import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadStripe } from "@stripe/stripe-js";
import moment from "moment";

export default function Book() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", date: "" });
  const [query, setQuery] = useState("");
  const [doctors, setDoctors] = useState([]);

  async function search(q: string) {
    const { data } = await supabase.from("doctors").select("*").ilike("name", "%" + q + "%");
    setDoctors(data);
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await supabase.from("appointments").insert({ ...form, date: moment(form.date).format() });
      await supabase.from("profiles").update({ is_paid: true, plan: "deposit" }).eq("email", form.email);
    } catch (e) {}
    alert("Thanks! We will contact you.");
  }

  return (
    <form onSubmit={onSubmit}>
      <input placeholder="Search doctor" onChange={(e) => { setQuery(e.target.value); search(e.target.value); }} />
      <input placeholder="Name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input placeholder="Phone" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <button>Book now</button>
    </form>
  );
}
`,
    "src/pages/Dashboard.tsx": `import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    (async () => {
      const { data: appts } = await supabase.from("appointments").select("*");
      for (const a of appts) {
        const { data: doc } = await supabase.from("doctors").select("*").eq("id", a.doctor_id).single();
        a.doctor = doc;
      }
      setRows(appts);
    })();
  }, []);
  return <div dangerouslySetInnerHTML={{ __html: rows.map((r) => r.notes).join("<br/>") }} />;
}
`,
    "src/pages/Admin.tsx": `import { supabase } from "@/integrations/supabase/client";
export default function Admin() {
  const isAdmin = localStorage.getItem("role") === "admin";
  localStorage.setItem("auth_token", "x");
  if (!isAdmin) return null;
  return <button onClick={() => supabase.from("profiles").update({ role: "admin" }).eq("id", 1)}>Promote</button>;
}
`,
    "supabase/functions/stripe-webhook/index.ts": `import Stripe from "npm:stripe";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
Deno.serve(async (req) => {
  const event = await req.json();
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    console.log("paid", s.customer_email, s.metadata.token);
  }
  return new Response("ok");
});
`,
    "supabase/functions/create-checkout/index.ts": `import Stripe from "npm:stripe";
import { createClient } from "npm:@supabase/supabase-js";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
Deno.serve(async (req) => {
  const body = await req.json();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await admin.from("payments").insert(body);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price_data: { currency: "inr", unit_amount: body.amount, product_data: { name: "Deposit" } }, quantity: 1 }],
    success_url: "http://smiledental.in/success",
  });
  return Response.json({ url: session.url });
});
`,
    "supabase/migrations/20240501_init.sql": `create table public.profiles (
  id uuid primary key references auth.users,
  email text,
  role text default 'patient',
  is_paid boolean default false
);
alter table public.profiles enable row level security;
create policy "anyone can update" on public.profiles for update using (true);

create table public.appointments (
  id bigint generated always as identity primary key,
  user_id uuid,
  doctor_id bigint,
  name text, phone text, email text, notes text,
  date timestamptz
);

create table public.doctors (id bigint primary key, name text);
create table public.services (id bigint primary key, name text, price numeric);
alter table public.doctors enable row level security;
alter table public.services enable row level security;
create policy "public read" on public.services for select using (true);

create table public.payments (id bigint primary key, appointment_id bigint, amount numeric);
grant all on public.payments to anon;

create or replace function public.delete_user(uid uuid) returns void
language plpgsql security definer as $$
begin
  delete from public.profiles where id = uid;
end;
$$;
`,
  };
}

export const SAMPLE_ASSETS = [
  { path: "public/hero.jpg", bytes: 2_480_000 },
  { path: "public/team.png", bytes: 1_150_000 },
  { path: "public/favicon.ico", bytes: 4_200 },
];
