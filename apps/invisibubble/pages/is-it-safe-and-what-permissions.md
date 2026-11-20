---
title: "Is Invisibubble safe? Permissions explained | Invisibubble"
h1: "Is Invisibubble safe, and what permissions does it need?"
description: "Invisibubble needs Android's Display over other apps permission to show its bubble and time's up screen on top of other apps. Here is every permission and why."
navLabel: Safety and permissions
order: 6
dateModified: 2026-11-21
---

Invisibubble's main permission is Android's "Display over other apps", because the bubble and the time's up screen must appear on top of the app you are using. Every other permission it uses is listed below with its reason, and it has no camera, microphone, location, contacts, storage or SMS permissions.

## What "Display over other apps" means

"Display over other apps" is an Android permission. Its technical name is `SYSTEM_ALERT_WINDOW`. It lets an app draw a window on top of other apps.

On its own, this permission only lets an app show things on top of the screen. It does not give the app access to your messages, photos or contacts.

## Why Invisibubble needs it

Invisibubble shows two things on top of other apps:

1. **The bubble** at the edge of the screen.
2. **The full-screen takeover** when your time is up.

Without "Display over other apps", Android would not let the app show either of these.

## How to turn it off

You can turn the permission off at any time:

1. Open **Settings** on your phone.
2. Go to **Apps**, then **Invisibubble**.
3. Open **Display over other apps** (on some phones: "Appear on top") and turn it off.

The steps and names can differ by phone maker. If you turn the permission off, the bubble and the time's up screen cannot show.

## Full permission list

These are all the permissions in the released app. The same list is in the [Invisibubble privacy policy](/privacy-policy/).

{{> permissionsTable}}

{{app.noPermissions}}

The app also contains an internal AndroidX permission named `com.nofaapplications.invisibubble.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. It is not a sensitive permission.
## Network request

Invisibubble makes one network request of its own: a plain HTTPS request for a small public settings file hosted on GitHub Pages. It sends no parameters, no extra headers and nothing that identifies you. It waits at most 3 seconds, and the answer is saved on the phone. Google Play Billing talks to Google's servers inside Google's own library.

## Your data

According to the [privacy policy](/privacy-policy/):

- There is no account and no sign-in.
- Everything the app saves is stored in the app's private storage on your phone. If Android backup is on, only one small file with three access fields can be backed up to your own Google account.
- {{app.developer}} does not run a server or database that stores your personal data.
- {{app.sdkClaim}}
- {{app.extensionReasonPrivacy}}
- Payments are handled by Google Play Billing. Invisibubble never sees your card number, UPI ID or billing address.

The Google Play listing also has a Data safety section provided by {{app.developer}}.

## Health claims

Invisibubble is a timer. It is not a medical or health product, and it makes no health claims.

## FAQ

### Why does Invisibubble need to display over other apps?

The bubble and the time's up screen appear on top of the app you are using. Android only allows this when you turn on "Display over other apps" for Invisibubble.

### What happens if I turn off the overlay permission?

The bubble and the time's up screen cannot show. You can turn the permission back on in Android settings.

### Does Invisibubble send a notification when my timer ends?

No. When the countdown ends, the bubble shows the "Time's up" screen. Invisibubble posts only two notifications: the alert that a free day or 24-hour pass has ended, and the ongoing notice Android shows while the bubble is on.

### Does Invisibubble use my camera, microphone or location?

No. {{app.noPermissions}}

### Does Invisibubble collect my personal data?

According to its privacy policy, Invisibubble has no account and keeps its data in private storage on your phone. It has no analytics, crash-reporting, advertising or attribution SDKs, and it does not read, log or transmit the contents of other apps.

### Is the reason I type for extra time saved?

No. {{app.extensionReasonPrivacy}}

### Is Invisibubble a medical app?

No. Invisibubble is a timer you set yourself. It is not a medical or health product.

### Where can I read the privacy policy?

The privacy policy is at [nofa-apps.store/privacy-policy](/privacy-policy/).
