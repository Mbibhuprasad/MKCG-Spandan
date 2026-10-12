"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { formErrors } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import Button from "@/components/ui/Button";
import { Checkbox, FormMessage, TextField } from "@/components/ui/Form";
import { PageLoader } from "@/components/ui/Feedback";
import AuthShell from "./AuthShell";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const initial = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  specialization: "",
  city: "",
  acceptPolicies: false,
};

// Mirrors the server rules for quick feedback. The API validates everything again.
function validate(values) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = "Enter your full name.";
  if (!EMAIL_RE.test(values.email.trim()))
    errors.email = "Enter a valid email address.";
  const digits = values.phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15)
    errors.phone = "Enter a valid phone number.";
  if (values.password.length < 8)
    errors.password = "Use at least 8 characters.";
  else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) {
    errors.password = "Include at least one letter and one number.";
  }
  if (values.confirmPassword !== values.password)
    errors.confirmPassword = "Passwords do not match.";
  if (!values.acceptPolicies)
    errors.acceptPolicies =
      "Please accept the Terms, Privacy Policy and Community Guidelines.";
  return errors;
}

export default function RegisterForm() {
  const router = useRouter();
  const { status, register } = useAuth();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Registration signs the doctor in, so this also handles the post-signup redirect.
  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  const set = (key) => (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    setMessage("");
    if (Object.keys(fieldErrors).length) return;

    setBusy(true);
    try {
      await register({
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        confirmPassword: values.confirmPassword,
        acceptPolicies: values.acceptPolicies,
        specialization: values.specialization || undefined,
        city: values.city || undefined,
      });
      // Signed in — the effect above sends the doctor to their dashboard.
    } catch (error) {
      const parsed = formErrors(error);
      setErrors(parsed.fieldErrors);
      setMessage(parsed.message);
      setBusy(false);
    }
  }

  if (status === "loading" || status === "authenticated")
    return <PageLoader label="Preparing your dashboard…" />;

  return (
    <AuthShell
      title="Join the community"
      subtitle="Create your doctor account. You can use the community straight away and complete your profile later."
      footer={
        <>
          Already a member?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-ink hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormMessage>{message}</FormMessage>

        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Dr. Ananya Mishra"
          value={values.name}
          onChange={set("name")}
          error={errors.name}
          required
          maxLength={80}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={set("email")}
            error={errors.email}
            required
          />
          <TextField
            label="Phone number"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            hint="Add the country code if outside India."
            value={values.phone}
            onChange={set("phone")}
            error={errors.phone}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters with a letter and a number."
            value={values.password}
            onChange={set("password")}
            error={errors.password}
            required
          />
          <TextField
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={set("confirmPassword")}
            error={errors.confirmPassword}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Specialization"
            name="specialization"
            placeholder="e.g. Cardiology"
            value={values.specialization}
            onChange={set("specialization")}
            error={errors.specialization}
            optional
            maxLength={80}
          />
          <TextField
            label="Address (City)"
            name="city"
            autoComplete="address-level2"
            placeholder="e.g. Bhubaneswar"
            value={values.city}
            onChange={set("city")}
            error={errors.city}
            optional
            maxLength={80}
          />
        </div>

        <Checkbox
          checked={values.acceptPolicies}
          onChange={set("acceptPolicies")}
          error={errors.acceptPolicies}
          label={
            <>
              I accept the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-brand-ink underline"
              >
                Terms &amp; Conditions
              </Link>
              ,{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="text-brand-ink underline"
              >
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link
                href="/community-guidelines"
                target="_blank"
                className="text-brand-ink underline"
              >
                Community Guidelines
              </Link>
              .
            </>
          }
        />

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={busy}
          icon={UserPlus}
        >
          {busy ? "Creating your account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
