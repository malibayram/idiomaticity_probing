import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { submitAnnotatorApplication } from "@/lib/annotator-application";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const COPY = {
  en: {
    back: "Back to the atlas",
    kicker: "JOIN THE STUDY",
    title: "Become an annotator",
    intro:
      "We are building a human-rated dataset of multiword expressions. Annotators rate how compositional an expression is. Tell us a little about yourself and we'll review your application.",
    name: "Full name",
    email: "Email",
    native: "Native language",
    level: "Turkish proficiency",
    levels: {
      native: "Native",
      advanced: "Advanced",
      intermediate: "Intermediate",
      beginner: "Beginner",
    },
    background: "Background (linguistics, NLP, translation, …)",
    motivation: "Why would you like to contribute?",
    submit: "Send application",
    sending: "Sending…",
    required: "Please fill in your name, email and native language.",
    okTitle: "Application received",
    okBody:
      "Thank you - an administrator will review your application and approve your access. You can close this page.",
    failed: "Could not submit the application. Please try again.",
  },
  tr: {
    back: "Atlasa dön",
    kicker: "ÇALIŞMAYA KATIL",
    title: "İşaretleyici ol",
    intro:
      "Çok sözcüklü ifadelerden oluşan, insan puanlı bir veri seti hazırlıyoruz. İşaretleyiciler bir ifadenin ne kadar bileşimsel olduğunu puanlar. Kendinizden biraz bahsedin; başvurunuzu inceleyelim.",
    name: "Ad soyad",
    email: "E-posta",
    native: "Ana diliniz",
    level: "Türkçe yetkinliği",
    levels: {
      native: "Ana dil",
      advanced: "İleri",
      intermediate: "Orta",
      beginner: "Başlangıç",
    },
    background: "Geçmiş (dilbilim, NLP, çeviri, …)",
    motivation: "Neden katkı vermek istersiniz?",
    submit: "Başvuruyu gönder",
    sending: "Gönderiliyor…",
    required: "Lütfen ad, e-posta ve ana dil alanlarını doldurun.",
    okTitle: "Başvurunuz alındı",
    okBody:
      "Teşekkürler - bir yönetici başvurunuzu inceleyip erişiminizi onaylayacak. Bu sayfayı kapatabilirsiniz.",
    failed: "Başvuru gönderilemedi. Lütfen tekrar deneyin.",
  },
};

export function ApplyAnnotator() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const t = COPY[i18n.language.startsWith("tr") ? "tr" : "en"];

  const [form, setForm] = useState({
    name: "",
    email: "",
    nativeLanguage: "",
    turkishLevel: "advanced",
    background: "",
    motivation: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const update =
    (key: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.nativeLanguage.trim()
    ) {
      setError(t.required);
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      await submitAnnotatorApplication(form);
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : t.failed);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <button
        onClick={() => navigate("/")}
        className="mb-6 inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" /> {t.back}
      </button>

      {status === "done" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />{" "}
              {t.okTitle}
            </CardTitle>
            <CardDescription>{t.okBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <p className="text-xs font-semibold tracking-widest text-[hsl(var(--primary))]">
              {t.kicker}
            </p>
            <CardTitle className="text-2xl">{t.title}</CardTitle>
            <CardDescription>{t.intro}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t.name}>
              <Input value={form.name} onChange={update("name")} />
            </Field>
            <Field label={t.email}>
              <Input
                type="email"
                value={form.email}
                onChange={update("email")}
              />
            </Field>
            <Field label={t.native}>
              <Input
                value={form.nativeLanguage}
                onChange={update("nativeLanguage")}
              />
            </Field>
            <Field label={t.level}>
              <Select
                value={form.turkishLevel}
                onChange={update("turkishLevel")}
                className="w-full"
              >
                {Object.entries(t.levels).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.background}>
              <textarea
                value={form.background}
                onChange={update("background")}
                rows={3}
                className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              />
            </Field>
            <Field label={t.motivation}>
              <textarea
                value={form.motivation}
                onChange={update("motivation")}
                rows={3}
                className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              />
            </Field>

            {error ? (
              <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
            ) : null}

            <Button
              onClick={() => void submit()}
              disabled={status === "sending"}
              className="w-full"
            >
              {status === "sending" ? <Spinner className="h-4 w-4" /> : null}
              {status === "sending" ? t.sending : t.submit}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
