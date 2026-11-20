---
title: "Privacy policy | Nofa Applications"
h1: "How Invisibubble handles your data"
description: "The privacy policy for Invisibubble: Scroll Timer by Nofa Applications: what the app stores on your phone, its permissions, purchases and what leaves your device."
breadcrumb: Privacy policy
exactText: true
policyFor: invisibubble
dateModified: 2026-11-20
---

Last updated: November 20, 2026. Applies to the Invisibubble: Scroll Timer Android app (package `com.nofaapplications.invisibubble`), published by Nofa Applications.

Invisibubble is a floating bubble with a scroll timer and same-day reminders that runs on your phone. This page explains what the app can see, where it is stored, and what leaves your device. Short version: your reminders and timer settings stay on your phone. We do not run a server that collects them, and there is no account.

## Overview

Invisibubble is built to work on your device. There is no sign-in and no database of Invisibubble users. What the app remembers about your reminders and timer preferences is saved in the app's private storage on your phone.

Outside services are involved in only three ways: Google Play and Google Play Billing when you make a purchase, Android's backup feature if you have it turned on, and one small web request the app makes to check whether the free first day is currently offered. Each is described below.

## Permissions we use

Each permission exists for one visible feature. None of them is used to collect data about you.

| Permission | What it is for |
| --- | --- |
| Display over other apps (`SYSTEM_ALERT_WINDOW`) | Lets the bubble float on your screen while you use other apps. It draws the bubble. It does not let Invisibubble see, read or record what happens inside other apps. |
| Run in the background (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`) | Keeps the bubble and a running timer active when the app is not in the foreground. Recent Android versions require the second permission for this. Android shows a visible notification while this is active. |
| Notifications (`POST_NOTIFICATIONS`) | Used for the alert that a free day or 24-hour pass has ended, and for the ongoing notice Android shows while the bubble is on. We do not send marketing notifications. |
| Exact alarms (`SCHEDULE_EXACT_ALARM`) | Used so the alert that a free day or 24-hour pass has ended arrives at the right time. |
| Restart handling (`RECEIVE_BOOT_COMPLETED`) | Lets the app re-schedule the alert that tells you a free day or 24-hour pass has ended, so it still arrives after the phone restarts or the app updates. The bubble does not restart by itself after a restart. |
| Battery optimization request (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) | Lets the app ask you to allow it to run without battery restrictions, so Android does not stop the bubble. You choose, and you can say no. |
| Keep awake (`WAKE_LOCK`) | Declared by a bundled overlay library. The app does not keep your phone awake. Android may briefly wake the phone when the alert that a free day or 24-hour pass has ended goes off. |
| Google Play Billing (`com.android.vending.BILLING`) | Lets you buy the 24-hour pass or the lifetime unlock, and shows their prices, through Google Play. |
| Internet and network state (`INTERNET`, `ACCESS_NETWORK_STATE`) | Used only for the single request described under "Network request", and by Google Play Billing for purchases. |

Invisibubble has no camera, microphone, location, contacts, storage or SMS permissions.
## Data stored on your device

This information is saved in Invisibubble's private storage on your phone (Android SharedPreferences):

- **Theme:** the theme you chose for the app.
- **Reminders:** the short text and time of any same-day reminders you set.
- **Bubble settings:** hide times, and what the bubble shows.
- **Access status:** the signed purchase records from Google Play, whether a trial or the free day was used, and when the free day started and was last seen. It is used only to decide what the app shows you.
- **Saved free-day check:** a copy of the last answer from the free-day check described under "Network request".
- **Alarm record:** a small record used to send the alert that a free day or 24-hour pass has ended.

None of this is linked to your name, email or any identifier we hold, because Invisibubble never asks for one. If you uninstall the app or clear its storage, this data is deleted from your device.

## Android backup

If Android's backup is turned on for your phone, Android may back up one small file from Invisibubble to your own Google account. That file has exactly three fields: whether the free first day was used, when it started, and whether a trial was used before. Nothing else from the app is backed up. This is done by Android, under your Google account settings and Google's privacy policy. We do not receive or see this backup. It exists so that reinstalling the app, or moving to a new phone, does not give a second free day. You can turn off app backup in your phone's Google settings.

## Network request

When the app starts, it may request one small public file from a web address hosted on GitHub Pages. The file only says whether the free first day is currently offered. The request does not contain your name, reminders, settings or any account information. As with any web request, the host (GitHub) can see your IP address and the time of the request. See GitHub's privacy statement for how it handles that.

## Purchases and billing

Invisibubble offers a 24-hour pass and a one-time lifetime unlock, both handled by Google Play Billing. Google processes the payment under its own privacy policy. Invisibubble never sees or stores your payment details such as card numbers, UPI IDs or billing address.

After a purchase, Google returns a signed confirmation to the app, which checks it on your device to decide what to unlock. The resulting access status is stored locally, as described above. See [Google's Privacy Policy](https://policies.google.com/privacy) for how Google handles account and transaction information.

## What we do not do

- We do not operate a server or database that stores your personal data.
- We do not collect your name, email address, phone number or precise location.
- We do not read, log or transmit the contents of other apps, even though the bubble can appear over them.
- We do not save or send the reason you type for a second time extension. It is checked once to make sure it is not empty, then cleared.
- We do not use analytics or advertising SDKs that track you across apps.
- We do not sell or share your data.

## Children's privacy

Invisibubble is not directed at children and is not designed to collect personal information from anyone, including children. If you believe a child has provided personal information through the app, contact us and we will address it.

## Retention and deletion

The data listed under "Data stored on your device" stays on your device for as long as the app is installed. You can delete it at any time by clearing the app's storage or uninstalling the app. Any Android backup of the three free-day fields is kept by Google under your account, and you can delete it in your Google account's backup settings.

## Changes to this policy

If Invisibubble's data practices change, this page will be updated and the "last updated" date at the top will change. Please check back here if you have concerns.

## Contact

Questions about this policy can be sent to invisibubble.app@gmail.com.
