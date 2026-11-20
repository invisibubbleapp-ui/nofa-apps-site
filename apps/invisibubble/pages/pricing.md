---
title: "Invisibubble pricing: Rs 100 lifetime or Rs 5 for 24 hours"
h1: "How much does Invisibubble cost?"
description: "Invisibubble: Scroll Timer costs Rs 100 for a one-time lifetime unlock, or Rs 5 for a 24-hour pass that you can buy again."
navLabel: Pricing
order: 5
dateModified: 2026-11-20
---

{{#if app.freeFirstDay}}{{app.name}} is free to install, and new users currently get their first 24 hours free, with no code needed. After that, it costs {{app.offerByKey.pass.display}} for a 24-hour pass that you can buy again, or {{app.offerByKey.lifetime.display}} once for a lifetime unlock.{{else}}{{app.name}} costs {{app.offerByKey.lifetime.display}} for a lifetime unlock, paid once. You can also buy a 24-hour pass for {{app.offerByKey.pass.display}}, and you can buy that pass again whenever you need it.{{/if}}

## Prices

| Option | Price | What you get |
| --- | --- | --- |
{{#if app.freeFirstDay}}| First 24 hours | Free | For new users. No code is needed. |
{{/if}}| {{app.offerByKey.lifetime.name}} | {{app.offerByKey.lifetime.display}} | Pay once. The bubble and the scroll timer stay unlocked. |
| {{app.offerByKey.pass.name}} | {{app.offerByKey.pass.display}} | The bubble and the scroll timer are unlocked for 24 hours. You can buy the pass again. |

Prices are in Indian rupees (INR). Google Play may show a local price in other countries.

Both options are handled by Google Play Billing. Invisibubble never sees or stores your payment details, such as card numbers, UPI IDs or billing address.

## What works without paying

Reminders and Settings open without paying. Showing the floating bubble, and so the scroll timer, needs access: {{#if app.freeFirstDay}}the first 24 hours for new users, {{/if}}a 24-hour pass or the lifetime unlock.

## Which option should I choose?

It depends on how often you plan to use the timer.

- **The lifetime unlock** is a single payment of {{app.offerByKey.lifetime.display}}.
- **The 24-hour pass** costs {{app.offerByKey.pass.display}} each time. Twenty passes cost the same as one lifetime unlock.

## FAQ

### Is Invisibubble free?

{{app.accessRule}}

{{#if app.freeFirstDay}}### Do I need a code for the free 24 hours?

No. {{app.freeFirstDayText}}

### Can I get the free 24 hours more than once?

No. The free 24 hours are for new users only. After that, you can buy a {{app.offerByKey.pass.display}} 24-hour pass or the {{app.offerByKey.lifetime.display}} lifetime unlock.

{{/if}}### Is Invisibubble a subscription?

No. The lifetime unlock is paid once. The 24-hour pass is bought one pass at a time.

### Can I buy the 24-hour pass more than once?

Yes. You can buy the 24-hour pass again whenever you need it.

### How do I get a refund?

Purchases made on Google Play follow Google Play's refund rules. See [Google Play's refund help page](https://support.google.com/googleplay/answer/2479637), or email {{app.contactEmail}}.
