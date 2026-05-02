"""Email notifications for AegisAI risk alerts."""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from routes.account import get_account_record

ALERT_SUBJECT = "AegisAI Alert"


def send_email(to_email: str, subject: str, message: str) -> bool:
    """Send a plain-text email using SMTP environment settings."""
    host = os.getenv("EMAIL_HOST")
    port = int(os.getenv("EMAIL_PORT", "0") or 0)
    sender = os.getenv("EMAIL_ADDRESS")
    password = os.getenv("EMAIL_PASSWORD")

    if not all([host, port, sender, password, to_email]):
        return False

    mime_message = MIMEMultipart()
    mime_message["From"] = sender
    mime_message["To"] = to_email
    mime_message["Subject"] = subject
    mime_message.attach(MIMEText(message, "plain", "utf-8"))

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port) as server:
                server.login(sender, password)
                server.sendmail(sender, [to_email], mime_message.as_string())
        else:
            with smtplib.SMTP(host, port) as server:
                server.ehlo()
                if port in {25, 587}:
                    server.starttls()
                    server.ehlo()
                server.login(sender, password)
                server.sendmail(sender, [to_email], mime_message.as_string())
        return True
    except OSError:
        return False


def notify_user(user_id: str, message: str) -> bool:
    """Resolve a user's email address and send the standard alert message."""
    account = get_account_record(user_id)
    to_email = account["email"] if account else (user_id if "@" in user_id else "")

    # UPDATED: Email notification added
    return send_email(to_email=to_email, subject=ALERT_SUBJECT, message=message)
