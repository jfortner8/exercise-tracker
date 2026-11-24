# Before releasing the phone app

Your checklist for the App Store (and later Google Play). The app is **free**, with an optional tip jar inside and a Buy Me a Coffee link on the website. Tick things off as you go; the parts Claude does are marked.

## 1. Icon
- [ ] Get the icon from your girlfriend: **1024 × 1024 px PNG**, square corners, no transparency (iPhone rounds the corners itself). Keep the important shape inside the middle two-thirds, since Android crops icons into circles and other shapes.
- [ ] Claude: put it in the app (`apps/mobile/assets`), plus Android's adaptive icon and the splash screen.
- The icon can be changed after release, but each change needs a new build and an App Store review, so it's nicest to launch with the one you want.

## 2. Tip jar setup (App Store Connect → appstoreconnect.apple.com)
- [ ] **Business → Agreements:** sign the **Paid Apps** agreement. Any app that takes money needs it, even a free one with tips.
- [ ] **Business:** fill in **tax forms** (US: W-9) and **banking** (where Apple pays you).
- [ ] Enroll in the **App Store Small Business Program**, so Apple takes 15% instead of 30%.
- [ ] **Exercise Tracker → Monetization → In-App Purchases:** create three, each **Consumable**, with exactly these product IDs:

  | Product ID | Name | Price |
  |---|---|---|
  | `com.jfortner8.exercisetracker.tip.small` | Small tip | $1.99 |
  | `com.jfortner8.exercisetracker.tip.medium` | Medium tip | $4.99 |
  | `com.jfortner8.exercisetracker.tip.large` | Large tip | $9.99 |

  Prices are your choice and can be changed any time without an app update; Apple converts them for every other country. Each one also needs a description ("A tip to support development. Unlocks nothing.") and a review screenshot of the Support card in Settings (take it on your phone once the new build is installed).
- The tips card stays hidden in the app until these exist, so the build doesn't have to wait for this step.

## 3. New build
- [ ] After the icon is in (and anything else native), run **GitHub → Actions → EAS → Run workflow → `ios-testflight`**. It builds on EAS (about 5–25 minutes) and uploads to TestFlight on its own.
- [ ] Install it from the TestFlight app. Open the app twice to pick up any over-the-air updates published since.
- [ ] Try a tip with a **sandbox** Apple account (App Store Connect → Users and Access → Sandbox → Test Accounts). Sandbox purchases aren't charged.

## 4. The App Store page (App Store Connect → Exercise Tracker → iOS App → 1.0)
- [ ] **Screenshots:** at least 3, from a 6.9" iPhone (iPhone 16/17 Pro Max size, 1320 × 2868). Take them on your phone with real-looking data; Claude can help pick which screens.
- [ ] **Promotional text** (170 characters, changeable any time), **description** (up to 4,000) and **keywords** (100 characters, comma separated). Claude can draft these.
- [ ] **Support URL:** for example `https://exercise.johnafortner.com/privacy` or a simple support page (Claude can add one).
- [ ] **Privacy policy URL:** `https://exercise.johnafortner.com/privacy`
- [ ] **Category:** Health & Fitness.
- [ ] **Age rating** questionnaire (all "none" for this app).
- [ ] **Price:** Free (Pricing and Availability).
- [ ] **App Privacy labels:** data collected is the email address and the workouts, notes and health-type data you log, all linked to your account, used for app functionality only, no tracking. Claude can walk through the form with you.
- [ ] **Sign-in for the reviewer:** Apple needs a working account to log in with. Make a demo account with a few workouts and put its email and password in "Sign-in information". (Don't use your own.)
- [ ] Attach the build (the "Build" section), then **Add for Review** → **Submit**.
- [ ] Choose **manual release** if you want to pick the launch moment after approval.
- Ignore the China mainland compliance notices: they only apply if you distribute in mainland China. You can untick China in Pricing and Availability.

## 5. After approval
- [ ] Release it (or it goes live on its own if you chose automatic).
- [ ] Share the App Store link with friends and clubs.
- [ ] JavaScript fixes go out with **Actions → EAS → `update-production`** (no review). Native changes need a new build and review.

## Google Play (later)
- [ ] Pay the one-time **$25** fee and create a developer account (personal accounts verify identity).
- [ ] Payments profile (for tips), then the same three tip IDs as one-time products.
- [ ] **Closed test:** new personal accounts need **12 testers opted in for 14 days** before production. Build with **Actions → EAS → `android-play-internal`**.
- [ ] Store listing: 512 px icon, feature graphic (1024 × 500), phone screenshots, description, privacy policy, Data safety form.
- The app must stay **free** on Google Play: a free app can never become paid there.
