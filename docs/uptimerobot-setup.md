# UptimeRobot Setup & Health Monitoring Guide (Free Tier)

This guide documents the setup of **UptimeRobot Free Tier** (5-minute HTTP monitoring interval, up to 50 monitors) for RecoverAI.

---

## 🎯 Configured Monitors

### Monitor 1: Main Application Availability
- **Monitor Type**: `HTTP(s)`
- **Friendly Name**: `RecoverAI - Production Web UI`
- **URL**: `https://your-domain.vercel.app/`
- **Monitoring Interval**: `5 minutes`
- **Alert Contacts**: Default Email / Slack Webhook

---

### Monitor 2: Core Health Check (Database, Redis, Policy Engine)
- **Monitor Type**: `HTTP(s)`
- **Friendly Name**: `RecoverAI - Core System Health`
- **URL**: `https://your-domain.vercel.app/api/health`
- **Monitoring Interval**: `5 minutes`
- **HTTP Method**: `GET`
- **Expected Status Code**: `200 OK`
- **Keyword Monitoring**: `"status":"healthy"`

---

### Monitor 3: Money-Critical Path (Razorpay Webhook Probe)
- **Monitor Type**: `HTTP(s)`
- **Friendly Name**: `RecoverAI - Razorpay Webhook Receiver`
- **URL**: `https://your-domain.vercel.app/api/health/webhook`
- **Monitoring Interval**: `5 minutes`
- **HTTP Method**: `GET`
- **Expected Status Code**: `200 OK`
- **Keyword Monitoring**: `"status":"healthy"`

---

## 🔔 Alert Notification Settings

1. **Email Alerts**: Automatic instant dispatch on monitor state changes (`DOWN` / `UP`).
2. **Webhook / Slack Integration**:
   - Go to UptimeRobot Dashboard → My Settings → Alert Contacts → Add Alert Contact → Webhook / Slack.
   - Enter your Slack or Discord incoming webhook URL.
