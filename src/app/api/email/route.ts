import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  let body: {
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const to = body.to?.trim();
  if (!to) {
    return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
  }

  const subject = body.subject ?? "Flock processing summary";
  const text = body.text ?? "";
  const html = body.html;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user ?? "flock@localhost";

  if (!host || !user || !pass) {
    return NextResponse.json({
      ok: true,
      sent: false,
      stubbed: true,
      message:
        "SMTP not configured — email stubbed. Set SMTP_HOST, SMTP_USER, SMTP_PASS to send.",
      preview: { to, subject, text: text.slice(0, 500) },
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    return NextResponse.json({ ok: true, sent: true, stubbed: false });
  } catch (err) {
    console.error("email error", err);
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        error: err instanceof Error ? err.message : "Send failed",
      },
      { status: 500 }
    );
  }
}
