# Church Companion

Generate an Android Application Source Code of



Build a mobile app: Here is the same prompt restructured into clear points:



---



**Church Companion — Complete Application Build Prompt**



---



**1. Overview**

- App name: Church Companion

- Platform: Android

- Style: Modern, minimal, elegant

- Purpose: Digital church library and worship companion for a Hindi-speaking church community

- Primary content language: Hindi (some content like Almanac in English)

- UI language: English and Hindi, default English

- Animations: Smooth iOS-style throughout



---



**2. Five Main Books**

- Song Book

- Lord's Supper

- Ashaya Rabbani

- Prata Kaal & Sayan Kalin

- Almanac

- All books are readable without an account

- Each book has its own unique theme colour



---



**3. Reading Experience**

- Full-text search

- Bookmarks (local only, no cross-device sync)

- Adjustable font size

- Light and dark mode

- Personalised accent colour themes

- Bookmarks and preferences stored locally via AsyncStorage



---



**4. Song Book (Most Advanced Section)**

- Search by song number, title, or lyrics

- Real-time sync via Supabase

- Favourites, share, copy

- Continue reading

- Offline access support



---



**5. Today's Songs**

- Displayed prominently on the home screen

- Admins and Superadmin can select and publish songs for Sunday worship or special services

- All users see updates instantly in real time

- Push notification sent via OneSignal when songs are published

- Displays "No songs selected today" if nothing is published

- List auto-expires at end of the day without manual deletion



---



**6. User Access**

- Regular users can read all content without login or account

- No registration required for general use

- Bookmarks and preferences are personal and local



---



**7. Admin System**

- Multi-admin system supported

- Any user can submit an admin request from within the app

- Super Admin approves or rejects admin requests

- Multiple admins can be active at the same time

- Approved admins can upload, edit, and delete songs and books without further approval

- Admin section icon: Person icon

- Settings section icon: Gear icon

- there will be 2 login windows, one for super admin and one for admin request

- super admin can login anytime, and request admin also can accept others request after they getting accepted



---



**8. Super Admin Login**

- In the admin section, include a toggle to switch between two login methods

  - ID and Password login — for Super Admin only

- Super Admin credentials:

  - Email: emanualmridha2@gmail.com

  - Password: emanual@67

- Super Admin is pre-configured in Supabase Auth, no registration or approval needed

- Super Admin role assigned and verified in the Supabase profiles table using Row Level Security

- Password must never be hardcoded in the frontend source code, store securely in backend



---



**9. Content Uploads**

- Admins and Superadmin can upload content in PDF, DOCX, and TXT formats

- Upload flow: Upload → Parse → Review → Publish → Real-time Sync

- All published content is instantly available to all users



---



**10. Home Screen**

- Church logo displayed (to be uploaded later) for 1.5sec

- Today's Songs shown prominently at the top

- Easy-access cards for all five books below

- Navigation intuitive, responsive, and Android optimised



---



**11. Splash Screen**

- Church logo displayed (to be uploaded later)



---



**12. Settings Screen**

- Adjust font size

- Toggle light and dark mode

- Select accent colours

- Switch app language between English and Hindi



---



**13. Tech Stack**



Frontend:

- React Native CLI

- JSX

- React Navigation 7

- React Native Paper

- AsyncStorage



Backend:

- Supabase Auth

- PostgreSQL

- Supabase Realtime

- Supabase Storage

- Row Level Security (RLS)

- Edge Functions (future use)



Notifications:

- OneSignal



**14. Database Tables**

- profiles

- songs

- books

- book_sections

- today_song_sets

- today_song_items

- admin_requests

- announcements

- audit_logs

- app_settings



---



**15. Supabase Configuration**

- Project URL: https://eqwgrxcitwoyickthfpd.supabase.co

- Anon key mus

t be stored in a .env file

- Anon key must never be committed to GitHub



---



**16. GitHub Repository**

- https://github.com/iamemanual/Church-Companion



---

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://churchcompanion.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/305ff18a-d82e-4844-ad58-fac99fb8a3e5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
